import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAwayDuringRun } from './use-away-during-run';

type RunEvent = 'thread.runStart' | 'thread.runEnd';

const auiRef = vi.hoisted(() => ({ current: null as unknown }));

vi.mock('@assistant-ui/react', () => ({
    useAui: () => auiRef.current,
}));

const createFakeAui = () => {
    const listeners: Record<RunEvent, Array<() => void>> = {
        'thread.runStart': [],
        'thread.runEnd': [],
    };
    const state = { isRunning: false };
    let unsubscribeCount = 0;

    const aui = {
        on: (event: RunEvent, handler: () => void) => {
            listeners[event].push(handler);

            return () => {
                unsubscribeCount += 1;
                listeners[event] = listeners[event].filter((entry) => entry !== handler);
            };
        },
        thread: { getState: () => state },
    };

    return {
        aui,
        state,
        emit: (event: RunEvent) => {
            state.isRunning = event === 'thread.runStart';

            act(() => {
                [...listeners[event]].forEach((handler) => handler());
            });
        },
        getUnsubscribeCount: () => unsubscribeCount,
    };
};

let fakeAui: ReturnType<typeof createFakeAui>;
let isAway = false;

const goAway = (): void => {
    isAway = true;
};

const comeBack = (): void => {
    isAway = false;
};

const fireVisibilityChange = (): void => {
    act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
    });
};

const fireBlur = (): void => {
    act(() => {
        window.dispatchEvent(new Event('blur'));
    });
};

describe('useAwayDuringRun', () => {
    beforeEach(() => {
        isAway = false;
        fakeAui = createFakeAui();
        auiRef.current = fakeAui.aui;

        Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            get: () => (isAway ? 'hidden' : 'visible'),
        });

        vi.spyOn(document, 'hasFocus').mockImplementation(() => !isAway);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('starts false', () => {
        const { result } = renderHook(() => useAwayDuringRun());

        expect(result.current).toBe(false);
    });

    it('stays false when the tab is hidden with no run in progress', () => {
        const { result } = renderHook(() => useAwayDuringRun());

        goAway();
        fireVisibilityChange();

        expect(result.current).toBe(false);
    });

    it('stays false when a run finishes with the tab in the foreground', () => {
        const { result } = renderHook(() => useAwayDuringRun());

        fakeAui.emit('thread.runStart');
        fakeAui.emit('thread.runEnd');

        expect(result.current).toBe(false);
    });

    it('turns true when the tab is hidden during a run', () => {
        const { result } = renderHook(() => useAwayDuringRun());

        fakeAui.emit('thread.runStart');
        goAway();
        fireVisibilityChange();

        expect(result.current).toBe(true);
    });

    it('stays false on a blur while the tab is still visible during a run', () => {
        const { result } = renderHook(() => useAwayDuringRun());

        fakeAui.emit('thread.runStart');
        // Focus left the tab (address bar / DevTools) but the tab is still visible: the invite
        // must not fire on an in-tab focus change.
        fireBlur();

        expect(result.current).toBe(false);
    });

    it('turns true when a run starts while the tab is already away', () => {
        const { result } = renderHook(() => useAwayDuringRun());

        goAway();
        fireVisibilityChange();

        expect(result.current).toBe(false);

        fakeAui.emit('thread.runStart');

        expect(result.current).toBe(true);
    });

    it('turns true when a run is already in progress and the tab already away at mount', () => {
        fakeAui.state.isRunning = true;
        isAway = true;

        const { result } = renderHook(() => useAwayDuringRun());

        expect(result.current).toBe(true);
    });

    it('stays false at mount when a run is in progress but the tab is in the foreground', () => {
        fakeAui.state.isRunning = true;

        const { result } = renderHook(() => useAwayDuringRun());

        expect(result.current).toBe(false);
    });

    it('stays true after the run ends and the user comes back', () => {
        const { result } = renderHook(() => useAwayDuringRun());

        fakeAui.emit('thread.runStart');
        goAway();
        fireVisibilityChange();
        fakeAui.emit('thread.runEnd');
        comeBack();
        fireVisibilityChange();

        expect(result.current).toBe(true);
    });

    it('stops listening once unmounted', () => {
        const { result, unmount } = renderHook(() => useAwayDuringRun());

        fakeAui.emit('thread.runStart');
        unmount();

        expect(fakeAui.getUnsubscribeCount()).toBe(2);

        goAway();
        fireVisibilityChange();

        expect(result.current).toBe(false);
    });
});
