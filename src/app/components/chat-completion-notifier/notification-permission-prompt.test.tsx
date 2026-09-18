import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { envelope, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import type { ChatAgentType } from '@/types/admin';

import NotificationPermissionPrompt from './notification-permission-prompt';

const awayDuringRun = vi.hoisted(() => ({ current: true }));

// The banner only reads the flag; the sticky detection itself is covered by
// `src/app/hooks/use-away-during-run.test.ts` against a fake assistant-ui client.
vi.mock('@/app/hooks/use-away-during-run', () => ({
    useAwayDuringRun: () => awayDuringRun.current,
}));

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}));

const DISMISS_STORAGE_KEY = 'fluentmind-notification-prompt-dismissed';

const agent = { name: 'Aria' } as ChatAgentType;

const stubEnabled = (enabled: boolean): void => {
    server.use(
        respond('get', '/users/me', () =>
            envelope({
                _id: 'user-1',
                preferences: { notifications: { responseCompletion: enabled } },
            }),
        ),
    );
};

const renderPrompt = () => renderWithProviders(<NotificationPermissionPrompt agent={agent} />);

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

/** Registers a Permissions API stub and returns the listeners the hook subscribes with. */
const stubPermissions = (): Array<() => void> => {
    const listeners: Array<() => void> = [];
    const status = {
        addEventListener: (_type: string, listener: () => void) => listeners.push(listener),
        removeEventListener: vi.fn(),
    };

    Object.defineProperty(window.navigator, 'permissions', {
        configurable: true,
        value: { query: vi.fn().mockResolvedValue(status) },
    });

    return listeners;
};

const clearPermissions = () => {
    Reflect.deleteProperty(window.navigator, 'permissions');
};

const neverResolvingRequest = () => vi.fn(() => new Promise<NotificationPermission>(() => {}));

/**
 * Stubs an undecided permission whose request settles the way a real engine does: the live
 * Notification.permission is already updated when the promise resolves.
 */
const stubSettlingNotification = (outcome: NotificationPermission): NotificationStub => {
    const stub = stubNotification('default');

    stub.requestPermission = vi.fn(async () => {
        stub.permission = outcome;

        return outcome;
    });

    return stub;
};

const clickEnable = async () => {
    await userEvent.click(await screen.findByRole('button', { name: 'Enable' }));
};

