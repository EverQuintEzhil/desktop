import { act, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useNotificationPreference } from '@/hooks/use-notification-preference';
import { apiUrl, envelope, respond, server } from '@/test/msw';
import { renderHookWithProviders } from '@/test/test-utils';

import { useCompletionNotification } from './use-completion-notification';

type RunEvent = 'thread.runStart' | 'thread.runEnd';

interface FakeMessage {
    id: string;
    role: 'user' | 'assistant';
    content: Array<{ type: 'text'; text: string }>;
}

const AGENT_NAME = 'Aria';

const auiRef = vi.hoisted(() => ({ current: null as unknown }));

vi.mock('@assistant-ui/react', () => ({
    useAui: () => auiRef.current,
}));

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}));

const createFakeAui = () => {
    const listeners: Record<RunEvent, Array<() => void>> = {
        'thread.runStart': [],
        'thread.runEnd': [],
    };
    const state = { isRunning: false, messages: [] as FakeMessage[] };
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

interface NotificationCall {
    title: string;
    body?: string;
    tag?: string;
    data?: unknown;
}

const notificationCalls: NotificationCall[] = [];

class FakeNotification {
    static permission: NotificationPermission = 'granted';

    onclick: (() => void) | null = null;

    close = vi.fn();

    constructor(title: string, options?: NotificationOptions) {
        notificationCalls.push({
            title,
            body: options?.body,
            tag: options?.tag,
            data: options?.data,
        });
    }
}

/** Delivery is async (the service-worker probe awaits), so a "stays silent" assertion has to outlast it. */
const flushDelivery = async (): Promise<void> => {
    await act(async () => {});
};

let fakeAui: ReturnType<typeof createFakeAui>;
let isAway = false;

const makeProfile = (enabled: boolean) => ({
    _id: 'user-1',
    preferences: { notifications: { responseCompletion: enabled } },
});

interface UpdateBody {
    preferences?: { notifications?: { responseCompletion?: boolean } };
}

/** Serves `/users/me` from a mutable flag so a write is reflected by the refetch that follows it. */
const stubAccount = (initialEnabled: boolean) => {
    const stored = { enabled: initialEnabled };

    server.use(respond('get', '/users/me', () => envelope(makeProfile(stored.enabled))));
    server.use(
        http.put(apiUrl('/users/me'), async ({ request }) => {
            const body = (await request.json()) as UpdateBody;

            stored.enabled = body.preferences?.notifications?.responseCompletion ?? stored.enabled;

            return envelope(makeProfile(stored.enabled));
        }),
    );

    return stored;
};

const assistantMessage = (text: string): FakeMessage => ({
    id: 'assistant-1',
    role: 'assistant',
    content: [{ type: 'text', text }],
});

const renderNotifier = async (enabled: boolean) => {
    stubAccount(enabled);

    const rendered = renderHookWithProviders(() => {
        useCompletionNotification(AGENT_NAME);

        return useNotificationPreference();
    });

    // `enabled` defaults to `true` while the profile loads, so waiting on it alone would race a
    // false expectation past the pending state. Wait for the pref to actually be loaded.
    await waitFor(() => {
        expect(rendered.result.current.isLoaded).toBe(true);
        expect(rendered.result.current.enabled).toBe(enabled);
    });

    return rendered;
};

/** Runs one turn end to end, leaving a brand new assistant message behind. */
const runTurn = ({ away }: { away: boolean }): void => {
    isAway = away;
    fakeAui.emit('thread.runStart');
    fakeAui.state.messages = [assistantMessage('The report is ready.')];
    fakeAui.emit('thread.runEnd');
};

describe('useCompletionNotification', () => {
    beforeEach(() => {
        isAway = false;
        notificationCalls.length = 0;
        fakeAui = createFakeAui();
        auiRef.current = fakeAui.aui;

        FakeNotification.permission = 'granted';
        vi.stubGlobal('Notification', FakeNotification);

        Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            get: () => (isAway ? 'hidden' : 'visible'),
        });

        vi.spyOn(document, 'hasFocus').mockImplementation(() => !isAway);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('notifies when enabled and the tab was away during the run', async () => {
        await renderNotifier(true);

        runTurn({ away: true });

        await waitFor(() =>
            expect(notificationCalls).toEqual([
                {
                    title: AGENT_NAME,
                    body: 'The report is ready.',
                    tag: 'fluentmind-chat-completion',
                    data: { url: window.location.href },
                },
            ]),
        );
    });

    it('stays silent when enabled but the tab was in the foreground throughout', async () => {
        await renderNotifier(true);

        runTurn({ away: false });
        await flushDelivery();

        expect(notificationCalls).toHaveLength(0);
    });

    it('stays silent when disabled even though the tab was away', async () => {
        await renderNotifier(false);

        runTurn({ away: true });
        await flushDelivery();

        expect(notificationCalls).toHaveLength(0);
    });

    it('stays silent when disabled and the tab was focused', async () => {
        await renderNotifier(false);

        runTurn({ away: false });
        await flushDelivery();

        expect(notificationCalls).toHaveLength(0);
    });

    it('stays silent when the run produced no new assistant message', async () => {
        await renderNotifier(true);

        isAway = true;
        fakeAui.state.messages = [assistantMessage('Answered a while ago.')];
        fakeAui.emit('thread.runStart');
        fakeAui.emit('thread.runEnd');
        await flushDelivery();

        expect(notificationCalls).toHaveLength(0);
    });

    it('follows an enabled change made between runs', async () => {
        const { result } = await renderNotifier(false);

        act(() => {
            result.current.setEnabled(true);
        });

        await waitFor(() => expect(result.current.enabled).toBe(true));

        runTurn({ away: true });

        await waitFor(() => expect(notificationCalls).toHaveLength(1));
    });

    it('stays silent when the tab was away mid-run but is back in the foreground at the end', async () => {
        await renderNotifier(true);

        isAway = true;
        fakeAui.emit('thread.runStart');

        isAway = false;

        act(() => {
            document.dispatchEvent(new Event('visibilitychange'));
        });

        fakeAui.state.messages = [assistantMessage('The report is ready.')];
        fakeAui.emit('thread.runEnd');
        await flushDelivery();

        expect(notificationCalls).toHaveLength(0);
    });

    it('reads the setting live without re-subscribing mid-run', async () => {
        const { result } = await renderNotifier(false);

        isAway = true;
        fakeAui.emit('thread.runStart');

        act(() => {
            result.current.setEnabled(true);
        });

        await waitFor(() => expect(result.current.enabled).toBe(true));

        fakeAui.state.messages = [assistantMessage('The report is ready.')];
        fakeAui.emit('thread.runEnd');

        await waitFor(() => expect(notificationCalls).toHaveLength(1));
        expect(fakeAui.getUnsubscribeCount()).toBe(0);
    });

    it('does not notify on a run that ends before the stored preference has loaded, then honours it once loaded', async () => {
        let releaseGet: ((enabled: boolean) => void) | undefined;

        // GET stays pending so `enabled` sits on its default (true) with `isLoaded` still false
        // when the first run ends. An opt-out user must not be notified on that default.
        server.use(
            respond(
                'get',
                '/users/me',
                () =>
                    new Promise<Response>((resolve) => {
                        releaseGet = (enabled: boolean) => resolve(envelope(makeProfile(enabled)));
                    }),
            ),
        );

        const rendered = renderHookWithProviders(() => {
            useCompletionNotification(AGENT_NAME);

            return useNotificationPreference();
        });

        await waitFor(() => expect(releaseGet).toBeDefined());
        expect(rendered.result.current.isLoaded).toBe(false);

        runTurn({ away: true });
        await flushDelivery();

        expect(notificationCalls).toHaveLength(0);

        act(() => releaseGet?.(true));

        await waitFor(() => expect(rendered.result.current.isLoaded).toBe(true));
        expect(rendered.result.current.enabled).toBe(true);

        // The first turn left `assistant-1` behind; clear it so the next turn is a genuinely new
        // message rather than being suppressed as a repeat.
        fakeAui.state.messages = [];
        runTurn({ away: true });

        await waitFor(() => expect(notificationCalls).toHaveLength(1));
    });

    it('stays silent when browser permission has not been granted', async () => {
        FakeNotification.permission = 'default';

        await renderNotifier(true);

        runTurn({ away: true });
        await flushDelivery();

        expect(notificationCalls).toHaveLength(0);
    });
});
