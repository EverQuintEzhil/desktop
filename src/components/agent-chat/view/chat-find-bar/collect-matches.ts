const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'svg', 'SVG']);

const INLINE_DISPLAYS = new Set(['inline', 'inline-block', 'inline-flex', 'ruby', 'contents']);

interface TextSlice {
    node: Text;
    /** Offset of this node's text within the concatenated haystack. */
    start: number;
}

/**
 * Nearest ancestor that starts a new visual line. Consecutive text nodes inside
 * the same block are concatenated without a separator so a phrase can match
 * across inline markup (`the **language** pair`); text in a different block gets
 * a separator so a phrase can never match across a paragraph boundary.
 */
const nearestBlock = (node: Text, cache: DisplayCache): Element | null => {
    let element = node.parentElement;

    while (element) {
        let isInline = cache.get(element);

        if (isInline === undefined) {
            isInline = INLINE_DISPLAYS.has(getComputedStyle(element).display);
            cache.set(element, isInline);
        }

        if (!isInline) return element;

        element = element.parentElement;
    }

    return null;
};

export interface FindIndex {
    text: string;
    slices: TextSlice[];
}

/**
 * Whether an element is inline, cached per element. `getComputedStyle` is a
 * forced style recalc, and a streaming thread rebuilds the index repeatedly, so
 * the answers are reused across rebuilds. Owned by the caller and discarded with
 * the search, which bounds how stale an entry can get.
 */
export type DisplayCache = WeakMap<Element, boolean>;

/**
 * Snapshot of every searchable text node under `root`. Built once per DOM
 * change rather than per keystroke — walking the thread is the expensive half.
 */
export const buildFindIndex = (root: HTMLElement, displayCache: DisplayCache = new WeakMap()): FindIndex => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                const element = node as HTMLElement;

                if (SKIP_TAGS.has(element.tagName)) return NodeFilter.FILTER_REJECT;
                if (element.hasAttribute('data-find-skip')) return NodeFilter.FILTER_REJECT;
                if (element.getAttribute('aria-hidden') === 'true') return NodeFilter.FILTER_REJECT;

                return NodeFilter.FILTER_SKIP;
            }

            return node.nodeValue ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        },
    });

    const slices: TextSlice[] = [];
    let text = '';
    let previousBlock: Element | null = null;
    let isFirst = true;

    let current = walker.nextNode();

    while (current) {
        const node = current as Text;
        const value = node.nodeValue ?? '';
        const block = nearestBlock(node, displayCache);

        if (!isFirst && block !== previousBlock) {
            text += '\n';
        }

        slices.push({ node, start: text.length });
        text += value;
        previousBlock = block;
        isFirst = false;
        current = walker.nextNode();
    }

    return { text, slices };
};

/** Index of the last slice whose range starts at or before `offset`. */
const sliceIndexAt = (slices: TextSlice[], offset: number): number => {
    let low = 0;
    let high = slices.length - 1;
    let found = 0;

    while (low <= high) {
        const mid = (low + high) >> 1;

        if (slices[mid].start <= offset) {
            found = mid;
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }

    return found;
};

const toRange = (slices: TextSlice[], from: number, to: number): Range | null => {
    const startIndex = sliceIndexAt(slices, from);
    const endIndex = sliceIndexAt(slices, to - 1);
    const startSlice = slices[startIndex];
    const endSlice = slices[endIndex];

    if (!startSlice || !endSlice) return null;

    const startOffset = from - startSlice.start;
    const endOffset = to - endSlice.start;

    // A match that begins inside a block separator has no backing text node.
    if (startOffset < 0 || startOffset > (startSlice.node.nodeValue?.length ?? 0)) return null;
    if (endOffset < 0 || endOffset > (endSlice.node.nodeValue?.length ?? 0)) return null;

    const range = document.createRange();

    range.setStart(startSlice.node, startOffset);
    range.setEnd(endSlice.node, endOffset);

    return range;
};

const escapeForRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Every case-insensitive occurrence of `query` in a prebuilt index, in document order. */
export const matchesInIndex = ({ text, slices }: FindIndex, query: string): Range[] => {
    if (!query.trim()) return [];

    // Matching runs against the original text, not a lowercased copy: JS
    // case-folding is not length-preserving ('İ'.toLowerCase() is two chars), so
    // a lowercased haystack would shift every offset after such a character and
    // silently drop or misplace later matches.
    const pattern = new RegExp(escapeForRegExp(query), 'gi');
    const ranges: Range[] = [];

    for (const match of text.matchAll(pattern)) {
        if (match.index === undefined || match[0].length === 0) continue;

        const range = toRange(slices, match.index, match.index + match[0].length);

        if (range) ranges.push(range);
    }

    return ranges;
};

/** Convenience for one-shot searches: build the index and match in one call. */
export const collectFindMatches = (root: HTMLElement, query: string): Range[] =>
    matchesInIndex(buildFindIndex(root), query);
