import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { apiUrl, envelope, server } from '@/test/msw';
import type { AgentType } from '@/types/admin';

import { useConnectors, type ConnectorSource } from './use-connectors';

const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        {children}
    </QueryClientProvider>
);

const makeSource = (overrides: Partial<ConnectorSource> & Pick<ConnectorSource, '_id' | 'name'>): ConnectorSource => ({
    authType: 'api-key',
    status: 'active',
    preference: null,
    agentEnabled: null,
    effectiveEnabled: true,
    connection: null,
    ...overrides,
});

const renderConnectors = (agentMcpServers: ConnectorSource[]) =>
    renderHook(() => useConnectors({ agentId: 'agent-1', agentMcpServers }), { wrapper }).result;

/** Holds the preference save for `heldId` until the returned release is called. */
const holdPreferenceSave = (heldId: string) => {
    let release = () => {};
    const held = new Promise<void>((resolve) => {
        release = resolve;
    });

    server.use(
        http.put(apiUrl('/mcpservers/:id/preferences'), async ({ params }) => {
            if (params.id === heldId) {
                await held;
            }

            return envelope({ mcpServerId: params.id, userId: 'user-1', disabled: false });
        }),
    );

    return () => release();
};

describe('useConnectors', () => {
    it('lists servers regardless of their admin status flag', () => {
        const { current } = renderConnectors([
            makeSource({ _id: 'active-key', name: 'Slack' }),
            makeSource({ _id: 'inactive-key', name: 'Firecrawl', status: 'inactive' }),
            makeSource({
                _id: 'inactive-oauth',
                name: 'Shell',
                authType: 'oauth',
                status: 'inactive',
                connection: { status: 'connected', tokenExpiry: null },
            }),
            makeSource({
                _id: 'active-oauth',
                name: 'Microsoft 365',
                authType: 'oauth',
                connection: { status: 'connected', tokenExpiry: null },
            }),
            makeSource({ _id: 'unconnected-oauth', name: 'Notion', authType: 'oauth' }),
        ]);

        expect(current.nonOauthConnectors.map((c) => c._id)).toEqual(['active-key', 'inactive-key']);
        expect(current.connections.map((c) => c.mcpServerId)).toEqual(['inactive-oauth', 'active-oauth']);
        expect(current.disconnectedConnectors.map((c) => c._id)).toEqual(['unconnected-oauth']);
    });

    it('keeps a deactivated server in the enabled ids and the chat payload', () => {
        const { current } = renderConnectors([
            makeSource({ _id: 'active-key', name: 'Slack' }),
            makeSource({ _id: 'inactive-key', name: 'Firecrawl', status: 'inactive' }),
        ]);

        expect(current.enabledIds).toEqual(['active-key', 'inactive-key']);
        expect(current.mcpServers).toEqual([
            { _id: 'active-key', isEnabled: true },
            { _id: 'inactive-key', isEnabled: true },
        ]);
    });

    it('keeps the pending marker on the enable that is still saving', async () => {
        const releaseSlow = holdPreferenceSave('slow');
        const result = renderConnectors([
            makeSource({ _id: 'quick', name: 'Slack' }),
            makeSource({ _id: 'slow', name: 'Notion' }),
        ]);

        let quickSave: Promise<boolean> | undefined;
        let slowSave: Promise<boolean> | undefined;

        act(() => {
            quickSave = result.current.setConnectorEnabled('quick', true);
            slowSave = result.current.setConnectorEnabled('slow', true);
        });

        await act(async () => {
            await quickSave;
        });

        expect(result.current.enablingId).toBe('slow');

        releaseSlow();

        await act(async () => {
            await slowSave;
        });

        expect(result.current.enablingId).toBeNull();
    });

    it('enables a logged-out OAuth connector and continues into its auth flow', async () => {
        const connectCalls: string[] = [];

        server.use(
            http.put(apiUrl('/mcpservers/:id/preferences'), ({ params }) =>
                envelope({ mcpServerId: params.id, userId: 'user-1', disabled: false }),
            ),
            http.get(apiUrl('/mcpservers/:id/connect'), ({ params }) => {
                connectCalls.push(params.id as string);

                return envelope({ authorizationUrl: 'https://provider.test/authorize' });
            }),
        );
        const result = renderConnectors([
            makeSource({
                _id: 'notion',
                name: 'Notion',
                authType: 'oauth',
                effectiveEnabled: false,
                agentEnabled: false,
            }),
        ]);

        await act(async () => {
            await result.current.toggleDisconnectedConnector('notion');
        });

        expect(connectCalls).toEqual(['notion']);
    });

    it('does not start the auth flow when enabling the connector fails', async () => {
        const connectCalls: string[] = [];

        server.use(
            http.put(apiUrl('/mcpservers/:id/preferences'), () =>
                HttpResponse.json({ success: false, error: 'nope' }, { status: 500 }),
            ),
            http.get(apiUrl('/mcpservers/:id/connect'), ({ params }) => {
                connectCalls.push(params.id as string);

                return envelope({ authorizationUrl: 'https://provider.test/authorize' });
            }),
        );
        const result = renderConnectors([
            makeSource({
                _id: 'notion',
                name: 'Notion',
                authType: 'oauth',
                effectiveEnabled: false,
                agentEnabled: false,
            }),
        ]);

        await act(async () => {
            await result.current.toggleDisconnectedConnector('notion');
        });

        expect(connectCalls).toEqual([]);
    });

    it('withdraws the redirect when the row is switched back off mid-save', async () => {
        const connectCalls: string[] = [];
        const savedPreferences: unknown[] = [];
        let releasePreference = () => {};
        const held = new Promise<void>((resolve) => {
            releasePreference = resolve;
        });

        server.use(
            http.put(apiUrl('/mcpservers/:id/preferences'), async ({ params, request }) => {
                savedPreferences.push(await request.json());
                await held;

                return envelope({ mcpServerId: params.id, userId: 'user-1', disabled: false });
            }),
            http.get(apiUrl('/mcpservers/:id/connect'), ({ params }) => {
                connectCalls.push(params.id as string);

                return envelope({ authorizationUrl: 'https://provider.test/authorize' });
            }),
        );
        const result = renderConnectors([
            makeSource({
                _id: 'notion',
                name: 'Notion',
                authType: 'oauth',
                effectiveEnabled: false,
                agentEnabled: false,
            }),
        ]);

        let firstToggle: Promise<void> | undefined;

        act(() => {
            firstToggle = result.current.toggleDisconnectedConnector('notion');
        });

        // Switched back off before the enable finished saving: the viewer's last click wins
        // and the auth redirect it queued must not run.
        const secondToggle = result.current.toggleDisconnectedConnector('notion');

        releasePreference();
        await act(async () => {
            await Promise.all([firstToggle, secondToggle]);
        });

        expect(connectCalls).toEqual([]);
        await waitFor(() =>
            expect(savedPreferences).toEqual([
                { disabled: false, agentId: 'agent-1' },
                { disabled: true, agentId: 'agent-1' },
            ]),
        );
    });

    it('coalesces rapid toggles into the state the viewer stopped on', async () => {
        const savedPreferences: { disabled: boolean }[] = [];
        let releasePreference = () => {};
        const held = new Promise<void>((resolve) => {
            releasePreference = resolve;
        });

        server.use(
            http.put(apiUrl('/mcpservers/:id/preferences'), async ({ params, request }) => {
                const payload = (await request.json()) as { disabled: boolean };

                savedPreferences.push(payload);
                await held;

                return envelope({ mcpServerId: params.id, userId: 'user-1', disabled: payload.disabled });
            }),
        );
        const result = renderConnectors([makeSource({ _id: 'slack', name: 'Slack' })]);

        // Four clicks while the first save is still in flight; the intermediate states are
        // never sent, and the switch must end on the last one the viewer asked for.
        act(() => {
            result.current.toggleMcpServer('slack');
            result.current.toggleMcpServer('slack');
            result.current.toggleMcpServer('slack');
            result.current.toggleMcpServer('slack');
        });

        expect(result.current.disabledMap.slack).toBe(false);

        releasePreference();
        await waitFor(() => expect(savedPreferences.length).toBe(2));
        expect(savedPreferences.map((p) => p.disabled)).toEqual([true, false]);
        expect(result.current.disabledMap.slack).toBe(false);
    });

    it('drops queued toggles when a write fails instead of stranding the optimistic state', async () => {
        let attempt = 0;
        let releaseFirst = () => {};
        const held = new Promise<void>((resolve) => {
            releaseFirst = resolve;
        });

        server.use(
            http.put(apiUrl('/mcpservers/:id/preferences'), async () => {
                attempt += 1;
                if (attempt === 1) {
                    await held;

                    return HttpResponse.json({ success: false, error: 'nope' }, { status: 500 });
                }

                return envelope({ mcpServerId: 'slack', userId: 'user-1', disabled: false });
            }),
        );
        // Disabled on the server, so a queued "enabled" intent is visibly different from
        // the state the row must fall back to once the write fails.
        const result = renderConnectors([
            makeSource({ _id: 'slack', name: 'Slack', effectiveEnabled: false, agentEnabled: false }),
        ]);

        act(() => {
            result.current.toggleMcpServer('slack');
        });
        // Both of these queue behind the write that is about to fail, and coalesce to
        // "enabled" — the opposite of the server state.
        act(() => {
            result.current.toggleMcpServer('slack');
            result.current.toggleMcpServer('slack');
        });

        expect(result.current.disabledMap.slack).toBe(false);

        releaseFirst();

        // Falls back to the server state instead of holding an optimistic value that
        // nothing is saving, and the queued write is not sent behind the failure.
        await waitFor(() => expect(result.current.disabledMap.slack).toBe(true));
        expect(attempt).toBe(1);
    });

    it('keeps one row\u2019s pending redirect when another row is switched off', async () => {
        const connectCalls: string[] = [];
        let releasePreference = () => {};
        const held = new Promise<void>((resolve) => {
            releasePreference = resolve;
        });

        server.use(
            http.put(apiUrl('/mcpservers/:id/preferences'), async ({ params }) => {
                if (params.id === 'notion') {
                    await held;
                }

                return envelope({ mcpServerId: params.id, userId: 'user-1', disabled: false });
            }),
            http.get(apiUrl('/mcpservers/:id/connect'), ({ params }) => {
                connectCalls.push(params.id as string);

                return envelope({ authorizationUrl: 'https://provider.test/authorize' });
            }),
        );
        const result = renderConnectors([
            makeSource({
                _id: 'notion',
                name: 'Notion',
                authType: 'oauth',
                effectiveEnabled: false,
                agentEnabled: false,
            }),
            makeSource({ _id: 'miro', name: 'Miro', authType: 'oauth' }),
        ]);

        let notionToggle: Promise<void> | undefined;

        act(() => {
            notionToggle = result.current.toggleDisconnectedConnector('notion');
        });

        // A different row going off must not withdraw Notion's queued redirect.
        await act(async () => {
            await result.current.toggleDisconnectedConnector('miro');
        });

        releasePreference();
        await act(async () => {
            await notionToggle;
        });

        expect(connectCalls).toEqual(['notion']);
    });

    it('reports an enable as unsuccessful when a later toggle wins the drain', async () => {
        let releasePreference = () => {};
        const held = new Promise<void>((resolve) => {
            releasePreference = resolve;
        });
        let first = true;

        server.use(
            http.put(apiUrl('/mcpservers/:id/preferences'), async ({ params }) => {
                if (first) {
                    first = false;
                    await held;
                }

                return envelope({ mcpServerId: params.id, userId: 'user-1', disabled: false });
            }),
        );
        const result = renderConnectors([
            makeSource({ _id: 'slack', name: 'Slack', effectiveEnabled: false, agentEnabled: false }),
        ]);

        let enable: Promise<boolean> | undefined;

        act(() => {
            enable = result.current.setConnectorEnabled('slack', true);
        });
        // The viewer switches it straight back off while the enable is still saving.
        act(() => {
            result.current.toggleMcpServer('slack');
        });

        releasePreference();

        await act(async () => {
            // The enable did not end up as the state that landed, so its caller must not
            // report success.
            expect(await enable).toBe(false);
        });
    });

    it('only saves the preference when switching a logged-out OAuth connector off', async () => {
        const connectCalls: string[] = [];
        const savedPreferences: unknown[] = [];

        server.use(
            http.put(apiUrl('/mcpservers/:id/preferences'), async ({ params, request }) => {
                savedPreferences.push(await request.json());

                return envelope({ mcpServerId: params.id, userId: 'user-1', disabled: true });
            }),
            http.get(apiUrl('/mcpservers/:id/connect'), ({ params }) => {
                connectCalls.push(params.id as string);

                return envelope({ authorizationUrl: 'https://provider.test/authorize' });
            }),
        );
        const result = renderConnectors([makeSource({ _id: 'notion', name: 'Notion', authType: 'oauth' })]);

        await act(async () => {
            await result.current.toggleDisconnectedConnector('notion');
        });

        expect(connectCalls).toEqual([]);
        await waitFor(() => expect(savedPreferences).toEqual([{ disabled: true, agentId: 'agent-1' }]));
    });

    it('treats a missing status as usable', () => {
        const { current } = renderConnectors([makeSource({ _id: 'no-status', name: 'Slack', status: undefined })]);

        expect(current.nonOauthConnectors.map((c) => c._id)).toEqual(['no-status']);
    });
});

