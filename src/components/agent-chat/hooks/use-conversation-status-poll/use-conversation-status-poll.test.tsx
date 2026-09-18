import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConversationHistoryQueryData } from '@/components/agent-chat/types';
import { ChatHostProvider, type ChatHost } from '@/components/chat-host';
import type { ConversationStatus, HistoryType } from '@/types/chat';

import { getConversationHistoryQueryKey } from '../use-conversation-history';

import { useConversationStatusPoll } from './use-conversation-status-poll';

const AGENT_ID = 'agent-1';
const POLL_INTERVAL_MS = 5000;

const makeHistory = (id: string, status: ConversationStatus | undefined, updatedAt = 0): HistoryType =>
    ({
        _id: id,
        title: id,
        created_at: updatedAt,
        updated_at: updatedAt,
        generation_status: null,
        status,
    }) as HistoryType;

const setVisibility = (state: DocumentVisibilityState) => {
    Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
};

interface Harness {
    getConversation: ReturnType<typeof vi.fn>;
    queryClient: QueryClient;
    wrapper: ({ children }: { children: ReactNode }) => ReactNode;
}

const createHarness = (statusById: Record<string, ConversationStatus> = {}): Harness => {
    const getConversation = vi.fn(async (id: string) => ({ _id: id, status: statusById[id] ?? 'generating' }));
    const host = { conversations: { getConversation } } as unknown as ChatHost;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            <ChatHostProvider value={host}>{children}</ChatHostProvider>
        </QueryClientProvider>
    );

    return { getConversation, queryClient, wrapper };
};

const polledIds = (getConversation: ReturnType<typeof vi.fn>): string[] =>
    getConversation.mock.calls.map(([id]) => id as string);

const advanceOneInterval = async () => {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });
};

