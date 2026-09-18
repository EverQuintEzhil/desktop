import { collectPairs, type FencePair, isOwnBlock } from './fence-pairing';
import { type Fence, MAX_FENCE_INDENT, runLength } from './fence-scanner';
import type { Span } from './longer-runs';

type Edit = {
    start: number;
    end: number;
    replacement: string;
};

const startsCodeFence = (text: string, index: number): boolean => {
    const char = text[index];

    return (char === '`' || char === '~') && runLength(text, index, char) >= 3;
};

const lineEndingAt = (text: string, index: number): string => {
    const newline = text.indexOf('\n', index);

    return newline > 0 && text[newline - 1] === '\r' ? '\r\n' : '\n';
};

const lineBreakAt = (text: string, index: number, prefix: string): Edit => ({
    start: index,
    end: index,
    replacement: `${lineEndingAt(text, index)}${prefix}`,
});

const restOfLine = (text: string, index: number): string => {
    const end = text.indexOf('\n', index);

    return text.slice(index, end === -1 ? text.length : end);
};

/** Breaking before trailing text that holds its own `$$` mints a new line-start fence a second pass would edit again. */
const closerWouldMintFence = (text: string, index: number): boolean => restOfLine(text, index).includes('$$');

const openerEdits = (text: string, open: Fence): Edit[] =>
    open.hasContentAfter ? [lineBreakAt(text, open.end, open.prefix)] : [];

const closerEdits = (text: string, open: Fence, close: Fence): Edit[] | null => {
    if (!text.slice(open.end, close.start).includes('\n')) return null;
    if (close.hasContentAfter && closerWouldMintFence(text, close.end)) return null;

    const edits: Edit[] = [];

    if (!close.atLineStart) edits.push(lineBreakAt(text, close.start, open.prefix));
    if (close.hasContentAfter) edits.push(lineBreakAt(text, close.end, open.prefix));

    return edits;
};

const pairEdits = (text: string, { open, close }: FencePair): Edit[] => {
    const tail = close ? closerEdits(text, open, close) : [];

    if (!tail) return [];

    const edits = [...openerEdits(text, open), ...tail];

    return edits.some((edit) => startsCodeFence(text, edit.start)) ? [] : edits;
};

const opensSelfClosingRun = (fence: Fence): boolean =>
    !fence.inMathFlow &&
    fence.atLineStart &&
    fence.indent <= MAX_FENCE_INDENT &&
    fence.hasContentAfter &&
    !fence.afterListMarker;

/**
 * remark-math resolves a `$$` run that also closes on its own line as inline math, so the display
 * block `normalizeMathDelimiters` collapses out of `\[ ... \]` renders un-centered.
 */
const isSelfClosingRun = (text: string, open: Fence, close: Fence): boolean => {
    if (close.hasContentAfter || !opensSelfClosingRun(open)) return false;
    if (!isOwnBlock(text, open)) return false;

    const body = text.slice(open.end, close.start);

    return body.trim() !== '' && !body.includes('\n') && !body.includes('$');
};

const blocks = (blocked: Span | null, start: number, end: number): boolean =>
    blocked !== null && start < blocked.end && blocked.start < end;

export const collectSelfClosingEdits = (text: string, fences: Fence[], blocked: Span | null = null): Edit[] => {
    const edits: Edit[] = [];

    for (let index = 0; index + 1 < fences.length; index += 1) {
        const open = fences[index];
        const close = fences[index + 1];

        if (blocks(blocked, open.start, close.end)) continue;
        if (isSelfClosingRun(text, open, close)) {
            edits.push(lineBreakAt(text, open.end, open.prefix), lineBreakAt(text, close.start, open.prefix));
        }
    }

    return edits;
};

export const collectEdits = (text: string, fences: Fence[], blocked: Span | null = null): Edit[] =>
    collectPairs(text, fences)
        .filter((pair) => !blocks(blocked, pair.open.start, (pair.close ?? pair.open).end))
        .flatMap((pair) => pairEdits(text, pair));

export const applyEdits = (text: string, edits: Edit[]): string => {
    let out = '';
    let cursor = 0;

    for (const edit of edits) {
        out += text.slice(cursor, edit.start) + edit.replacement;
        cursor = edit.end;
    }

    return out + text.slice(cursor);
};
