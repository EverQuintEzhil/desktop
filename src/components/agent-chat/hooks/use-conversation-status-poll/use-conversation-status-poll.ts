import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';

import { useChatHost } from '@/components/chat-host';
import type { ConversationStatus, HistoryType } from '@/types/chat';

import { setConversationStatusInCache } from '../use-conversation-history/utils/set-conversation-status';

interface Options {
    agentId: string;
    histories: HistoryType[];
    /** Conversation whose turn is streaming in this tab; its in-band frames outrank a poll. */
    skipConversationId?: string | null;
    /** Fires once per conversation that a poll finds has finished. */
    onSettled?: (conversationId: string, status: ConversationStatus) => void;
    enabled?: boolean;
}

const POLL_INTERVAL_MS = 5000;
const MAX_POLLED_CONVERSATIONS = 5;

// Only a running turn is polled. An undefined status is not evidence of a run, and
// `awaiting_input` changes only when a user answers — the tab they answer in reports that
// in-band, so polling it would just spin forever against an idle conversation.
const isGenerating = (status?: ConversationStatus): boolean => status === 'generating';

const isTabVisible = (): boolean => typeof document === 'undefined' || document.visibilityState === 'visible';

// Only the conversation streaming in this tab is skipped, and only until its turn ends:
// a stopped, errored or disconnected run stops emitting frames while the last one still
// said 'generating', so the poll has to be what clears it.
export function useConversationStatusPoll({
    agentId,
    histories,
    skipConversationId,
    onSettled,
    enabled = true,
}: Options) {
    const queryClient = useQueryClient();
    const { conversations } = useChatHost();
    const conversationsRef = useRef(conversations);
    const onSettledRef = useRef(onSettled);

    conversationsRef.current = conversations;
    onSettledRef.current = onSettled;

    const polledIds = useMemo(
        () =>
            histories
                .filter((history) => history._id !== skipConversationId && isGenerating(history.status))
                .slice()
                .sort((a, b) => (b.updated_at ?? 0) - (a.updated_at ?? 0))
                .slice(0, MAX_POLLED_CONVERSATIONS)
                .map((history) => history._id),
        [histories, skipConversationId],
    );

    const polledIdsKey = polledIds.join(',');

    useEffect(() => {
        if (!enabled || !polledIdsKey) {
            return undefined;
        }

        const ids = polledIdsKey.split(',');
        let cancelled = false;
        let interval: ReturnType<typeof setInterval> | null = null;

        const checkStatus = async (conversationId: string) => {
            try {
                const conversation = (await conversationsRef.current.getConversation(conversationId)) as {
                    status?: ConversationStatus;
                } | null;

                if (cancelled) return;

                const status = conversation?.status;

                if (!status || isGenerating(status)) return;

                setConversationStatusInCache(queryClient, agentId, conversationId, status);
                onSettledRef.current?.(conversationId, status);
            } catch {
                // A just-deleted conversation must not kill the interval.
            }
        };

        let inFlight = false;

        const tick = async () => {
            if (inFlight) return;

            inFlight = true;

            try {
                await Promise.all(ids.map(checkStatus));
            } finally {
                inFlight = false;
            }
        };

        const stop = () => {
            if (interval) {
                clearInterval(interval);
                interval = null;
            }
        };

        const start = () => {
            if (interval) return;

            interval = setInterval(() => void tick(), POLL_INTERVAL_MS);
        };

        const handleVisibilityChange = () => {
            if (!isTabVisible()) {
                stop();

                return;
            }

            start();
            void tick();
        };

        if (isTabVisible()) start();

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            cancelled = true;
            stop();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [agentId, enabled, polledIdsKey, queryClient]);
}