describe('useConversationStatusPoll', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        setVisibility('visible');
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('polls only conversations with a generating status', async () => {
        const { getConversation, wrapper } = createHarness();

        renderHook(
            () =>
                useConversationStatusPoll({
                    agentId: AGENT_ID,
                    histories: [
                        makeHistory('generating-1', 'generating'),
                        makeHistory('ready-1', 'ready'),
                        makeHistory('awaiting-1', 'awaiting_input'),
                        makeHistory('unknown-1', undefined),
                    ],
                }),
            { wrapper },
        );

        await advanceOneInterval();

        expect(polledIds(getConversation)).toEqual(['generating-1']);
    });

    it('polls the open conversation, but not the one streaming in this tab', async () => {
        const { getConversation, wrapper } = createHarness();

        const { rerender } = renderHook(
            ({ skipConversationId }: { skipConversationId: string | null }) =>
                useConversationStatusPoll({
                    agentId: AGENT_ID,
                    histories: [makeHistory('streaming', 'generating'), makeHistory('other', 'generating')],
                    skipConversationId,
                }),
            { wrapper, initialProps: { skipConversationId: 'streaming' as string | null } },
        );

        await advanceOneInterval();

        expect(polledIds(getConversation)).toEqual(['other']);

        getConversation.mockClear();
        rerender({ skipConversationId: null });

        await advanceOneInterval();

        expect(polledIds(getConversation).sort()).toEqual(['other', 'streaming']);
    });

    it('caps polling at five conversations, newest first', async () => {
        const { getConversation, wrapper } = createHarness();
        const histories = Array.from({ length: 7 }, (_, index) =>
            makeHistory(`conversation-${index}`, 'generating', index),
        );

        renderHook(
            () =>
                useConversationStatusPoll({
                    agentId: AGENT_ID,
                    histories,
                }),
            { wrapper },
        );

        await advanceOneInterval();

        expect(polledIds(getConversation)).toEqual([
            'conversation-6',
            'conversation-5',
            'conversation-4',
            'conversation-3',
            'conversation-2',
        ]);
    });

    it('does not poll while hidden and polls immediately on becoming visible', async () => {
        setVisibility('hidden');

        const { getConversation, wrapper } = createHarness();

        renderHook(
            () =>
                useConversationStatusPoll({
                    agentId: AGENT_ID,
                    histories: [makeHistory('generating-1', 'generating')],
                }),
            { wrapper },
        );

        await advanceOneInterval();

        expect(getConversation).not.toHaveBeenCalled();

        setVisibility('visible');
        await act(async () => {
            document.dispatchEvent(new Event('visibilitychange'));
            await Promise.resolve();
        });

        expect(polledIds(getConversation)).toEqual(['generating-1']);
    });

    it('patches the cached lists when a conversation stops generating', async () => {
        const { queryClient, wrapper } = createHarness({ 'generating-1': 'ready' });

        queryClient.setQueryData<ConversationHistoryQueryData>(getConversationHistoryQueryKey(AGENT_ID), {
            pages: [
                {
                    values: [makeHistory('generating-1', 'generating')],
                    pageInfo: { page: 0, totalPages: 1, totalCount: 1 },
                },
            ],
            pageParams: [0],
        } as ConversationHistoryQueryData);

        renderHook(
            () =>
                useConversationStatusPoll({
                    agentId: AGENT_ID,
                    histories: [makeHistory('generating-1', 'generating')],
                }),
            { wrapper },
        );

        await advanceOneInterval();

        const cached = queryClient.getQueryData<ConversationHistoryQueryData>(getConversationHistoryQueryKey(AGENT_ID));

        expect(cached?.pages[0]?.values[0]?.status).toBe('ready');
    });

    it('calls onSettled once with the conversation and its settled status', async () => {
        const { wrapper } = createHarness({ 'generating-1': 'ready' });
        const onSettled = vi.fn();

        renderHook(
            () =>
                useConversationStatusPoll({
                    agentId: AGENT_ID,
                    histories: [makeHistory('generating-1', 'generating')],
                    onSettled,
                }),
            { wrapper },
        );

        await advanceOneInterval();

        expect(onSettled.mock.calls).toEqual([['generating-1', 'ready']]);
    });

    it('does not call onSettled while the conversation is still generating', async () => {
        const { wrapper } = createHarness();
        const onSettled = vi.fn();

        renderHook(
            () =>
                useConversationStatusPoll({
                    agentId: AGENT_ID,
                    histories: [makeHistory('generating-1', 'generating')],
                    onSettled,
                }),
            { wrapper },
        );

        await advanceOneInterval();
        await advanceOneInterval();

        expect(onSettled).not.toHaveBeenCalled();
    });

    it('does not call onSettled for the conversation streaming in this tab', async () => {
        const { wrapper } = createHarness({ streaming: 'ready', other: 'ready' });
        const onSettled = vi.fn();

        renderHook(
            () =>
                useConversationStatusPoll({
                    agentId: AGENT_ID,
                    histories: [makeHistory('streaming', 'generating'), makeHistory('other', 'generating')],
                    skipConversationId: 'streaming',
                    onSettled,
                }),
            { wrapper },
        );

        await advanceOneInterval();

        expect(onSettled.mock.calls).toEqual([['other', 'ready']]);
    });

    it('routes to the latest onSettled after a rerender', async () => {
        const { wrapper } = createHarness({ 'generating-1': 'ready' });
        const stale = vi.fn();
        const fresh = vi.fn();

        const { rerender } = renderHook(
            ({ onSettled }: { onSettled: () => void }) =>
                useConversationStatusPoll({
                    agentId: AGENT_ID,
                    histories: [makeHistory('generating-1', 'generating')],
                    onSettled,
                }),
            { wrapper, initialProps: { onSettled: stale } },
        );

        await advanceOneInterval();

        expect(stale).toHaveBeenCalledTimes(1);

        rerender({ onSettled: fresh });

        await advanceOneInterval();

        expect(stale).toHaveBeenCalledTimes(1);
        expect(fresh.mock.calls).toEqual([['generating-1', 'ready']]);
    });
});
