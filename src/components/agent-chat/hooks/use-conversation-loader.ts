import type { AssistantRuntime, ThreadRuntime } from '@assistant-ui/react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import type { Conversation, ConversationMessage } from '@/components/agent-chat/types';
import { useChatHost } from '@/components/chat-host';
import { CONVERSATION_MESSAGES_PAGE_SIZE, type ConversationMessagesList } from '@/lib/api/app/conversation';
import type { ChatAgentType } from '@/types/admin';
import { showErrorToast, showInfoToast } from '@/utils';

import { buildConversationRepository } from '../runtime/build-conversation-repository';

interface UseConversationLoaderOptions {
    runtime: AssistantRuntime;
    agent: ChatAgentType;
    conversationId: string | null;
    streamedConversationId?: string | null;
    /** Increment to force a thread reset when starting a new chat from a temporary session. */
    newChatEpoch?: number;
    /**
     * Increment to load the current conversation again from scratch. Navigating to the id already
     * routed to is a no-op, so this is the only way back after a load failed.
     */
    reloadEpoch?: number;
    onLoadError?: () => void;
    /**
     * The conversation is gone (404). Setting this takes over the whole response, including
     * telling the user — the loader's own toast names controls a panel host does not have.
     */
    onConversationNotFound?: () => void;
    onForeignConversation?: (isForeign: boolean) => void;
    onHistoryLoaded?: (messageIds: string[]) => void;
}

const isConversationNotFoundError = (error: unknown): boolean => {
    const err = error as Error & { response?: { status?: number; data?: { message?: string } } };
    const status = err?.response?.status;
    const message = `${err?.message || ''} ${err?.response?.data?.message || ''}`.toLowerCase();

    if (status === 404) return true;

    return message.includes('conversation not found') || message.includes('invalid conversation');
};

const resetChatThread = (
    thread: Pick<ThreadRuntime, 'cancelRun' | 'reset' | 'composer'>,
    onReset?: () => void,
): number => {
    thread.cancelRun();

    return window.setTimeout(() => {
        thread.reset();
        void thread.composer.reset();
        onReset?.();
    }, 0);
};

