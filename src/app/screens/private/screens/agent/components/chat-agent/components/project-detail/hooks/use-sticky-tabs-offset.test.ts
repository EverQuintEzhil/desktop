import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useStickyTabsOffset } from './use-sticky-tabs-offset';

const TABS_HEIGHT_VAR = '--space-tabs-h';

/**
 * The global ResizeObserver stub records observe() without ever running the callback, so the
 * measurement never fires. Swap in one that behaves like the real thing: runs on observe(), and
 * again whenever a test calls trigger().
 */
const observerCallbacks: ResizeObserverCallback[] = [];

class ImmediateResizeObserver {
    private readonly callback: ResizeObserverCallback;

    constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
        observerCallbacks.push(callback);
    }

    observe = () => {
        this.callback([], this as unknown as ResizeObserver);
    };

    unobserve = vi.fn();

    disconnect = () => {
        const index = observerCallbacks.indexOf(this.callback);

        if (index >= 0) observerCallbacks.splice(index, 1);
    };
}

const trigger = () => {
    for (const callback of [...observerCallbacks]) {
        callback([], {} as ResizeObserver);
    }
};

const elementOfHeight = (height: number) => {
    const el = document.createElement('div');

    el.getBoundingClientRect = () => ({
        height,
        bottom: height,
        top: 0,
        left: 0,
        right: 0,
        width: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
    });

    return el;
};

beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ImmediateResizeObserver);
});

afterEach(() => {
    observerCallbacks.length = 0;
    vi.unstubAllGlobals();
});

describe('useStickyTabsOffset', () => {
    it('publishes the bar height on the region', () => {
        const region = document.createElement('div');
        const bar = elementOfHeight(41);

        renderHook(() => useStickyTabsOffset({ current: region }, { current: bar }, true));

        expect(region.style.getPropertyValue(TABS_HEIGHT_VAR)).toBe('41px');
    });

    it('floors a fractional height so no hairline gap opens above the search bar', () => {
        const region = document.createElement('div');
        const bar = elementOfHeight(40.6);

        renderHook(() => useStickyTabsOffset({ current: region }, { current: bar }, true));

        expect(region.style.getPropertyValue(TABS_HEIGHT_VAR)).toBe('40px');
    });

    it('remeasures when the bar wraps to a second row', () => {
        const region = document.createElement('div');
        let height = 41;
        const bar = document.createElement('div');

        bar.getBoundingClientRect = () => ({
            height,
            bottom: height,
            top: 0,
            left: 0,
            right: 0,
            width: 0,
            x: 0,
            y: 0,
            toJSON: () => ({}),
        });

        renderHook(() => useStickyTabsOffset({ current: region }, { current: bar }, true));

        expect(region.style.getPropertyValue(TABS_HEIGHT_VAR)).toBe('41px');

        height = 69;
        trigger();

        expect(region.style.getPropertyValue(TABS_HEIGHT_VAR)).toBe('69px');
    });

    it('measures once the space finishes loading, not only on the first render', () => {
        const region = document.createElement('div');
        const bar = elementOfHeight(41);
        const refs = { region: { current: region }, bar: { current: null as HTMLDivElement | null } };

        const { rerender } = renderHook(
            ({ ready }: { ready: boolean }) => useStickyTabsOffset(refs.region, refs.bar, ready),
            { initialProps: { ready: false } },
        );

        expect(region.style.getPropertyValue(TABS_HEIGHT_VAR)).toBe('');

        refs.bar.current = bar;
        rerender({ ready: true });

        expect(region.style.getPropertyValue(TABS_HEIGHT_VAR)).toBe('41px');
    });

    it('drops the variable on unmount', () => {
        const region = document.createElement('div');
        const bar = elementOfHeight(41);

        const { unmount } = renderHook(() => useStickyTabsOffset({ current: region }, { current: bar }, true));

        unmount();

        expect(region.style.getPropertyValue(TABS_HEIGHT_VAR)).toBe('');
    });
});
