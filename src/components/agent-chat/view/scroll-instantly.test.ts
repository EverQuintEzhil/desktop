import { describe, expect, it, vi } from 'vitest';

import { scrollInstantly } from './scroll-instantly';

const viewport = (scrollTop: number): HTMLDivElement => {
    const element = document.createElement('div');

    document.body.append(element);
    element.scrollTop = scrollTop;

    return element;
};

describe('scrollInstantly', () => {
    // The assignment dispatches its scroll event synchronously, so a caller that
    // arms a skip-the-next-event flag afterwards arms it too late.
    it('announces the scroll before writing it', () => {
        const element = viewport(500);
        let scrollTopWhenAnnounced = -1;

        const moved = scrollInstantly(element, 0, {
            onBeforeScroll: () => {
                scrollTopWhenAnnounced = element.scrollTop;
            },
        });

        expect(scrollTopWhenAnnounced).toBe(500);
        expect(element.scrollTop).toBe(0);
        expect(moved).toBe(true);
    });

    it('says nothing when the target is where the viewport already is', () => {
        const element = viewport(320);
        const onBeforeScroll = vi.fn();

        expect(scrollInstantly(element, 320, { onBeforeScroll })).toBe(false);
        expect(onBeforeScroll).not.toHaveBeenCalled();
    });

    it('takes the announcement back when the write is clamped to a no-op', () => {
        const element = viewport(0);

        // Stands in for a viewport that cannot scroll: the write is accepted and
        // clamped away, so no scroll event ever arrives to consume the flag.
        Object.defineProperty(element, 'scrollTop', { get: () => 0, set: () => {}, configurable: true });

        const onBeforeScroll = vi.fn();
        const onScrollSkipped = vi.fn();

        expect(scrollInstantly(element, 900, { onBeforeScroll, onScrollSkipped })).toBe(false);
        expect(onBeforeScroll).toHaveBeenCalledOnce();
        expect(onScrollSkipped).toHaveBeenCalledOnce();
    });

    it('never scrolls above the top', () => {
        const element = viewport(200);

        scrollInstantly(element, -400);

        expect(element.scrollTop).toBe(0);
    });
});
