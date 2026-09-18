import { htmlBlockEnd } from './html-blocks';

export type Fence = {
    start: number;
    end: number;
    atLineStart: boolean;
    hasContentAfter: boolean;
    prefix: string;
    indent: number;
    /** micromark opens flow math on a run that begins a list item's content, but the model has no list container to pair it in. */
    afterListMarker: boolean;
    /** Inside flow math micromark reads every line verbatim, so a run on such a line is body text, not a fence. */
    inMathFlow: boolean;
};

export const MAX_FENCE_INDENT = 3;

const CODE_INDENT_COLUMNS = 4;
const TAB_COLUMNS = 4;
const PAIRABLE_RUN = 2;
const ATX_HEADING = /^#{1,6}(?:\s|$)/;
const THEMATIC_BREAK = /^(?:\*[ \t]*){3,}$|^(?:-[ \t]*){3,}$|^(?:_[ \t]*){3,}$/;
const SETEXT_UNDERLINE = /^(?:=+|-+)[ \t]*$/;
const LIST_MARKER = /^(?:[-*+](?:[ \t]|$)|\d{1,9}[.)](?:[ \t]|$))/;
const TABLE_ROW = /^\|/;

export const runLength = (text: string, start: number, char: string): number => {
    let length = 0;

    while (text[start + length] === char) length += 1;

    return length;
};

const isInlineSpace = (char: string | undefined): boolean => char === ' ' || char === '\t' || char === '\r';

const isPrefixChar = (char: string | undefined): boolean => isInlineSpace(char) || char === '>';

/** The `length < 3` guard mirrors `@assistant-ui/react-markdown` 0.14.12, which closes a run of three or more on any backtick run rather than on an equal-length one as CommonMark requires. */
export const codeSpanEnd = (text: string, start: number): number => {
    const length = runLength(text, start, '`');
    const fence = '`'.repeat(length);
    let closed = text.indexOf(fence, start + length);

    while (length < 3 && closed !== -1) {
        const closedLength = runLength(text, closed, '`');

        if (closedLength === length) break;
        closed = text.indexOf(fence, closed + closedLength);
    }

    return closed === -1 ? -1 : closed + length;
};

const skipPrefix = (text: string, start: number): number => {
    let index = start;

    while (isPrefixChar(text[index])) index += 1;

    return index;
};

const isAtLineStart = (text: string, index: number): boolean => {
    let cursor = index - 1;

    while (cursor >= 0 && isPrefixChar(text[cursor])) cursor -= 1;

    return cursor < 0 || text[cursor] === '\n';
};

const hasContentAfter = (text: string, index: number): boolean => {
    let cursor = index;

    while (isInlineSpace(text[cursor])) cursor += 1;

    return cursor < text.length && text[cursor] !== '\n';
};

const lineEnd = (text: string, index: number): number => {
    const newline = text.indexOf('\n', index);

    return newline === -1 ? text.length : newline;
};

const nextLineStart = (text: string, index: number): number => Math.min(lineEnd(text, index) + 1, text.length);

const lineStartOf = (text: string, index: number): number => text.lastIndexOf('\n', index - 1) + 1;

const followsListMarker = (text: string, index: number): boolean => {
    const start = lineStartOf(text, index);
    const line = text.slice(start, lineEnd(text, index));
    const target = index - start;
    let cursor = 0;
    let marked = false;

    while (cursor < target) {
        while (cursor < target && isPrefixChar(line[cursor])) cursor += 1;
        if (cursor >= target) break;

        const match = LIST_MARKER.exec(line.slice(cursor));

        if (!match) return false;
        cursor += match[0].length;
        marked = true;
    }

    return marked && cursor === target;
};

const linePrefix = (text: string, index: number): string => {
    const start = lineStartOf(text, index);
    let cursor = start;

    while (cursor < index && isPrefixChar(text[cursor]) && text[cursor] !== '\r') cursor += 1;

    return text.slice(start, cursor);
};

/** CommonMark measures indented-code width in columns from each blockquote marker, not from line start. */
const indentColumns = (text: string, start: number, end: number): number => {
    let columns = 0;
    let cursor = start;

    while (cursor < end) {
        const char = text[cursor];

        if (char === '>') {
            columns = 0;
            cursor += text[cursor + 1] === ' ' ? 2 : 1;
            continue;
        }
        columns += char === '\t' ? TAB_COLUMNS - (columns % TAB_COLUMNS) : 1;
        cursor += 1;
    }

    return columns;
};

/** micromark measures a fence's indent from its list item's content start, so a run beginning that content is at the fence column whatever the marker's own width. */
export const startsAtFenceColumn = (text: string, index: number): boolean =>
    followsListMarker(text, index) ||
    (isAtLineStart(text, index) && indentColumns(text, lineStartOf(text, index), index) <= MAX_FENCE_INDENT);

const codeFenceEnd = (text: string, start: number, char: string, length: number): number => {
    let cursor = lineEnd(text, start);

    while (cursor < text.length) {
        const contentStart = skipPrefix(text, cursor + 1);

        if (runLength(text, contentStart, char) >= length) return lineEnd(text, contentStart);
        cursor = lineEnd(text, cursor + 1);
    }

    return text.length;
};

const openedCodeFenceEnd = (text: string, index: number): number => {
    const char = text[index];

    if (char !== '`' && char !== '~') return -1;
    const length = runLength(text, index, char);

    return length < 3 ? -1 : codeFenceEnd(text, index, char, length);
};

