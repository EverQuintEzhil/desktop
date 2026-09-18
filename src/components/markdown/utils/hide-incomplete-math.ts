import { type CodeRange, codeSpanEnd, collectCodeRanges, runLength, startsAtFenceColumn } from './fence-scanner';

const LATEX_SYNTAX = /\\[a-zA-Z]|[_^{}]/;
const TRAILING_BACKSLASHES = /\\+$/;
const PRICE_WORD = /^\.?\d\S*/;
const SHELL_VARIABLE = /^[A-Z]{2,}[A-Z0-9]*[^A-Za-z0-9]/;
const LATEX_START = /[\\_^{}]/;
const BLANK_LINE = /\n[ \t]*\r?\n/g;
const CUSTOM_TAGS = ['[/math]', '[/inline]'];
const DISPLAY_DOLLARS = 2;

type Brackets = { open: string[]; close: string[]; sameLine: boolean };

const INLINE_BRACKET: Brackets = { open: ['\\\\(', '\\('], close: ['\\\\)', '\\)'], sameLine: true };
const DISPLAY_BRACKET: Brackets = { open: ['\\\\[', '\\['], close: ['\\\\]', '\\]'], sameLine: false };

type Scan = { text: string; ranges: CodeRange[] };

const matchAt = (text: string, index: number, candidates: string[]): string | null =>
    candidates.find((candidate) => text.startsWith(candidate, index)) ?? null;

const codeRangeEnd = (ranges: CodeRange[], index: number): number =>
    ranges.find((range) => range.start <= index && index < range.end)?.end ?? -1;

/** A backtick run that never closes is literal text, so scanning resumes just past the run itself. */
const pastCodeSpan = (text: string, index: number): number => {
    const end = codeSpanEnd(text, index);

    return end === -1 ? index + runLength(text, index, '`') : end;
};

const lineEndFrom = (text: string, index: number): number => {
    const newline = text.indexOf('\n', index);

    return newline === -1 ? text.length : newline;
};

/** remark-math resolves `$...$` within one paragraph, so a blank line is as far as a closer can be. */
const paragraphEndFrom = (text: string, index: number): number => {
    BLANK_LINE.lastIndex = index;

    const blank = BLANK_LINE.exec(text);

    return blank === null ? text.length : blank.index;
};

const findCloser = ({ text, ranges }: Scan, from: number, closers: string[], limit: number): number => {
    let index = from;

    while (index < limit) {
        const blockEnd = codeRangeEnd(ranges, index);

        if (blockEnd !== -1) {
            index = blockEnd;
            continue;
        }
        if (text[index] === '`') {
            index = pastCodeSpan(text, index);
            continue;
        }
        if (matchAt(text, index, closers) !== null) return index;
        index += text[index] === '\\' ? 2 : 1;
    }

    return -1;
};

/** `rewriteLatexBracketDelimiters` matches `\(...\)` within one line but `\[...\]` across lines, so only the inline opener is settled as literal text once its line ends. */
const bracketRunEnd = (scan: Scan, index: number, opener: string, brackets: Brackets): number => {
    const limit = brackets.sameLine ? lineEndFrom(scan.text, index) : scan.text.length;
    const close = findCloser(scan, index + opener.length, brackets.close, limit);

    if (close !== -1) return close + (matchAt(scan.text, close, brackets.close) ?? '').length;

    return limit < scan.text.length ? index + opener.length : -1;
};

/** Only a run at a fence column opens flow math, whose body may cross a blank line; a mid-line run is inline math micromark resolves within one paragraph. */
const displayDollarEnd = (scan: Scan, index: number, dollars: number): number => {
    if (!startsAtFenceColumn(scan.text, index)) return unclosedRunEnd(scan, index, dollars);

    const close = findCloser(scan, index + dollars, ['$$'], scan.text.length);

    return close === -1 ? -1 : close + DISPLAY_DOLLARS;
};

/** A price must keep showing, or a `$` in prose blanks the rest of the message; judging it only once the digit-led word has ended keeps `$5` and `$5x` from answering differently. */
const opensPrice = (tail: string): boolean => {
    const word = PRICE_WORD.exec(tail);

    return word !== null && word[0].length < tail.length && !LATEX_SYNTAX.test(word[0]);
};