export function useConversationLoader({
    runtime,
    agent,
    conversationId,
    streamedConversationId,
    newChatEpoch,
    reloadEpoch,
    onLoadError,
    onConversationNotFound,
    onForeignConversation,
    onHistoryLoaded,
}: UseConversationLoaderOptions) {
    const { session, conversations, navigation } = useChatHost();
    const conversationsRef = useRef(conversations);
    const navigationRef = useRef(navigation);
    // Latest-handler refs. The message-load effect below performs a heavy thread
    // reset (switchToNewThread + reset + importExternalState), so it must only re-run
    // for a genuine load-target change. Reading these handlers through refs keeps them
    // out of the effect's dependency array; otherwise any host-cache churn (e.g. a
    // connector-preference toggle rebuilding the host object) would re-run it and
    // reload the whole conversation.
    const onLoadErrorRef = useRef(onLoadError);
    const onConversationNotFoundRef = useRef(onConversationNotFound);
    const onForeignConversationRef = useRef(onForeignConversation);
    const onHistoryLoadedRef = useRef(onHistoryLoaded);

    conversationsRef.current = conversations;
    navigationRef.current = navigation;
    onLoadErrorRef.current = onLoadError;
    onConversationNotFoundRef.current = onConversationNotFound;
    onForeignConversationRef.current = onForeignConversation;
    onHistoryLoadedRef.current = onHistoryLoaded;
    const user = session.user;
    const defaultLoadError = useCallback(() => navigationRef.current.startNewConversation(), []);
    const [isConversationLoading, setIsConversationLoading] = useState(() => Boolean(conversationId));
    const [branchedFromConversation, setBranchedFromConversation] = useState<{
        id: string;
        title: string;
        messageId?: string | null;
    } | null>(null);
    const [loadedConversation, setLoadedConversation] = useState<Conversation | null>(null);

    // Upward pagination state. Messages are fetched newest-first; `accumulatedMessages`
    // holds every loaded message in `desc` order (newest → oldest) so older pages append
    // to the end and reverse to chronological order for the repository build.
    const accumulatedMessagesRef = useRef<ConversationMessage[]>([]);
    const loadedPageRef = useRef(0);
    const totalPagesRef = useRef(1);
    const activeLeafIdRef = useRef<string | null>(null);
    const conversationIdRef = useRef<string | null>(conversationId);
    // The conversation the banner and loaded record currently describe.
    const loadedConversationIdRef = useRef<string | null>(null);
    const isLoadingOlderRef = useRef(false);
    const [hasMoreOlderMessages, setHasMoreOlderMessages] = useState(false);
    const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);

    conversationIdRef.current = conversationId;

    const resetPagingState = useCallback(() => {
        accumulatedMessagesRef.current = [];
        loadedPageRef.current = 0;
        totalPagesRef.current = 1;
        activeLeafIdRef.current = null;
        setHasMoreOlderMessages(false);
        setIsLoadingOlderMessages(false);
        isLoadingOlderRef.current = false;
    }, []);

    const importAccumulated = useCallback((): boolean => {
        const repository = buildConversationRepository({
            messages: [...accumulatedMessagesRef.current].reverse(),
            userId: user?.id,
            activeLeafMessageId: activeLeafIdRef.current,
        });

        if (repository.messages.length > 0 && !runtime.thread.getState().isRunning) {
            runtime.thread.importExternalState(repository);
            onHistoryLoadedRef.current?.(repository.messages.map((item) => item.message.id));

            return true;
        }

        return false;
    }, [runtime, user?.id]);

    // Fetch the next older page, prepend it, and re-import the expanded thread.
    const loadOlderMessages = useCallback(async () => {
        const cid = conversationIdRef.current;

        if (!cid || isLoadingOlderRef.current) return;
        if (loadedPageRef.current + 1 >= totalPagesRef.current) return;
        if (runtime.thread.getState().isRunning) return;

        isLoadingOlderRef.current = true;
        setIsLoadingOlderMessages(true);

        try {
            const nextPage = loadedPageRef.current + 1;
            const older = (await conversationsRef.current.getConversationMessages(cid, {
                size: CONVERSATION_MESSAGES_PAGE_SIZE,
                sort: 'desc',
                page: nextPage,
            })) as ConversationMessagesList<ConversationMessage>;

            if (conversationIdRef.current !== cid) return;

            const existingIds = new Set(accumulatedMessagesRef.current.map((message) => message._id));
            const freshOlder = older.values.filter((message) => !existingIds.has(message._id));

            accumulatedMessagesRef.current = [...accumulatedMessagesRef.current, ...freshOlder];
            loadedPageRef.current = nextPage;
            totalPagesRef.current = older.pageInfo.totalPages;

            importAccumulated();
            setHasMoreOlderMessages(loadedPageRef.current + 1 < totalPagesRef.current);
        } catch (error) {
            console.error('Failed to load older conversation messages:', error);
        } finally {
            isLoadingOlderRef.current = false;
            setIsLoadingOlderMessages(false);
        }
    }, [runtime, importAccumulated]);

    const getNewestMessages = useCallback((): ConversationMessage[] => accumulatedMessagesRef.current, []);

    // Reload the newest page and reset the window to the bottom. Used by the pending-poll
    // once a background generation finishes.
    const reloadNewestMessages = useCallback(
        async (activeLeafMessageId?: string | null): Promise<boolean> => {
            const cid = conversationIdRef.current;

            if (!cid) return false;

            const result = (await conversationsRef.current.getConversationMessages(cid, {
                size: CONVERSATION_MESSAGES_PAGE_SIZE,
                sort: 'desc',
                page: 0,
            })) as ConversationMessagesList<ConversationMessage>;

            if (conversationIdRef.current !== cid) return false;

            accumulatedMessagesRef.current = [...result.values];
            loadedPageRef.current = 0;
            totalPagesRef.current = result.pageInfo.totalPages;
            activeLeafIdRef.current = activeLeafMessageId ?? result.headId ?? activeLeafIdRef.current ?? null;

            const imported = importAccumulated();

            setHasMoreOlderMessages(result.pageInfo.totalPages > 1);

            return imported;
        },
        [importAccumulated],
    );

    useLayoutEffect(() => {
        if (conversationId) return undefined;

        let cancelled = false;
        let resetTimer: number | undefined;

        setIsConversationLoading(true);
        setBranchedFromConversation(null);
        setLoadedConversation(null);
        resetPagingState();
        runtime.thread.cancelRun();

        void runtime.threads
            .switchToNewThread()
            .then(() => {
                if (cancelled) return;

                resetTimer = resetChatThread(runtime.thread, () => {
                    setIsConversationLoading(false);
                });
            })
            .catch(() => {
                if (!cancelled) setIsConversationLoading(false);
            });

        return () => {
            cancelled = true;
            if (resetTimer !== undefined) window.clearTimeout(resetTimer);
        };
    }, [runtime, conversationId, newChatEpoch, resetPagingState]);

    useLayoutEffect(() => {
        if (!conversationId) return;
        if (conversationId === streamedConversationId && runtime.thread.getState().messages.length > 0) return;

        setIsConversationLoading(true);
    }, [conversationId, streamedConversationId, reloadEpoch, runtime]);

    useEffect(() => {
        if (!conversationId) return undefined;

        if (conversationId === streamedConversationId && runtime.thread.getState().messages.length > 0) {
            setIsConversationLoading(false);
            onForeignConversationRef.current?.(false);

            return undefined;
        }

        let cancelled = false;
        let resolveReset: VoidFunction = () => {};
        const resetPromise = new Promise<void>((resolve) => {
            resolveReset = resolve;
        });
        let resetTimer: number | undefined;

        // Clear any previous conversation's paging window before loading this one.
        resetPagingState();
        // The banner and record go too, but only on a real switch: they are set by a settled load,
        // so a failed one would otherwise keep showing the conversation the reader has left — while
        // blanking them on every effect re-run would flicker them off for a whole round trip.
        if (loadedConversationIdRef.current !== conversationId) {
            loadedConversationIdRef.current = conversationId;
            setBranchedFromConversation(null);
            setLoadedConversation(null);
        }
        setIsConversationLoading(true);

        const loadMessages = async () => {
            try {
                // Imported route history must not inherit an earlier generated thread's request error.
                runtime.thread.cancelRun();
                await runtime.threads.switchToNewThread();

                if (cancelled) return;

                resetTimer = resetChatThread(runtime.thread, resolveReset);
                const [result, conversation] = await Promise.all([
                    conversationsRef.current.getConversationMessages(conversationId, {
                        size: CONVERSATION_MESSAGES_PAGE_SIZE,
                        sort: 'desc',
                        page: 0,
                    }) as Promise<ConversationMessagesList<ConversationMessage>>,
                    (conversationsRef.current.getConversation(conversationId) as Promise<Conversation>).catch(
                        () => null,
                    ),
                ]);
                if (cancelled) return;

                const isForeign = !!conversation && !!user?.id && conversation.user_id !== user.id;

                onForeignConversationRef.current?.(isForeign);
                setLoadedConversation(conversation ?? null);

                // Seed the upward-pagination window with the newest page.
                accumulatedMessagesRef.current = [...result.values];
                loadedPageRef.current = 0;
                totalPagesRef.current = result.pageInfo.totalPages;
                activeLeafIdRef.current = conversation?.active_leaf_message_id ?? result.headId ?? null;

                const repository = buildConversationRepository({
                    messages: [...accumulatedMessagesRef.current].reverse(),
                    userId: user?.id,
                    activeLeafMessageId: activeLeafIdRef.current,
                });

                if (conversation?.branched_from_conversation_id) {
                    const sourceConv = await (
                        conversationsRef.current.getConversation(
                            conversation.branched_from_conversation_id,
                        ) as Promise<Conversation>
                    ).catch(() => null);

                    if (!cancelled && sourceConv?.title) {
                        const sourceTitle = sourceConv.title;

                        setBranchedFromConversation({
                            id: conversation.branched_from_conversation_id,
                            title: sourceTitle,
                            messageId: conversation.branch_message_id,
                        });
                    }
                } else if (!cancelled) {
                    setBranchedFromConversation(null);
                }

                await resetPromise;

                if (cancelled) return;

                if (repository.messages.length > 0) {
                    runtime.thread.importExternalState(repository);
                    onHistoryLoadedRef.current?.(repository.messages.map((item) => item.message.id));
                }

                setHasMoreOlderMessages(result.pageInfo.totalPages > 1);
            } catch (error) {
                if (cancelled) return;

                console.error('Failed to load conversation history:', error);

                if (isConversationNotFoundError(error)) {
                    if (onConversationNotFoundRef.current) {
                        onConversationNotFoundRef.current();
                    } else {
                        showInfoToast(
                            "This conversation couldn't be found. Refresh to retry, or start a new chat from the sidebar.",
                        );
                    }
                    onForeignConversationRef.current?.(false);
                    setLoadedConversation(null);
                    setBranchedFromConversation(null);

                    return;
                }

                showErrorToast('Failed to load conversation history.');
                (onLoadErrorRef.current || defaultLoadError)();
            } finally {
                if (!cancelled) {
                    setIsConversationLoading(false);
                }
            }
        };

        void loadMessages();

        return () => {
            cancelled = true;
            if (resetTimer !== undefined) window.clearTimeout(resetTimer);
            resolveReset();
        };
    }, [
        runtime,
        conversationId,
        streamedConversationId,
        reloadEpoch,
        agent._id,
        agent.slug,
        user?.id,
        defaultLoadError,
        resetPagingState,
    ]);

    return {
        isConversationLoading,
        branchedFromConversation,
        loadedConversation,
        loadOlderMessages,
        hasMoreOlderMessages,
        isLoadingOlderMessages,
        reloadNewestMessages,
        getNewestMessages,
    };
}
