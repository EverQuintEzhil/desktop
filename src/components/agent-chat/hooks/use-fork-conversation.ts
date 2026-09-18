import { useAuiState } from '@assistant-ui/react';
import { useState } from 'react';

import { useChatHost } from '@/components/chat-host';
import { showErrorToast } from '@/utils';

import type { BranchResult } from '../types';

export const useForkConversation = (conversationId: string | null) => {
    const { conversations, navigation } = useChatHost();
    const lastMessageId = useAuiState((s) => s.thread.messages.at(-1)?.id ?? null);
    const [isPending, setIsPending] = useState(false);

    const fork = async (pendingPrompt?: string) => {
        if (!conversationId || !lastMessageId) return;

        setIsPending(true);

        try {
            const result = (await conversations.branch(conversationId, { messageId: lastMessageId })) as BranchResult;

            navigation.setConversationId(result._id, { pendingPrompt });
        } catch (error) {
            showErrorToast('Failed to branch conversation. Please try again.');
            console.error('Failed to branch conversation', error);
        } finally {
            setIsPending(false);
        }
    };

    return { fork, isPending, canFork: Boolean(conversationId && lastMessageId) };
};