describe('useConnectors optimistic cache writes', () => {
    const makeClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const renderWithClient = (queryClient: QueryClient, agentMcpServers: ConnectorSource[]) =>
        renderHook(() => useConnectors({ agentId: 'agent-1', agentMcpServers }), {
            wrapper: ({ children }: { children: ReactNode }) => (
                <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
            ),
        }).result;

    const seedAgent = (queryClient: QueryClient, enabled: boolean) =>
        queryClient.setQueryData(['agent', 'agent-1'], {
            _id: 'agent-1',
            mcpServers: [{ _id: 'x', effectiveEnabled: enabled, agentEnabled: enabled }],
        } as unknown as AgentType);

    const cachedEnabled = (queryClient: QueryClient) => {
        const agent = queryClient.getQueryData<AgentType>(['agent', 'agent-1']);

        return agent?.mcpServers?.find((s) => s._id === 'x')?.effectiveEnabled;
    };

    it('patches the agent cache when a toggle succeeds', async () => {
        server.use(
            http.put(apiUrl('/mcpservers/:id/preferences'), ({ params }) =>
                envelope({ mcpServerId: params.id, userId: 'user-1', disabled: true }),
            ),
        );
        const queryClient = makeClient();

        seedAgent(queryClient, true);
        const result = renderWithClient(queryClient, [makeSource({ _id: 'x', name: 'Slack' })]);

        act(() => {
            result.current.toggleMcpServer('x');
        });

        await waitFor(() => expect(cachedEnabled(queryClient)).toBe(false));
    });

    it('rolls the agent cache back to the pre-toggle state when the save fails', async () => {
        server.use(
            http.put(apiUrl('/mcpservers/:id/preferences'), () =>
                HttpResponse.json({ success: false, error: 'nope' }, { status: 500 }),
            ),
        );
        const queryClient = makeClient();

        seedAgent(queryClient, true);
        const result = renderWithClient(queryClient, [makeSource({ _id: 'x', name: 'Slack' })]);

        act(() => {
            result.current.toggleMcpServer('x');
        });

        // Optimistically flipped off, then reverted to the original enabled state.
        await waitFor(() => expect(cachedEnabled(queryClient)).toBe(true));
    });

    it('reverts a failed absolute enable to the real pre-call state, not the target', async () => {
        server.use(
            http.put(apiUrl('/mcpservers/:id/preferences'), () =>
                HttpResponse.json({ success: false, error: 'nope' }, { status: 500 }),
            ),
        );
        const queryClient = makeClient();

        // Connector already enabled; an absolute setConnectorEnabled(_, true) whose PUT
        // fails must not derive the rollback from the target (which would disable it).
        seedAgent(queryClient, true);
        const result = renderWithClient(queryClient, [makeSource({ _id: 'x', name: 'Slack' })]);

        await act(async () => {
            await result.current.setConnectorEnabled('x', true);
        });

        expect(cachedEnabled(queryClient)).toBe(true);
    });
});
