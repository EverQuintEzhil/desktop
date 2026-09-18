import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useNotificationPermission } from './use-notification-permission';

const DISMISS_STORAGE_KEY = 'fluentmind-notification-prompt-dismissed';

interface NotificationStub {
    permission: NotificationPermission;
    requestPermission: ReturnType<typeof vi.fn>;
}

const stubNotification = (permission: NotificationPermission, requestPermission = vi.fn()): NotificationStub => {
    const stub: NotificationStub = {
        permission,
        requestPermission,
    };

    vi.stubGlobal('Notification', stub);

    return stub;
};

/**
 * Real engines have already updated Notification.permission by the time requestPermission()
 * settles, and a superseded call resolves 'default' whatever the user actually chose — so the
 * live permission and the resolved value are set independently here.
 */
const settlingRequest = (
    stub: NotificationStub,
    livePermission: NotificationPermission,
    resolvedValue = livePermission,
) =>
    vi.fn(async () => {
        stub.permission = livePermission;

        return resolvedValue;
    });

type PermissionsStub = { query: ReturnType<typeof vi.fn> } | undefined;

const stubPermissions = (permissions: PermissionsStub) => {
    Object.defineProperty(window.navigator, 'permissions', {
        configurable: true,
        value: permissions,
    });
};

const clearPermissions = () => {
    Reflect.deleteProperty(window.navigator, 'permissions');
};

