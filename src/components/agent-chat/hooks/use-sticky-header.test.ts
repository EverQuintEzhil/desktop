import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import useStickyHeader from './use-sticky-header';

/**
 * The shadow under a sticky header has two very different scroll sources: the window
 * (page-height layouts) and an inner element (bounded-height layouts, where every
 * ancestor is `overflow-hidden` and therefore never reports a scrollTop).
 */
describe('useStickyHeader', () => {
    const mountContainer = (scrollableParent = false) => {
        const parent = document.createElement('div');

        if (scrollableParent) parent.style.overflowY = 'hidden';
        const container = document.createElement('div');

        parent.appendChild(container);
        document.body.appendChild(parent);

        return container;
    };

    // jsdom exposes pageYOffset as a read-only getter, so page scroll has to be faked.
    const setWindowScroll = (value: number) => {
        Object.defineProperty(window, 'pageYOffset', { value, configurable: true });
    };

    afterEach(() => {
        setWindowScroll(0);
        document.body.innerHTML = '';
    });

    it('follows window scroll when no scroll element is given', () => {
        const container = mountContainer();
        const { result } = renderHook(() => useStickyHeader({ current: container }));

        expect(result.current).toBe(false);

        act(() => {
            setWindowScroll(40);
            window.dispatchEvent(new Event('scroll'));
        });

        expect(result.current).toBe(true);
    });

    it('follows the given scroll element instead of an overflow-hidden ancestor', () => {
        const container = mountContainer(true);
        const scroller = document.createElement('div');

        document.body.appendChild(scroller);

        const { result } = renderHook(() =>
            useStickyHeader({ current: container }, { scrollRef: { current: scroller } }),
        );

        expect(result.current).toBe(false);

        act(() => {
            scroller.scrollTop = 24;
            scroller.dispatchEvent(new Event('scroll'));
        });

        expect(result.current).toBe(true);

        act(() => {
            scroller.scrollTop = 0;
            scroller.dispatchEvent(new Event('scroll'));
        });

        expect(result.current).toBe(false);
    });
});
