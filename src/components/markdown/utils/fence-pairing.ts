import { type Fence, MAX_FENCE_INDENT } from './fence-scanner';

const BLANK_LINE = /\r?\n[ \t>]*\r?\n/;
const BLANK_CONTENT = /^[ \t>\r]*$/;

export type FencePair = {
    open: Fence;
    /** null when the block already has a fence micromark accepts as its closer, so only the opener needs repair. */
    close: Fence | null;
};

const quoteDepth = (prefix: string): number => prefix.split('>').length - 1;

const lineEndFrom = (text: string, index: number): number => {
    const newline = text.indexOf('\n', index);

    return newline === -1 ? text.length : newline;
};

/** micromark allows a flow-math fence at most three columns of indent. */
const atFenceColumn = (fence: Fence): boolean => fence.atLineStart && fence.indent <= MAX_FENCE_INDENT;

/** A run indented past the fence column inside flow math is verbatim content, not a fence. */
const isFlowContent = (fence: Fence): boolean => fence.atLineStart && fence.indent > MAX_FENCE_INDENT;

const closesFlow = (fence: Fence): boolean => atFenceColumn(fence) && !fence.hasContentAfter;

/** micromark ends flow math on a lazy line, so a candidate that dropped a blockquote marker never closes the block. */
const dropsContainer = (fence: Fence, open: Fence): boolean => quoteDepth(fence.prefix) < quoteDepth(open.prefix);

/** Flow math is concrete, so no container opens inside it: an extra `>` before a candidate is content, never a closing fence. */
const closesFlowFor = (fence: Fence, open: Fence): boolean =>
    closesFlow(fence) && quoteDepth(fence.prefix) === quoteDepth(open.prefix);

const metaHoldsDollar = (text: string, fence: Fence): boolean =>
    text.slice(fence.end, lineEndFrom(text, fence.end)).includes('$');

/** A `$$` later on the same line makes the run an inline pair micromark resolves within that line. */
const closesOnOwnLine = (text: string, fences: Fence[], index: number): boolean => {
    const next = fences[index + 1];

    return next !== undefined && next.start < lineEndFrom(text, fences[index].end);
};

const lineStartFrom = (text: string, index: number): number => text.lastIndexOf('\n', index - 1) + 1;

const blankAbove = (text: string, lineStart: number): boolean =>
    BLANK_CONTENT.test(text.slice(lineStartFrom(text, lineStart - 1), lineStart - 1));

const blankLineBefore = (text: string, fence: Fence): boolean => {
    const lineStart = lineStartFrom(text, fence.start);

    if (lineStart === 0) return false;

    return blankAbove(text, lineStart);
};

/** micromark ends a paragraph at a flow-math fence and re-parents everything after it, so only a blank line or the document edge on both sides makes the run its own block. */
export const isOwnBlock = (text: string, fence: Fence): boolean => {
    const lineStart = lineStartFrom(text, fence.start);
    const lineEnd = lineEndFrom(text, fence.end);
    const above = lineStart === 0 || blankAbove(text, lineStart);
    const below = lineEnd >= text.length || BLANK_CONTENT.test(text.slice(lineEnd + 1, lineEndFrom(text, lineEnd + 1)));

    return above && below;
};

/** micromark's flow math is concrete, so a blank line never ends it and the next block's opener reads as this block's closer. */
const opensNewBlock = (text: string, fence: Fence, open: Fence): boolean =>
    closesFlowFor(fence, open) && blankLineBefore(text, fence);

type Lookahead = 'closer' | 'content';

const lookahead = (text: string, fences: Fence[], from: number, open: Fence): Lookahead => {
    for (let index = from; index < fences.length; index += 1) {
        const fence = fences[index];

        if (isFlowContent(fence) || fence.afterListMarker) continue;
        if (dropsContainer(fence, open)) return 'content';
        if (opensNewBlock(text, fence, open)) return 'content';
        if (closesFlowFor(fence, open)) return 'closer';
    }

    return 'content';
};

type PairState = {
    pairs: FencePair[];
    flowOpen: Fence | null;
    inlineOpen: boolean;
};

const advanceInsideFlow = (text: string, state: PairState, fences: Fence[], index: number, open: Fence): boolean => {
    const fence = fences[index];

    if (isFlowContent(fence) || fence.afterListMarker) return true;
    if (dropsContainer(fence, open)) return false;

    if (closesFlowFor(fence, open)) {
        state.pairs.push({ open, close: null });
        state.flowOpen = null;

        return true;
    }

    if (lookahead(text, fences, index + 1, open) === 'closer') return true;

    state.pairs.push({ open, close: fence });
    state.flowOpen = null;

    return true;
};

const advanceOutsideFlow = (
    text: string,
    state: PairState,
    fences: Fence[],
    index: number,
    separated: boolean,
): boolean => {
    const fence = fences[index];

    if (fence.afterListMarker) return true;

    if (state.inlineOpen && !separated) {
        if (atFenceColumn(fence)) return false;
        state.inlineOpen = false;

        return true;
    }
    state.inlineOpen = false;

    if (!atFenceColumn(fence)) {
        state.inlineOpen = true;

        return true;
    }

    if (metaHoldsDollar(text, fence)) {
        if (!closesOnOwnLine(text, fences, index)) return false;
        state.inlineOpen = true;

        return true;
    }
    state.flowOpen = fence;

    return true;
};

/**
 * Mirrors how micromark pairs `$$` runs: a line-start run within three columns opens flow math and
 * may carry meta, only a run at that same fence column with nothing after it and the container
 * prefix intact closes one, and outside flow math an unclosed run is inline math.
 */
export const collectPairs = (text: string, fences: Fence[]): FencePair[] => {
    const state: PairState = { pairs: [], flowOpen: null, inlineOpen: false };
    let previousEnd = 0;

    for (let index = 0; index < fences.length; index += 1) {
        const fence = fences[index];
        const resolved = state.flowOpen
            ? advanceInsideFlow(text, state, fences, index, state.flowOpen)
            : advanceOutsideFlow(text, state, fences, index, BLANK_LINE.test(text.slice(previousEnd, fence.start)));

        if (!resolved) return [];
        previousEnd = fence.end;
    }

    return state.pairs;
};