describe('NotificationPermissionPrompt', () => {
    beforeEach(() => {
        window.localStorage.clear();
        clearPermissions();
        vi.mocked(toast.success).mockClear();
        awayDuringRun.current = true;
        stubEnabled(true);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        clearPermissions();
    });

    it('renders nothing when permission is already denied on mount', () => {
        stubNotification('denied');

        const { container } = renderPrompt();

        expect(container).toBeEmptyDOMElement();
    });

    it('renders nothing when permission is already granted on mount', () => {
        stubNotification('granted');

        const { container } = renderPrompt();

        expect(container).toBeEmptyDOMElement();
    });

    it('stays hidden on load when the user has not yet been away while a response was generating', () => {
        awayDuringRun.current = false;
        stubNotification('default');

        const { container } = renderPrompt();

        expect(container).toBeEmptyDOMElement();
    });

    it('appears once the user has been away while a response was generating', async () => {
        awayDuringRun.current = false;
        stubNotification('default');

        const { container, rerender } = renderPrompt();

        expect(container).toBeEmptyDOMElement();

        awayDuringRun.current = true;
        rerender(<NotificationPermissionPrompt agent={agent} />);

        expect(await screen.findByText(/Want to be notified when/)).toBeInTheDocument();
    });

    it('never appears when the setting is disabled', async () => {
        stubEnabled(false);
        stubNotification('default');

        const { container } = renderPrompt();

        await waitFor(() => expect(container).toBeEmptyDOMElement());
    });

    it('stays hidden while the profile is still loading, then hidden once it resolves opted-out', async () => {
        stubNotification('default');
        awayDuringRun.current = true;

        let resolveMe: (response: Response) => void = () => {};
        const mePending = new Promise<Response>((resolve) => {
            resolveMe = resolve;
        });

        server.use(respond('get', '/users/me', () => mePending));

        const { container } = renderPrompt();

        // Profile query is pending: `enabled` sits on its default (true), so without the
        // isLoaded gate the away-invite would flash here before the profile resolves.
        expect(container).toBeEmptyDOMElement();

        await act(async () => {
            resolveMe(
                envelope({
                    _id: 'user-1',
                    preferences: { notifications: { responseCompletion: false } },
                }),
            );

            await Promise.resolve();
        });

        // Resolves opted-out: the banner must stay hidden now that the profile is loaded.
        await waitFor(() => expect(container).toBeEmptyDOMElement());
    });

    it('invites the user to enable notifications when permission is undecided', async () => {
        stubNotification('default');

        renderPrompt();

        expect(await screen.findByText(/Want to be notified when/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Enable' })).toBeInTheDocument();
    });

    it('mounts the live region before there is anything to announce', async () => {
        stubNotification('default');

        renderPrompt();

        const liveRegion = await screen.findByRole('status');

        expect(liveRegion).toHaveAttribute('aria-live', 'polite');
        expect(liveRegion).toHaveTextContent(/Want to be notified when/);
    });

    it('shows address bar guidance immediately while the permission request is still pending', async () => {
        const requestPermission = neverResolvingRequest();

        stubNotification('default', requestPermission);

        renderPrompt();

        const liveRegion = await screen.findByRole('status');

        await clickEnable();

        expect(requestPermission).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('status')).toHaveTextContent(/address bar/i);
        expect(screen.getByRole('status')).toBe(liveRegion);
    });

    it('keeps the banner and explains how to unblock when the request is denied', async () => {
        stubSettlingNotification('denied');

        renderPrompt();

        await clickEnable();

        await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/blocked for this site/i));
        expect(screen.queryByRole('button', { name: 'Enable' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Dismiss notification prompt' })).toBeInTheDocument();
    });

    it('keeps the address bar guidance when the browser prompt is closed without a choice', async () => {
        stubNotification('default', vi.fn().mockResolvedValue('default'));

        renderPrompt();

        await clickEnable();

        await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/address bar/i));
        expect(screen.getByRole('button', { name: 'Enable' })).toBeInTheDocument();
    });

    it('removes the banner once permission is granted', async () => {
        stubSettlingNotification('granted');

        const { container } = renderPrompt();

        await clickEnable();

        await waitFor(() => expect(container).toBeEmptyDOMElement());
    });

    it('switches to the blocked copy when the request is denied outside the page while still pending', async () => {
        const stub = stubNotification('default', neverResolvingRequest());
        const listeners = stubPermissions();

        renderPrompt();

        await waitFor(() => expect(listeners).toHaveLength(1));

        await clickEnable();

        expect(screen.getByRole('status')).toHaveTextContent(/address bar/i);

        stub.permission = 'denied';

        act(() => {
            listeners.forEach((listener) => listener());
        });

        expect(screen.getByRole('status')).toHaveTextContent(/blocked for this site/i);
        expect(screen.queryByRole('button', { name: 'Enable' })).not.toBeInTheDocument();
    });

    it('returns to the address bar guidance when a blocked permission is reset outside the page', async () => {
        const stub = stubNotification('default', neverResolvingRequest());
        const listeners = stubPermissions();

        renderPrompt();

        await waitFor(() => expect(listeners).toHaveLength(1));

        await clickEnable();

        stub.permission = 'denied';

        act(() => {
            listeners.forEach((listener) => listener());
        });

        expect(screen.getByRole('status')).toHaveTextContent(/blocked for this site/i);

        stub.permission = 'default';

        act(() => {
            listeners.forEach((listener) => listener());
        });

        expect(screen.getByRole('status')).toHaveTextContent(/address bar/i);
        expect(screen.getByRole('button', { name: 'Enable' })).toBeInTheDocument();
    });

    it('confirms once when the request resolves as granted', async () => {
        stubSettlingNotification('granted');

        renderPrompt();

        await clickEnable();

        await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));

        await act(async () => {
            await Promise.resolve();
        });

        expect(toast.success).toHaveBeenCalledTimes(1);
    });

    it('confirms once when the grant arrives through the Permissions API without the request settling', async () => {
        const stub = stubNotification('default', neverResolvingRequest());
        const listeners = stubPermissions();

        const { container } = renderPrompt();

        await waitFor(() => expect(listeners).toHaveLength(1));

        await clickEnable();

        expect(toast.success).not.toHaveBeenCalled();

        stub.permission = 'granted';

        act(() => {
            listeners.forEach((listener) => listener());
        });

        expect(toast.success).toHaveBeenCalledTimes(1);
        expect(container).toBeEmptyDOMElement();
    });

    it('stays silent when notifications are granted externally without the banner being used', async () => {
        const stub = stubNotification('default');
        const listeners = stubPermissions();

        const { container } = renderPrompt();

        await waitFor(() => expect(listeners).toHaveLength(1));

        stub.permission = 'granted';

        act(() => {
            listeners.forEach((listener) => listener());
        });

        expect(toast.success).not.toHaveBeenCalled();
        expect(container).toBeEmptyDOMElement();
    });

    it('does not resurrect the banner when notifications are blocked after being granted', async () => {
        const stub = stubNotification('default', neverResolvingRequest());
        const listeners = stubPermissions();

        const { container } = renderPrompt();

        await waitFor(() => expect(listeners).toHaveLength(1));

        await clickEnable();

        stub.permission = 'granted';

        act(() => {
            listeners.forEach((listener) => listener());
        });

        expect(container).toBeEmptyDOMElement();

        stub.permission = 'denied';

        act(() => {
            listeners.forEach((listener) => listener());
        });

        expect(container).toBeEmptyDOMElement();
    });

    it('persists the dismissal when the invite is closed before any request', async () => {
        stubNotification('default');

        renderPrompt();

        await userEvent.click(await screen.findByRole('button', { name: 'Dismiss notification prompt' }));

        expect(window.localStorage.getItem(DISMISS_STORAGE_KEY)).toBe('true');
    });

    it('persists the dismissal when the guidance banner is closed with the request still pending', async () => {
        stubNotification('default', neverResolvingRequest());

        const { unmount } = renderPrompt();

        await clickEnable();

        expect(screen.getByRole('status')).toHaveTextContent(/address bar/i);

        await userEvent.click(screen.getByRole('button', { name: 'Dismiss notification prompt' }));

        expect(window.localStorage.getItem(DISMISS_STORAGE_KEY)).toBe('true');

        unmount();

        const { container } = renderPrompt();

        expect(container).toBeEmptyDOMElement();
    });

    it('does not persist the dismissal when the blocked banner is closed', async () => {
        const stub = stubSettlingNotification('denied');

        const { unmount } = renderPrompt();

        await clickEnable();

        await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/blocked for this site/i));

        await userEvent.click(screen.getByRole('button', { name: 'Dismiss notification prompt' }));

        expect(window.localStorage.getItem(DISMISS_STORAGE_KEY)).toBeNull();

        unmount();
        stub.permission = 'default';

        renderPrompt();

        expect(await screen.findByText(/Want to be notified when/)).toBeInTheDocument();
    });

    it('dismisses the blocked banner when the close button is used', async () => {
        stubSettlingNotification('denied');

        const { container } = renderPrompt();

        await clickEnable();

        await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/blocked for this site/i));

        await userEvent.click(screen.getByRole('button', { name: 'Dismiss notification prompt' }));

        expect(container).toBeEmptyDOMElement();
    });
});