describe('useNotificationPermission', () => {
    beforeEach(() => {
        window.localStorage.clear();
        clearPermissions();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        clearPermissions();
    });

    it('can prompt when permission is default and the prompt has not been dismissed', () => {
        stubNotification('default');

        const { result } = renderHook(() => useNotificationPermission());

        expect(result.current.canPrompt).toBe(true);
        expect(result.current.permission).toBe('default');
    });

    it('cannot prompt when permission is already granted', () => {
        stubNotification('granted');

        const { result } = renderHook(() => useNotificationPermission());

        expect(result.current.canPrompt).toBe(false);
    });

    it('cannot prompt when permission is denied', () => {
        stubNotification('denied');

        const { result } = renderHook(() => useNotificationPermission());

        expect(result.current.canPrompt).toBe(false);
    });

    it('cannot prompt once dismissed, and persists the dismissal', () => {
        stubNotification('default');

        const { result } = renderHook(() => useNotificationPermission());

        act(() => {
            result.current.dismiss();
        });

        expect(result.current.canPrompt).toBe(false);
        expect(window.localStorage.getItem(DISMISS_STORAGE_KEY)).toBe('true');
    });

    it('requests permission and updates state from the result', async () => {
        const stub = stubNotification('default');

        stub.requestPermission = settlingRequest(stub, 'granted');

        const { result } = renderHook(() => useNotificationPermission());

        await act(async () => {
            await result.current.request();
        });

        expect(stub.requestPermission).toHaveBeenCalledTimes(1);
        expect(result.current.canPrompt).toBe(false);
    });

    it('adopts the live permission when a superseded request resolves default after a grant', async () => {
        const stub = stubNotification('default');

        stub.requestPermission = settlingRequest(stub, 'granted', 'default');

        const { result } = renderHook(() => useNotificationPermission());

        let resolved: string | undefined;

        await act(async () => {
            resolved = await result.current.request();
        });

        expect(resolved).toBe('granted');
        expect(result.current.permission).toBe('granted');
        expect(result.current.canPrompt).toBe(false);
    });

    it('resolves request() to the resulting permission state', async () => {
        const stub = stubNotification('default');

        stub.requestPermission = settlingRequest(stub, 'denied');

        const { result } = renderHook(() => useNotificationPermission());

        let resolved: string | undefined;

        await act(async () => {
            resolved = await result.current.request();
        });

        expect(resolved).toBe('denied');
        expect(result.current.permission).toBe('denied');
    });

    it('resolves request() to the current permission when requestPermission rejects', async () => {
        const stub = stubNotification('default', vi.fn().mockRejectedValue(new Error('nope')));

        const { result } = renderHook(() => useNotificationPermission());

        stub.permission = 'denied';

        let resolved: string | undefined;

        await act(async () => {
            resolved = await result.current.request();
        });

        expect(resolved).toBe('denied');
    });

    it('resolves request() to unsupported when the Notification API is missing', async () => {
        vi.stubGlobal('Notification', undefined);

        const { result } = renderHook(() => useNotificationPermission());

        let resolved: string | undefined;

        await act(async () => {
            resolved = await result.current.request();
        });

        expect(resolved).toBe('unsupported');
        expect(result.current.canPrompt).toBe(false);
    });

    it('syncs permission when the Permissions API reports an external change', async () => {
        const stub = stubNotification('default');
        const listeners: Array<() => void> = [];
        const status = {
            addEventListener: (_type: string, listener: () => void) => listeners.push(listener),
            removeEventListener: vi.fn(),
        };

        stubPermissions({ query: vi.fn().mockResolvedValue(status) });

        const { result } = renderHook(() => useNotificationPermission());

        await waitFor(() => expect(listeners).toHaveLength(1));

        stub.permission = 'granted';

        act(() => {
            listeners.forEach((listener) => listener());
        });

        expect(result.current.permission).toBe('granted');
        expect(result.current.canPrompt).toBe(false);
    });

    it('unsubscribes the exact listener it registered on unmount', async () => {
        stubNotification('default');

        const addEventListener = vi.fn();
        const removeEventListener = vi.fn();

        stubPermissions({ query: vi.fn().mockResolvedValue({ addEventListener, removeEventListener }) });

        const { unmount } = renderHook(() => useNotificationPermission());

        await waitFor(() => expect(addEventListener).toHaveBeenCalledTimes(1));

        unmount();

        expect(removeEventListener).toHaveBeenCalledTimes(1);
        expect(removeEventListener.mock.calls[0][0]).toBe('change');
        expect(removeEventListener.mock.calls[0][1]).toBe(addEventListener.mock.calls[0][1]);
    });

    it('never subscribes when the hook unmounts before the permissions query resolves', async () => {
        stubNotification('default');

        const addEventListener = vi.fn();
        let resolveQuery: ((status: unknown) => void) | undefined;

        stubPermissions({
            query: vi.fn(
                () =>
                    new Promise((resolve) => {
                        resolveQuery = resolve;
                    }),
            ),
        });

        const { unmount } = renderHook(() => useNotificationPermission());

        unmount();

        await act(async () => {
            resolveQuery?.({ addEventListener, removeEventListener: vi.fn() });

            await Promise.resolve();
        });

        expect(addEventListener).not.toHaveBeenCalled();
    });

    it('degrades gracefully when navigator.permissions is unavailable', () => {
        stubNotification('default');
        stubPermissions(undefined);

        const { result } = renderHook(() => useNotificationPermission());

        expect(result.current.canPrompt).toBe(true);
    });

    it('degrades gracefully when the permissions query rejects, without an unhandled rejection', async () => {
        stubNotification('default');
        stubPermissions({ query: vi.fn().mockRejectedValue(new Error('unsupported permission name')) });

        const onUnhandledRejection = vi.fn();

        process.on('unhandledRejection', onUnhandledRejection);

        const { result } = renderHook(() => useNotificationPermission());

        await act(async () => {
            await new Promise((resolve) => {
                setTimeout(resolve, 0);
            });
        });

        process.off('unhandledRejection', onUnhandledRejection);

        expect(onUnhandledRejection).not.toHaveBeenCalled();
        expect(result.current.canPrompt).toBe(true);
    });

    it('re-reads the permission when the window regains focus', async () => {
        const stub = stubNotification('default');

        const { result } = renderHook(() => useNotificationPermission());

        stub.permission = 'granted';

        act(() => {
            window.dispatchEvent(new Event('focus'));
        });

        await waitFor(() => expect(result.current.permission).toBe('granted'));
        expect(result.current.canPrompt).toBe(false);
    });

    it('re-reads the permission when the document becomes visible again', async () => {
        const stub = stubNotification('default');

        const { result } = renderHook(() => useNotificationPermission());

        stub.permission = 'denied';

        act(() => {
            document.dispatchEvent(new Event('visibilitychange'));
        });

        await waitFor(() => expect(result.current.permission).toBe('denied'));
    });
});
