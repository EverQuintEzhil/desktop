import type { QueryClient } from '@tanstack/react-query';

import type { ConversationHistoryQueryData } from '@/components/agent-chat/types';
import type { ConversationStatus } from '@/types/chat';

import { getConversationFavoritesQueryKey, getConversationHistoryQueryKey } from '../query-keys';

import { updateFavoritesData } from './conversation-favorites-cache';
import { updateConversationHistoryData } from './conversation-history-cache';

// Patches one row's status across every loaded conversation list without refetching.
// The `conversation-all` key is search-scoped, so it is matched by prefix.
export const setConversationStatusInCache = (
    queryClient: QueryClient,
    agentId: string,
    conversationId: string,
    status: ConversationStatus,
) => {
    const patch = { _id: conversationId, status };

    queryClient.setQueryData<ConversationHistoryQueryData>(getConversationHistoryQueryKey(agentId), (current) =>
        updateConversationHistoryData(current, patch),
    );

    queryClient.setQueryData<ConversationHistoryQueryData>(getConversationFavoritesQueryKey(agentId), (current) =>
        updateFavoritesData(current, patch),
    );

    queryClient.setQueriesData<ConversationHistoryQueryData>({ queryKey: ['conversation-all', agentId] }, (current) =>
        updateConversationHistoryData(current, patch),
    );
};
