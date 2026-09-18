import { act } from '@testing-library/react';
import { vi } from 'vitest';

/**
 * setup.ts stubs `matchMedia` to report `matches: false` for every query. This stand-in evaluates
 * `min-width` / `max-width` queries against a controllable window width and fires change listeners
 * when it moves, so layout that keys off a breakpoint can be exercised in jsdom.
 */
export const installWidthAwareMatchMedia = (initialWidth = 1600) => {
    let windowWidth = initialWidth;
    const listeners = new Set<() => void>();

    const queryMatches = (query: string): boolean => {
        const min = /\(min-width:\s*(\d+)px\)/.exec(query);

        if (min) return windowWidth >= Number(min[1]);

        const max = /\(max-width:\s*(\d+)px\)/.exec(query);

        if (max) return windowWidth <= Number(max[1]);

        return false;
    };

    vi.mocked(window.matchMedia).mockImplementation(
        (query: string) =>
            ({
                get matches() {
                    return queryMatches(query);
                },
                media: query,
                onchange: null,
                addListener: vi.fn(),
                removeListener: vi.fn(),
                addEventListener: (_: string, listener: () => void) => listeners.add(listener),
                removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
                dispatchEvent: vi.fn(),
            }) as unknown as MediaQueryList,
    );

    const setWindowWidth = (width: number) => {
        windowWidth = width;
        Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
        act(() => {
            listeners.forEach((listener) => listener());
        });
    };

    setWindowWidth(initialWidth);

    return { setWindowWidth, reset: () => setWindowWidth(initialWidth) };
};
