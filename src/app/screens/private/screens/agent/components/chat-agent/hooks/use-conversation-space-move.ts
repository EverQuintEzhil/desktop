import type { QueryClient } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';

import {
    getConversationAllQueryKey,
    getConversationFavoritesQueryKey,
    getConversationHistoryQueryKey,
    updateConversationHistoryData,
} from '@/components/agent-chat/hooks/use-conversation-history';
import { projectsKeys } from '@/components/agent-chat/hooks/use-projects';
import type { ConversationHistoryQueryData } from '@/components/agent-chat/types';
import { appConversationApi } from '@/lib/api/app/conversation';
import { showErrorToast, showSuccessToast } from '@/utils';

import { getConversationMetaQueryKey } from './use-conversation-meta';

interface MoveConversationToSpaceParams {
    agentId: string;
    conversationId: string;
    nextProjectId: string | null;
}

/**
 * Moves an existing conversation into a space (or removes it when `nextProjectId`
 * is `null`) and keeps the sidebar history, conversation meta and space caches in
 * sync. The history caches are patched optimistically for instant feedback and then
 * invalidated: the server list decides which conversations belong in the sidebar, so
 * a local patch alone leaves the list stale.
 */
export const moveConversationToSpace = async (
    queryClient: QueryClient,
    { agentId, conversationId, nextProjectId }: MoveConversationToSpaceParams,
): Promise<void> => {
    try {
        await appConversationApi.updateConversation(conversationId, { projectId: nextProjectId }, { agentId });

        const updater = (old: ConversationHistoryQueryData | undefined) =>
            old
                ? updateConversationHistoryData(old, {
                      _id: conversationId,
                      chat_project_id: nextProjectId ?? undefined,
                  })
                : undefined;

        queryClient.setQueryData(getConversationHistoryQueryKey(agentId), updater);
        queryClient.setQueryData(getConversationAllQueryKey(agentId), updater);
        queryClient.setQueryData(getConversationFavoritesQueryKey(agentId), updater);

        queryClient.invalidateQueries({ queryKey: getConversationMetaQueryKey(agentId, conversationId) });

        // Both the space being joined and the one being left need refreshing, and the
        // id of the latter is only known to callers through caches that lag the move.
        // Invalidating by prefix sidesteps that: only mounted queries refetch anyway.
        queryClient.invalidateQueries({ queryKey: projectsKeys.allConversations(agentId) });
        queryClient.invalidateQueries({ queryKey: projectsKeys.allSharedConversations(agentId) });
        queryClient.invalidateQueries({ queryKey: projectsKeys.allDetails() });

        showSuccessToast(nextProjectId ? 'Added to space' : 'Removed from space');

        // Awaited so callers can keep the moved conversation in a pending state
        // until the refreshed list arrives, instead of briefly showing the stale row.
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: getConversationHistoryQueryKey(agentId) }),
            queryClient.invalidateQueries({ queryKey: getConversationAllQueryKey(agentId) }),
            queryClient.invalidateQueries({ queryKey: getConversationFavoritesQueryKey(agentId) }),
        ]);
    } catch {
        showErrorToast(nextProjectId ? 'Failed to add to space' : 'Failed to remove from space');
    }
};

/** Hook wrapper around {@link moveConversationToSpace} bound to a single conversation. */
export const useConversationSpaceMove = (agentId: string, conversationId: string | null) => {
    const queryClient = useQueryClient();
    const isMovingRef = useRef(false);

    return useCallback(
        async (nextProjectId: string | null) => {
            // The header menu and composer picker stay interactive while the move runs, so
            // without this a second pick fires a competing PATCH for the same conversation.
            if (!conversationId || isMovingRef.current) return;

            isMovingRef.current = true;
            try {
                await moveConversationToSpace(queryClient, { agentId, conversationId, nextProjectId });
            } finally {
                isMovingRef.current = false;
            }
        },
        [agentId, conversationId, queryClient],
    );
};

export default useConversationSpaceMove;