/** CommonMark indented code cannot interrupt a paragraph, so it can only open after a line that was not paragraph content. */
const continuesParagraph = (line: string): boolean => {
    const content = line.endsWith('\r') ? line.slice(0, -1) : line;

    return (
        !ATX_HEADING.test(content) &&
        !THEMATIC_BREAK.test(content) &&
        !SETEXT_UNDERLINE.test(content) &&
        !LIST_MARKER.test(content) &&
        !TABLE_ROW.test(content)
    );
};

const scanLineFences = (text: string, from: number, fences: Fence[], inMathFlow: boolean): number => {
    const end = lineEnd(text, from);
    let cursor = from;

    while (cursor < end) {
        const char = text[cursor];

        if (char === '\\') {
            cursor = Math.min(cursor + 2, end);
            continue;
        }

        if (char === '`') {
            const spanEnd = codeSpanEnd(text, cursor);

            cursor = spanEnd === -1 ? cursor + runLength(text, cursor, '`') : Math.min(spanEnd, end);
            continue;
        }

        if (char !== '$') {
            cursor += 1;
            continue;
        }

        const dollars = runLength(text, cursor, '$');

        if (dollars === PAIRABLE_RUN) {
            fences.push({
                start: cursor,
                end: cursor + dollars,
                atLineStart: isAtLineStart(text, cursor),
                hasContentAfter: hasContentAfter(text, cursor + dollars),
                prefix: linePrefix(text, cursor),
                indent: indentColumns(text, lineStartOf(text, cursor), cursor),
                afterListMarker: followsListMarker(text, cursor),
                inMathFlow,
            });
        }
        cursor += dollars;
    }

    return cursor;
};

type ScanState = {
    codeOpenable: boolean;
    inIndentedCode: boolean;
    inMathFlow: boolean;
};

const isMathFlowFence = (text: string, contentStart: number, columns: number): boolean =>
    columns <= MAX_FENCE_INDENT && runLength(text, contentStart, '$') === PAIRABLE_RUN;

/** micromark reads the rest of an opening flow-math fence's line as meta, which may not contain `$`. */
const opensMathFlow = (text: string, contentStart: number, end: number, columns: number): boolean =>
    isMathFlowFence(text, contentStart, columns) && !text.slice(contentStart + PAIRABLE_RUN, end).includes('$');

const closesMathFlow = (text: string, contentStart: number, end: number, columns: number): boolean =>
    isMathFlowFence(text, contentStart, columns) && text.slice(contentStart + PAIRABLE_RUN, end).trim() === '';

const skipsAsIndentedCode = (state: ScanState, columns: number): boolean => {
    if (state.inIndentedCode) {
        if (columns >= CODE_INDENT_COLUMNS) return true;
        state.inIndentedCode = false;

        return false;
    }

    if (!state.codeOpenable || columns < CODE_INDENT_COLUMNS) return false;
    state.inIndentedCode = true;
    state.codeOpenable = false;

    return true;
};

export type CodeRange = { start: number; end: number };

export const collectCodeRanges = (text: string): CodeRange[] => {
    const ranges: CodeRange[] = [];
    const state: ScanState = { codeOpenable: true, inIndentedCode: false, inMathFlow: false };
    let index = 0;

    while (index < text.length) {
        const end = lineEnd(text, index);
        const contentStart = skipPrefix(text, index);

        if (contentStart >= end) {
            state.codeOpenable = true;
            index = nextLineStart(text, index);
            continue;
        }

        const columns = indentColumns(text, index, contentStart);

        if (skipsAsIndentedCode(state, columns)) {
            ranges.push({ start: index, end });
            index = nextLineStart(text, index);
            continue;
        }

        const blockEnd = openedCodeFenceEnd(text, contentStart);

        if (blockEnd !== -1) {
            state.codeOpenable = true;
            ranges.push({ start: contentStart, end: blockEnd });
            index = nextLineStart(text, blockEnd);
            continue;
        }

        state.codeOpenable = !continuesParagraph(text.slice(contentStart, end));
        index = nextLineStart(text, index);
    }

    return ranges;
};

/** Inside flow math micromark reads every line verbatim, so a code fence there opens nothing. */
export const collectFences = (text: string): Fence[] => {
    const fences: Fence[] = [];
    const state: ScanState = { codeOpenable: true, inIndentedCode: false, inMathFlow: false };
    let index = 0;

    while (index < text.length) {
        const end = lineEnd(text, index);
        const contentStart = skipPrefix(text, index);

        if (contentStart >= end) {
            state.codeOpenable = true;
            index = nextLineStart(text, index);
            continue;
        }

        const columns = indentColumns(text, index, contentStart);

        if (state.inMathFlow) {
            state.inMathFlow = !closesMathFlow(text, contentStart, end, columns);
            index = nextLineStart(text, scanLineFences(text, contentStart, fences, true));
            continue;
        }

        if (skipsAsIndentedCode(state, columns)) {
            index = nextLineStart(text, index);
            continue;
        }

        const blockEnd = openedCodeFenceEnd(text, contentStart);

        if (blockEnd !== -1) {
            state.codeOpenable = true;
            index = nextLineStart(text, blockEnd);
            continue;
        }

        const htmlEnd = columns <= MAX_FENCE_INDENT ? htmlBlockEnd(text, contentStart, state.codeOpenable) : -1;

        if (htmlEnd !== -1) {
            state.codeOpenable = true;
            index = nextLineStart(text, htmlEnd);
            continue;
        }

        state.inMathFlow = opensMathFlow(text, contentStart, end, columns);
        state.codeOpenable = !continuesParagraph(text.slice(contentStart, end));
        index = nextLineStart(text, scanLineFences(text, contentStart, fences, false));
    }

    return fences;
};
