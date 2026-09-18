import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatHostProvider, type ChatHost } from '@/components/chat-host';
import { getJson, getPaged, server } from '@/test/msw';
import type { ConversationStatus } from '@/types/chat';

import { CHATS_STATUS_POLL_INTERVAL_MS } from './constants';
import { useProject } from './use-project';

const AGENT_ID = 'agent-1';
const PROJECT_ID = 'project-1';
const CHAT_ID = 'chat-1';

const stubDetailEndpoints = () => {
    server.use(
        getJson(`/projects/${PROJECT_ID}`, { _id: PROJECT_ID, name: 'Space' }),
        getPaged('/files', []),
        getPaged(`/projects/${PROJECT_ID}/activities`, []),
    );
};

const createHarness = (statuses: ConversationStatus[]) => {
    let call = 0;
    const list = vi.fn(async () => {
        const status = statuses[Math.min(call, statuses.length - 1)];

        call += 1;

        return {
            values: [{ _id: CHAT_ID, title: 'Chat', status }],
            pageInfo: { page: 0, totalPages: 1, totalCount: 1 },
        };
    });

    const host = { conversations: { list } } as unknown as ChatHost;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            <ChatHostProvider value={host}>{children}</ChatHostProvider>
        </QueryClientProvider>
    );

    return { list, wrapper };
};

const advanceOneInterval = async () => {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(CHATS_STATUS_POLL_INTERVAL_MS);
    });
};

describe('useProject chat status refresh', () => {
    beforeEach(() => {
        // `shouldAdvanceTime` keeps real time flowing: RTL's `waitFor` and MSW both wait on real
        // timers, and a frozen clock deadlocks them.
        vi.useFakeTimers({ shouldAdvanceTime: true });
        stubDetailEndpoints();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('drops the generating status once the backend reports the turn finished', async () => {
        const { list, wrapper } = createHarness(['generating', 'ready']);

        const { result } = renderHook(() => useProject(AGENT_ID, PROJECT_ID), { wrapper });

        await waitFor(() => expect(result.current.chats[0]?.status).toBe('generating'));

        await advanceOneInterval();

        await waitFor(() => expect(result.current.chats[0]?.status).toBe('ready'));

        const callsAfterSettling = list.mock.calls.length;

        await advanceOneInterval();
        await advanceOneInterval();

        expect(list.mock.calls.length).toBe(callsAfterSettling);
    });

    it('does not poll a list with no generating row', async () => {
        const { list, wrapper } = createHarness(['ready']);

        const { result } = renderHook(() => useProject(AGENT_ID, PROJECT_ID), { wrapper });

        await waitFor(() => expect(result.current.chats).toHaveLength(1));

        await advanceOneInterval();
        await advanceOneInterval();

        expect(list).toHaveBeenCalledTimes(1);
    });
});
