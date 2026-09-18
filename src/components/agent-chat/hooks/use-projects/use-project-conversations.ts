import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useCallback, useMemo, useRef } from 'react';

import {
    getConversationAllQueryKey,
    getConversationFavoritesQueryKey,
    getConversationHistoryQueryKey,
} from '@/components/agent-chat/hooks/use-conversation-history';
import { useChatHost } from '@/components/chat-host';
import type { PagedList } from '@/types/api-types';
import { mapProjectChat, type ProjectChatType } from '@/types/project';

import { DETAIL_PAGE_SIZE } from './constants';
import { projectsKeys } from './query-keys';

export const useProjectConversations = (agentId: string, projectId: string, enabled = true) => {
    const queryClient = useQueryClient();
    const { conversations } = useChatHost();
    const conversationsRef = useRef(conversations);

    conversationsRef.current = conversations;

    const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
        queryKey: projectsKeys.conversations(agentId, projectId),
        enabled: enabled && Boolean(agentId) && Boolean(projectId),
        initialPageParam: 0,
        queryFn: async ({ pageParam, signal }) => {
            const raw = (await conversationsRef.current.list(
                {
                    projectId,
                    page: pageParam,
                    size: DETAIL_PAGE_SIZE,
                },
                signal,
            )) as PagedList<unknown>;

            return {
                chats: raw.values.map((value) => mapProjectChat(value as never)),
                page: raw.pageInfo.page,
                totalPages: raw.pageInfo.totalPages,
            };
        },
        getNextPageParam: (lastPage) => (lastPage.page < lastPage.totalPages - 1 ? lastPage.page + 1 : undefined),
    });

    const chats = useMemo(() => (data?.pages ?? []).flatMap((page) => page.chats), [data]);

    const invalidateChatCaches = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: projectsKeys.conversations(agentId, projectId) });
        queryClient.invalidateQueries({ queryKey: getConversationHistoryQueryKey(agentId) });
        queryClient.invalidateQueries({ queryKey: getConversationAllQueryKey(agentId) });
        queryClient.invalidateQueries({ queryKey: getConversationFavoritesQueryKey(agentId) });
    }, [agentId, projectId, queryClient]);

    const toggleFavorite = useCallback(
        async (chatId: string) => {
            await conversationsRef.current.toggleFavorite(chatId);
            invalidateChatCaches();
        },
        [invalidateChatCaches],
    );

    const renameChat = useCallback(
        async (chatId: string, title: string) => {
            await conversationsRef.current.rename(chatId, title);
            invalidateChatCaches();
        },
        [invalidateChatCaches],
    );

    const deleteChat = useCallback(
        async (chatId: string) => {
            await conversationsRef.current.delete(chatId);
            invalidateChatCaches();
        },
        [invalidateChatCaches],
    );

    const moveChatToProject = useCallback(
        async (chatId: string, targetProjectId: string | null) => {
            type ConversationsData = InfiniteData<
                { chats: ProjectChatType[]; page: number; totalPages: number },
                number
            >;
            const key = projectsKeys.conversations(agentId, projectId);
            const previous = queryClient.getQueryData<ConversationsData>(key);

            queryClient.setQueryData<ConversationsData>(key, (current) => {
                if (!current?.pages) return current;

                return {
                    ...current,
                    pages: current.pages.map((page) => ({
                        ...page,
                        chats: page.chats.filter((chat) => chat._id !== chatId),
                    })),
                };
            });

            try {
                await conversationsRef.current.moveToProject(chatId, targetProjectId);
                invalidateChatCaches();
            } catch (error) {
                if (previous !== undefined) queryClient.setQueryData(key, previous);
                throw error;
            }
        },
        [agentId, projectId, queryClient, invalidateChatCaches],
    );

    return {
        chats,
        isLoading,
        hasNextPage: Boolean(hasNextPage),
        isFetchingNextPage,
        fetchNextPage,
        chatActions: {
            toggleFavorite,
            renameChat,
            deleteChat,
            moveChatToProject,
        },
    };
};
