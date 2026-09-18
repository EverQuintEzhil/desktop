import type { AssistantRuntime } from '@assistant-ui/react';
import { useEffect, useRef } from 'react';

import { useChatHost } from '@/components/chat-host';
import { showErrorToast } from '@/utils';

interface UseBranchHeadSyncOptions {
    runtime: AssistantRuntime;
    agentId: string;
    conversationId: string | null;
    isConversationLoading: boolean;
    isForeignConversation: boolean;
    isIncognitoMode: boolean;
    resolvePersistedMessageId: (id: string) => string;
    isPersistedMessageId: (id: string) => boolean;
}

const HEAD_SYNC_DEBOUNCE_MS = 800;

export function useBranchHeadSync({
    runtime,
    agentId,
    conversationId,
    isConversationLoading,
    isForeignConversation,
    isIncognitoMode,
    resolvePersistedMessageId,
    isPersistedMessageId,
}: UseBranchHeadSyncOptions) {
    const { conversations } = useChatHost();
    const conversationsRef = useRef(conversations);

    conversationsRef.current = conversations;

    const optionsRef = useRef({
        isConversationLoading,
        isForeignConversation,
        isIncognitoMode,
        resolvePersistedMessageId,
        isPersistedMessageId,
    });

    optionsRef.current = {
        isConversationLoading,
        isForeignConversation,
        isIncognitoMode,
        resolvePersistedMessageId,
        isPersistedMessageId,
    };

    useEffect(() => {
        if (!conversationId) return undefined;

        const headRef = { current: null as string | null };
        const countRef = { current: 0 };
        const wasRunningRef = { current: false };
        let debounceTimer: number | undefined;

        const syncInitialState = () => {
            const state = runtime.thread.getState();
            const lastMessage = state.messages.at(-1);

            headRef.current = lastMessage ? optionsRef.current.resolvePersistedMessageId(lastMessage.id) : null;
            countRef.current = state.messages.length;
            wasRunningRef.current = state.isRunning;
        };

        syncInitialState();

        const clearPendingHeadUpdate = () => {
            if (debounceTimer === undefined) return;
            window.clearTimeout(debounceTimer);
            debounceTimer = undefined;
        };

        const scheduleHeadUpdate = (activeLeafMessageId: string) => {
            clearPendingHeadUpdate();

            debounceTimer = window.setTimeout(() => {
                debounceTimer = undefined;
                const state = runtime.thread.getState();

                if (state.isRunning) return;

                const lastMessage = state.messages.at(-1);
                const currentHead = lastMessage ? optionsRef.current.resolvePersistedMessageId(lastMessage.id) : null;

                if (currentHead !== activeLeafMessageId) return;

                conversationsRef.current.updateConversation(conversationId, { activeLeafMessageId }).catch((error) => {
                    console.error('Failed to persist active branch head:', error);
                    showErrorToast('Failed to save selected branch.');
                });
            }, HEAD_SYNC_DEBOUNCE_MS);
        };

        const unsubscribe = runtime.thread.subscribe(() => {
            const {
                isConversationLoading: isLoading,
                isForeignConversation: isForeign,
                isIncognitoMode: isIncognito,
                resolvePersistedMessageId: resolveId,
                isPersistedMessageId: isPersisted,
            } = optionsRef.current;
            const state = runtime.thread.getState();
            const wasRunning = wasRunningRef.current;

            wasRunningRef.current = state.isRunning;

            if (state.isRunning) {
                clearPendingHeadUpdate();

                return;
            }

            const lastMessage = state.messages.at(-1);
            const head = lastMessage ? resolveId(lastMessage.id) : null;
            const previousHead = headRef.current;
            const countGrew = state.messages.length > countRef.current;

            headRef.current = head;
            countRef.current = state.messages.length;

            if (head === previousHead) return;
            if (wasRunning || countGrew) return;
            if (isLoading || isForeign || isIncognito) return;
            if (!head || !isPersisted(head)) return;

            scheduleHeadUpdate(head);
        });

        return () => {
            unsubscribe();
            if (debounceTimer !== undefined) window.clearTimeout(debounceTimer);
        };
    }, [runtime, conversationId, agentId]);
}
