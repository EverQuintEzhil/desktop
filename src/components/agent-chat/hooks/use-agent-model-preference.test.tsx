import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import type { AgentPreferences } from '@/lib/api/common/agent-preferences';
import { apiUrl, envelope, respond, server } from '@/test/msw';

import { agentModelPreferenceQueryKey, useAgentModelPreference } from './use-agent-model-preference';

const readDefaultModelId = (queryClient: QueryClient, agentId: string): string | null | undefined =>
    (queryClient.getQueryData(agentModelPreferenceQueryKey(agentId)) as AgentPreferences | null | undefined)
        ?.defaultModelId;

const renderPreference = (agentId: string) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const view = renderHook(({ id }: { id: string }) => useAgentModelPreference(id), {
        wrapper,
        initialProps: { id: agentId },
    });

    return { ...view, queryClient };
};

describe('useAgentModelPreference concurrent writes', () => {
    // The admin playground / SDK case: the same hook instance keeps mounted while
    // the agent id is swapped in place, so two writes for different agents can be
    // in flight at once. A single global write-sequence counter would let B's
    // newer seq suppress A's still-latest onSuccess, leaving A's cache unwritten.
    it("writes both agents' caches when their writes overlap across an in-place agent swap", async () => {
        server.use(
            respond('get', '/agents/agent-a/preferences', () => envelope(null)),
            respond('get', '/agents/agent-b/preferences', () => envelope(null)),
        );

        let releaseA = () => {};
        let releaseB = () => {};
        const heldA = new Promise<void>((resolve) => {
            releaseA = resolve;
        });
        const heldB = new Promise<void>((resolve) => {
            releaseB = resolve;
        });

        server.use(
            http.patch(apiUrl('/agents/agent-a/preferences'), async ({ request }) => {
                const body = await request.json();

                await heldA;

                return envelope(body);
            }),
        );
        server.use(
            http.patch(apiUrl('/agents/agent-b/preferences'), async ({ request }) => {
                const body = await request.json();

                await heldB;

                return envelope(body);
            }),
        );

        const { result, rerender, queryClient } = renderPreference('agent-a');

        act(() => {
            result.current.persistModelId('model-a');
        });

        // Swap the agent id in place (no remount) while A's PATCH is still held.
        rerender({ id: 'agent-b' });

        act(() => {
            result.current.persistModelId('model-b');
        });

        releaseA();
        releaseB();

        await waitFor(() => {
            expect(readDefaultModelId(queryClient, 'agent-a')).toBe('model-a');
            expect(readDefaultModelId(queryClient, 'agent-b')).toBe('model-b');
        });
    });

    it('lets the later of two same-agent writes win the cache regardless of response order', async () => {
        server.use(respond('get', '/agents/agent-a/preferences', () => envelope(null)));

        const releases: Array<() => void> = [];

        server.use(
            http.patch(apiUrl('/agents/agent-a/preferences'), async ({ request }) => {
                const body = await request.json();

                await new Promise<void>((resolve) => {
                    releases.push(resolve);
                });

                return envelope(body);
            }),
        );

        const { result, queryClient } = renderPreference('agent-a');

        act(() => {
            result.current.persistModelId('model-x');
        });
        await waitFor(() => expect(releases).toHaveLength(1));

        act(() => {
            result.current.persistModelId('model-y');
        });
        await waitFor(() => expect(releases).toHaveLength(2));

        // Settle the later write first, then the earlier (stale) one. The stale
        // response must not overwrite the cache the newer write already claimed.
        releases[1]();
        releases[0]();

        await waitFor(() => expect(readDefaultModelId(queryClient, 'agent-a')).toBe('model-y'));
        expect(readDefaultModelId(queryClient, 'agent-a')).toBe('model-y');
    });
});