const opensShellVariable = (tail: string): boolean => {
    const word = SHELL_VARIABLE.exec(tail);

    return word !== null && !LATEX_START.test(word[0]);
};

/** micromark never opens inline math on a `$` followed by whitespace, and a run whose paragraph has closed had no closer to find, so both are prose for good. */
const opensProse = (tail: string): boolean => /^\s/.test(tail) || opensPrice(tail) || opensShellVariable(tail);

const unclosedRunEnd = (scan: Scan, index: number, dollars: number): number => {
    const limit = paragraphEndFrom(scan.text, index);
    const close = findCloser(scan, index + dollars, [scan.text.slice(index, index + dollars)], limit);

    if (close !== -1) return close + dollars;
    if (limit < scan.text.length) return index + dollars;

    return opensProse(scan.text.slice(index + dollars)) ? index + dollars : -1;
};

const tagRunEnd = (scan: Scan, index: number, tag: string): number => {
    const close = findCloser(scan, index + tag.length, [tag], scan.text.length);

    return close === -1 ? -1 : close + tag.length;
};

const backslashRunEnd = (scan: Scan, index: number): number => {
    const inline = matchAt(scan.text, index, INLINE_BRACKET.open);

    if (inline !== null) return bracketRunEnd(scan, index, inline, INLINE_BRACKET);

    const display = matchAt(scan.text, index, DISPLAY_BRACKET.open);

    return display === null ? index + 2 : bracketRunEnd(scan, index, display, DISPLAY_BRACKET);
};

const spanEnd = (scan: Scan, index: number): number => {
    const char = scan.text[index];

    if (char === '\\') return backslashRunEnd(scan, index);

    if (char === '$') {
        const dollars = runLength(scan.text, index, '$');

        return dollars >= DISPLAY_DOLLARS ? displayDollarEnd(scan, index, dollars) : unclosedRunEnd(scan, index, 1);
    }

    const tag = matchAt(scan.text, index, CUSTOM_TAGS);

    return tag === null ? index + 1 : tagRunEnd(scan, index, tag);
};

const OPENER_CHARS = new Set(['$', '\\', '[']);

const unclosedOpener = (scan: Scan): number => {
    let index = 0;

    while (index < scan.text.length) {
        const blockEnd = codeRangeEnd(scan.ranges, index);

        if (blockEnd !== -1) {
            index = blockEnd;
            continue;
        }
        if (scan.text[index] === '`') {
            index = pastCodeSpan(scan.text, index);
            continue;
        }
        if (!OPENER_CHARS.has(scan.text[index])) {
            index += 1;
            continue;
        }

        const end = spanEnd(scan, index);

        if (end === -1) return index;
        index = Math.max(end, index + 1);
    }

    return -1;
};

const partialTag = (text: string): number => {
    for (const tag of CUSTOM_TAGS) {
        for (let length = tag.length - 1; length > 0; length -= 1) {
            if (text.endsWith(tag.slice(0, length))) return text.length - length;
        }
    }

    return -1;
};

/** A delimiter the next delta may still complete must not be left showing either. */
const partialOpener = ({ text, ranges }: Scan): number => {
    const backslashes = TRAILING_BACKSLASHES.exec(text);
    const offset = backslashes === null ? partialTag(text) : backslashes.index;

    return offset === -1 || codeRangeEnd(ranges, offset) !== -1 ? -1 : offset;
};

const cutAt = (text: string, offsets: number[]): number => {
    const found = offsets.filter((offset) => offset !== -1);

    return found.length === 0 ? text.length : Math.min(...found);
};

/** `normalizeMathDelimiters` rewrites `\(`, `\[` and `[/math]` only once the closer exists, so until then the opener reads as an escaped bracket and its body renders as raw LaTeX. */
export const hideIncompleteMath = (text: string): string => {
    const scan: Scan = { text, ranges: collectCodeRanges(text) };

    return text.slice(0, cutAt(text, [unclosedOpener(scan), partialOpener(scan)]));
};
