import { useCallback, useEffect, useRef, useState } from 'react';

import { useChatHost } from '@/components/chat-host';
import type { ChatAgentType } from '@/types/admin';

import type { Conversation, ConversationMessage } from '../types';

interface Options {
    agent: ChatAgentType;
    conversationId: string | null;
    streamedConversationId: string | null;
    isConversationLoading: boolean;
    loadedConversation?: Conversation | null;
    /** Reloads the newest page and re-imports the thread; resolves whether the import actually ran. */
    reloadNewestMessages: (activeLeafMessageId?: string | null) => Promise<boolean>;
    /** Newest-first, matching the loader's `sort: 'desc'` page order. */
    getNewestMessages?: () => ConversationMessage[];
    onHydrated?: () => void;
}

const POLL_INTERVAL_MS = 5000;

const hasUnfinishedAssistantTail = (messages: ConversationMessage[]): boolean =>
    messages.find((message) => message.role === 'assistant')?.metadata?.pending === true;

export function useConversationPendingPoll({
    agent,
    conversationId,
    streamedConversationId,
    isConversationLoading,
    loadedConversation,
    reloadNewestMessages,
    getNewestMessages,
    onHydrated,
}: Options) {
    const [isPendingGeneration, setIsPendingGeneration] = useState(false);
    const [backgroundReloadNonce, setBackgroundReloadNonce] = useState(0);
    const { conversations } = useChatHost();
    const conversationsRef = useRef(conversations);
    const loadedConversationRef = useRef(loadedConversation);

    const getNewestMessagesRef = useRef(getNewestMessages);
    const onHydratedRef = useRef(onHydrated);
    const finishedRunConversationRef = useRef<string | null>(null);

    conversationsRef.current = conversations;
    loadedConversationRef.current = loadedConversation;
    getNewestMessagesRef.current = getNewestMessages;
    onHydratedRef.current = onHydrated;

    const clearPendingGeneration = useCallback((finishedConversationId: string | null) => {
        finishedRunConversationRef.current = finishedConversationId;
        setIsPendingGeneration(false);
    }, []);

    useEffect(() => {
        finishedRunConversationRef.current = null;
    }, [conversationId]);

    useEffect(() => {
        if (!conversationId || conversationId === streamedConversationId || isConversationLoading) {
            return undefined;
        }

        let cancelled = false;
        let interval: ReturnType<typeof setInterval> | null = null;

        const checkStatus = async (): Promise<Conversation | null> => {
            try {
                return (await conversationsRef.current.getConversation(conversationId)) as Conversation;
            } catch {
                return null;
            }
        };

        const reloadMessages = async (activeLeafMessageId: string | null): Promise<boolean> => {
            try {
                if (cancelled) return false;

                // Delegates to the loader, which re-imports the newest page and skips the
                // import while a run is in flight (the user may have started a new turn).
                return await reloadNewestMessages(activeLeafMessageId);
            } catch (error) {
                console.error('Failed to reload conversation messages after pending generation:', error);

                return false;
            }
        };

        const startPolling = () => {
            interval = setInterval(() => {
                void (async () => {
                    const conversation = await checkStatus();

                    if (cancelled) return;

                    if (!conversation) return;
                    if (conversation.status === 'generating') return;

                    if (conversation.status === 'ready') {
                        const reloaded = await reloadMessages(conversation.active_leaf_message_id ?? null);

                        if (cancelled) return;

                        if (!reloaded) return;

                        setBackgroundReloadNonce((nonce) => nonce + 1);
                    }

                    if (interval) clearInterval(interval);

                    finishedRunConversationRef.current = null;
                    setIsPendingGeneration(false);
                })();
            }, POLL_INTERVAL_MS);
        };

        const run = async () => {
            const seeded = loadedConversationRef.current;
            const conversation = seeded?._id === conversationId ? seeded : await checkStatus();

            if (cancelled) return;

            const isFinishedHere = finishedRunConversationRef.current === conversationId;
            const looksInFlight =
                conversation?.status === 'generating' ||
                hasUnfinishedAssistantTail(getNewestMessagesRef.current?.() ?? []);

            if (looksInFlight && !isFinishedHere) {
                onHydratedRef.current?.();
            }

            if (conversation?.status === 'generating') {
                if (!isFinishedHere) setIsPendingGeneration(true);
                startPolling();
            }
        };

        void run();

        return () => {
            cancelled = true;
            if (interval) clearInterval(interval);
            setIsPendingGeneration(false);
        };
    }, [conversationId, streamedConversationId, isConversationLoading, agent._id, reloadNewestMessages]);

    return { isPendingGeneration, backgroundReloadNonce, clearPendingGeneration };
}
