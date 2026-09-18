import { describe, expect, it } from 'vitest';

import { getLayoutWidth, getScrollbarWidth, measureLayoutWidth } from './masonry-view.utils';

const SCROLLBAR_WIDTH = 15;
const VIEWPORT_WIDTH = 1920;
// Independent of the `scrollbarWidth` argument on purpose: deriving it from that
// argument makes the two states identical whenever the gutter is 0, so the
// scrollbar-present branch would never be exercised.
const CLIENT_WIDTH_WITH_SCROLLBAR = VIEWPORT_WIDTH - SCROLLBAR_WIDTH;

const withScrollbar = (observedWidth: number, scrollbarWidth = SCROLLBAR_WIDTH) =>
    getLayoutWidth({
        observedWidth,
        viewportWidth: VIEWPORT_WIDTH,
        documentClientWidth: CLIENT_WIDTH_WITH_SCROLLBAR,
        scrollbarWidth,
        scrollsOnDocument: true,
    });

const withoutScrollbar = (observedWidth: number, scrollbarWidth = SCROLLBAR_WIDTH) =>
    getLayoutWidth({
        observedWidth,
        viewportWidth: VIEWPORT_WIDTH,
        documentClientWidth: VIEWPORT_WIDTH,
        scrollbarWidth,
        scrollsOnDocument: true,
    });

const fakeNode = (rectWidth: number, offsetWidth = 0) =>
    ({
        getBoundingClientRect: () => ({ width: rectWidth }) as DOMRect,
        offsetWidth,
    }) as unknown as HTMLElement;

describe('getLayoutWidth', () => {
    it('returns the observed width unchanged when the page scrollbar is present', () => {
        expect(withScrollbar(1873)).toBe(1873);
    });

    it('subtracts the scrollbar width when the page scrollbar is absent', () => {
        expect(withoutScrollbar(1888)).toBe(1873);
    });

    it('floors a fractional observed width once', () => {
        expect(withScrollbar(1873.45)).toBe(1873);
    });

    it('resolves both scrollbar states to the same integer for one layout', () => {
        const contentWidth = 1873.45;

        expect(withScrollbar(contentWidth)).toBe(withoutScrollbar(contentWidth + SCROLLBAR_WIDTH));
    });

    it('resolves both scrollbar states to the same integer across every fractional offset', () => {
        for (let fraction = 0; fraction < 1; fraction += 0.05) {
            const contentWidth = 1873 + fraction;

            expect(withScrollbar(contentWidth)).toBe(withoutScrollbar(contentWidth + SCROLLBAR_WIDTH));
        }
    });

    it('resolves both scrollbar states to the same integer for a fractional gutter', () => {
        const fractionalGutter = 15.45;
        const contentWidth = 1873.2;

        expect(
            getLayoutWidth({
                observedWidth: contentWidth,
                viewportWidth: VIEWPORT_WIDTH,
                documentClientWidth: VIEWPORT_WIDTH - fractionalGutter,
                scrollbarWidth: fractionalGutter,
                scrollsOnDocument: true,
            }),
        ).toBe(
            getLayoutWidth({
                observedWidth: contentWidth + fractionalGutter,
                viewportWidth: VIEWPORT_WIDTH,
                documentClientWidth: VIEWPORT_WIDTH,
                scrollbarWidth: fractionalGutter,
                scrollsOnDocument: true,
            }),
        );
    });

    it('is a no-op in both states when scrollbars are overlay', () => {
        expect(withScrollbar(1888, 0)).toBe(1888);
        expect(withoutScrollbar(1888, 0)).toBe(1888);
        // With a real gutter the present state is genuinely the untouched branch
        // and the absent state is not, so an inverted ternary cannot pass.
        expect(withScrollbar(1888)).toBe(1888);
        expect(withoutScrollbar(1888)).toBe(1873);
    });

    it('treats a delta below half the gutter as no scrollbar and still normalizes', () => {
        expect(
            getLayoutWidth({
                observedWidth: 1888,
                viewportWidth: VIEWPORT_WIDTH,
                documentClientWidth: VIEWPORT_WIDTH - 1,
                scrollbarWidth: SCROLLBAR_WIDTH,
                scrollsOnDocument: true,
            }),
        ).toBe(1873);
    });

    it('treats a delta of at least half the gutter as a visible scrollbar', () => {
        expect(
            getLayoutWidth({
                observedWidth: 1888,
                viewportWidth: VIEWPORT_WIDTH,
                documentClientWidth: VIEWPORT_WIDTH - 8,
                scrollbarWidth: SCROLLBAR_WIDTH,
                scrollsOnDocument: true,
            }),
        ).toBe(1888);
    });

    it('skips normalization when the grid does not scroll on the document', () => {
        expect(
            getLayoutWidth({
                observedWidth: 1381,
                viewportWidth: VIEWPORT_WIDTH,
                documentClientWidth: VIEWPORT_WIDTH,
                scrollbarWidth: SCROLLBAR_WIDTH,
                scrollsOnDocument: false,
            }),
        ).toBe(1381);
    });

    it('clamps at 0 instead of going negative', () => {
        expect(withoutScrollbar(10)).toBe(0);
    });
});

describe('measureLayoutWidth', () => {
    it('leaves the observed width alone when the document scroller shows a scrollbar', () => {
        expect(
            measureLayoutWidth(fakeNode(1873), {
                viewportWidth: VIEWPORT_WIDTH,
                documentClientWidth: CLIENT_WIDTH_WITH_SCROLLBAR,
                scrollbarWidth: SCROLLBAR_WIDTH,
                scrollParent: document.documentElement,
            }),
        ).toBe(1873);
    });

    it('reserves the gutter when the document scroller has no scrollbar', () => {
        expect(
            measureLayoutWidth(fakeNode(1888), {
                viewportWidth: VIEWPORT_WIDTH,
                documentClientWidth: VIEWPORT_WIDTH,
                scrollbarWidth: SCROLLBAR_WIDTH,
                scrollParent: document.documentElement,
            }),
        ).toBe(1873);
    });

    it('skips the gutter when the grid scrolls inside an element (admin console)', () => {
        expect(
            measureLayoutWidth(fakeNode(1381), {
                viewportWidth: VIEWPORT_WIDTH,
                documentClientWidth: VIEWPORT_WIDTH,
                scrollbarWidth: SCROLLBAR_WIDTH,
                scrollParent: document.createElement('div'),
            }),
        ).toBe(1381);
    });

    it('falls back to offsetWidth where rects are always 0', () => {
        expect(
            measureLayoutWidth(fakeNode(0, 1888), {
                viewportWidth: VIEWPORT_WIDTH,
                documentClientWidth: CLIENT_WIDTH_WITH_SCROLLBAR,
                scrollbarWidth: SCROLLBAR_WIDTH,
                scrollParent: document.documentElement,
            }),
        ).toBe(1888);
    });
});

describe('getScrollbarWidth', () => {
    it('reports 0 under jsdom and leaves no probe node behind', () => {
        const childCountBefore = document.body.childElementCount;

        expect(getScrollbarWidth()).toBe(0);
        expect(document.body.childElementCount).toBe(childCountBefore);
    });
});
