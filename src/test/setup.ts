import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { toast } from 'sonner';
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';

import { server } from './msw/server';

/**
 * Neither `onUnhandledRequest: 'error'` nor throwing from the callback fails a
 * test: MSW turns both into a rejected request, and a component that catches it
 * simply renders an error state while the test stays green. Recording the misses
 * and asserting on them in `afterEach` is what actually makes a missing stub loud.
 */
configure({ asyncUtilTimeout: 5000 });

const unhandledRequests: string[] = [];

// Cleared at the start of each test as well as the end: a streaming test can
// leave a request in flight past its own teardown, and without this the late
// arrival is attributed to whichever test happens to be running next.
beforeEach(() => {
    unhandledRequests.length = 0;
});

beforeAll(() => {
    server.listen({
        onUnhandledRequest: (request) => {
            unhandledRequests.push(`${request.method} ${request.url}`);
        },
    });
});

afterEach(() => {
    cleanup();

    // `sonner` keeps its toast store in a module singleton that outlives unmount, and since 2.0.8
    // a freshly mounted `<Toaster />` replays every still-active toast — so an undismissed toast
    // reappears in the next test unless it is dismissed here.
    toast.dismiss();

    server.resetHandlers();
    vi.mocked(window.scrollTo).mockClear();

    if (unhandledRequests.length > 0) {
        const missed = unhandledRequests.join('\n  ');

        unhandledRequests.length = 0;

        throw new Error(`Unhandled request(s) — add an MSW handler:\n  ${missed}`);
    }
});

afterAll(() => {
    server.close();
});

Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

// jsdom has no layout, so window.scrollTo only logs a "Not implemented" error.
Object.defineProperty(window, 'scrollTo', { writable: true, value: vi.fn() });

class ResizeObserverMock {
    observe = vi.fn();

    unobserve = vi.fn();

    disconnect = vi.fn();
}

class IntersectionObserverMock {
    root = null;

    rootMargin = '';

    thresholds: number[] = [];

    observe = vi.fn();

    unobserve = vi.fn();

    disconnect = vi.fn();

    takeRecords = vi.fn(() => []);
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock);
vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);
