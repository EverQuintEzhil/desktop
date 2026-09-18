import { codeSpanEnd, type CodeRange, collectCodeRanges, runLength, startsAtFenceColumn } from './fence-scanner';

export type Span = { start: number; end: number };

const LONGER_RUN = 3;

const codeRangeEnd = (ranges: CodeRange[], index: number): number =>
    ranges.find((range) => range.start <= index && index < range.end)?.end ?? -1;

const pastCodeSpan = (text: string, index: number): number => {
    const end = codeSpanEnd(text, index);

    return end === -1 ? index + runLength(text, index, '`') : end;
};

/** micromark reads a `$${3,}` run as a fence carrying its own length, which the two-dollar pairing in `collectPairs` does not model. */
export const longerRunSpan = (text: string): Span | null => {
    const ranges = collectCodeRanges(text);
    let first = -1;
    let last = -1;
    let index = 0;

    while (index < text.length) {
        const blockEnd = codeRangeEnd(ranges, index);

        if (blockEnd !== -1) {
            index = blockEnd;
            continue;
        }
        if (text[index] === '`') {
            index = pastCodeSpan(text, index);
            continue;
        }
        if (text[index] !== '$') {
            index += 1;
            continue;
        }

        const length = runLength(text, index, '$');

        if (length >= LONGER_RUN) {
            if (startsAtFenceColumn(text, index)) return { start: 0, end: text.length };
            if (first === -1) first = index;
            last = index + length;
        }
        index += length;
    }

    return first === -1 ? null : { start: first, end: last };
};
