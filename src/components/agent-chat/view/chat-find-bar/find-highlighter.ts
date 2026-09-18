const ALL_MATCHES = 'fm-find-match';
const CURRENT_MATCH = 'fm-find-current';

interface HighlightRegistry {
    set: (name: string, highlight: unknown) => void;
    delete: (name: string) => void;
}

type HighlightConstructor = new () => HighlightSet;

interface HighlightSet {
    add: (range: Range) => void;
}

/**
 * Painting matches with the CSS Custom Highlight API instead of wrapping them in
 * `<mark>` keeps React's DOM untouched, so highlights cannot be clobbered by a
 * re-render or fight the streaming message tree. Baseline since March 2026;
 * where it is missing, find still counts and scrolls, just without the paint.
 */
const registry = (): HighlightRegistry | null => {
    const highlights = (CSS as unknown as { highlights?: HighlightRegistry }).highlights;

    return highlights && typeof Highlight !== 'undefined' ? highlights : null;
};

export const isHighlightPaintSupported = (): boolean => registry() !== null;

// Added one at a time rather than spread into the constructor: a common word in a
// long conversation produces more ranges than an argument list can hold.
const build = (ranges: Range[]): HighlightSet => {
    const HighlightCtor = Highlight as unknown as HighlightConstructor;
    const highlight = new HighlightCtor();

    for (const range of ranges) highlight.add(range);

    return highlight;
};

export const paintFindHighlights = (matches: Range[], current: Range | null): void => {
    const highlights = registry();

    if (!highlights) return;

    const others = current ? matches.filter((range) => range !== current) : matches;

    if (others.length > 0) {
        highlights.set(ALL_MATCHES, build(others));
    } else {
        highlights.delete(ALL_MATCHES);
    }

    if (current) {
        highlights.set(CURRENT_MATCH, build([current]));
    } else {
        highlights.delete(CURRENT_MATCH);
    }
};

export const clearFindHighlights = (): void => {
    const highlights = registry();

    if (!highlights) return;

    highlights.delete(ALL_MATCHES);
    highlights.delete(CURRENT_MATCH);
};
