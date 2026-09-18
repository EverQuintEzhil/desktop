import { keepPreviousData, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import type { ConversationHistoryQueryData, UseConversationHistoryReturn } from '@/components/agent-chat/types';
import { useChatHost } from '@/components/chat-host';
import type { ChatAgentType } from '@/types/admin';
import type { PagedList } from '@/types/api-types';

import { FAVORITES_PAGE_SIZE, PAGE_SIZE } from './constants';
import {
    getConversationAllQueryKey,
    getConversationFavoritesQueryKey,
    getConversationHistoryQueryKey,
} from './query-keys';
import type { ConversationHistory, UseConversationHistoryOptions } from './types';
import {
    prependFavoritesData,
    removeFavoritesData,
    sortFavoritesByDate,
    updateFavoritesData,
} from './utils/conversation-favorites-cache';
import {
    createConversationHistoryData,
    getLoadedHistories,
    removeConversationHistoryData,
    updateConversationHistoryData,
} from './utils/conversation-history-cache';
import { mapConversationHistory } from './utils/map-conversation-history';

const useConversationHistory = (
    agent: ChatAgentType,
    options: UseConversationHistoryOptions = {},
): UseConversationHistoryReturn => {
    const { includeAll = false, search = '', enabled = true } = options;
    const trimmedSearch = search.trim();
    const { conversations } = useChatHost();
    const queryClient = useQueryClient();
    const queryKey = getConversationHistoryQueryKey(agent._id);
    const favoritesQueryKey = getConversationFavoritesQueryKey(agent._id);
    const allQueryKey = getConversationAllQueryKey(agent._id, trimmedSearch);

    const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = useInfiniteQuery({
        queryKey,
        enabled: !includeAll && enabled,
        queryFn: async ({ pageParam = 0, signal }) => {
            const result = (await conversations.list(
                { favorite: false, page: pageParam as number, size: PAGE_SIZE },
                signal,
            )) as PagedList<ConversationHistory>;

            return {
                ...result,
                values: result.values.map(mapConversationHistory),
            };
        },
        initialPageParam: 0,
        getNextPageParam: (lastPage) => {
            const { page, totalPages } = lastPage.pageInfo;

            return totalPages - page > 1 ? page + 1 : undefined;
        },
    });

    const histories = useMemo(() => data?.pages.flatMap((page) => page.values) || [], [data]);

    const lastPageInfo = data?.pages.at(-1)?.pageInfo;

    const {
        data: favoritesData,
        isLoading: isFavoritesLoading,
        fetchNextPage: fetchNextFavoritesPage,
        hasNextPage: hasNextFavoritesPage,
        isFetchingNextPage: isFetchingNextFavoritesPage,
    } = useInfiniteQuery({
        queryKey: favoritesQueryKey,
        enabled: !includeAll && enabled,
        queryFn: async ({ pageParam = 0, signal }) => {
            const result = (await conversations.list(
                { favorite: true, page: pageParam as number, size: FAVORITES_PAGE_SIZE },
                signal,
            )) as PagedList<ConversationHistory>;

            return {
                ...result,
                values: result.values.map(mapConversationHistory),
            };
        },
        initialPageParam: 0,
        getNextPageParam: (lastPage) => {
            const { page, totalPages } = lastPage.pageInfo;

            return totalPages - page > 1 ? page + 1 : undefined;
        },
    });

    const favoriteHistories = useMemo(
        () => sortFavoritesByDate(favoritesData?.pages.flatMap((page) => page.values) || []),
        [favoritesData],
    );

    const favoritesPageInfo = favoritesData?.pages.at(-1)?.pageInfo;

    const {
        data: allData,
        isLoading: isAllLoading,
        isError: isAllError,
        fetchNextPage: fetchNextAllPage,
        hasNextPage: hasNextAllPage,
        isFetchingNextPage: isFetchingNextAllPage,
        refetch: refetchAll,
    } = useInfiniteQuery({
        queryKey: allQueryKey,
        enabled: includeAll && enabled,
        placeholderData: keepPreviousData,
        queryFn: async ({ pageParam = 0, signal }) => {
            const result = (await conversations.list(
                { page: pageParam as number, size: PAGE_SIZE, search: trimmedSearch || undefined },
                signal,
            )) as PagedList<ConversationHistory>;

            return {
                ...result,
                values: result.values.map(mapConversationHistory),
            };
        },
        initialPageParam: 0,
        getNextPageParam: (lastPage) => {
            const { page, totalPages } = lastPage.pageInfo;

            return totalPages - page > 1 ? page + 1 : undefined;
        },
    });

    const allHistories = useMemo(() => allData?.pages.flatMap((page) => page.values) || [], [allData]);

    const allPageInfo = allData?.pages.at(-1)?.pageInfo;

    const deleteConversationMutation = useMutation({
        mutationFn: async ({ historyId }: { historyId: string }) => conversations.delete(historyId),
        onSuccess: (_, { historyId }) => {
            queryClient.setQueryData<ConversationHistoryQueryData | undefined>(queryKey, (currentData) =>
                removeConversationHistoryData(currentData, historyId),
            );
            queryClient.setQueryData<ConversationHistoryQueryData | undefined>(allQueryKey, (currentData) =>
                removeConversationHistoryData(currentData, historyId),
            );
            queryClient.setQueryData<ConversationHistoryQueryData | undefined>(favoritesQueryKey, (currentData) =>
                removeFavoritesData(currentData, historyId),
            );
        },
    });

    const clearAllConversationsMutation = useMutation({
        mutationFn: async ({ force = false }: { force?: boolean }) => conversations.deleteAll({ force }),
        onSuccess: () => {
            queryClient.setQueryData<ConversationHistoryQueryData>(queryKey, createConversationHistoryData([], 1, 0));
            queryClient.setQueryData<ConversationHistoryQueryData>(
                allQueryKey,
                createConversationHistoryData([], 1, 0),
            );
            queryClient.setQueryData<ConversationHistoryQueryData>(
                favoritesQueryKey,
                createConversationHistoryData([], 1, 0, FAVORITES_PAGE_SIZE),
            );
        },
    });

    const renameConversationMutation = useMutation({
        mutationFn: async ({ historyId, title }: { historyId: string; title: string }) =>
            conversations.rename(historyId, title),
        onSuccess: (_, { historyId, title }) => {
            queryClient.setQueryData<ConversationHistoryQueryData | undefined>(queryKey, (currentData) =>
                updateConversationHistoryData(currentData, { _id: historyId, title }),
            );
            queryClient.setQueryData<ConversationHistoryQueryData | undefined>(allQueryKey, (currentData) =>
                updateConversationHistoryData(currentData, { _id: historyId, title }),
            );
            queryClient.setQueryData<ConversationHistoryQueryData | undefined>(favoritesQueryKey, (currentData) =>
                updateFavoritesData(currentData, { _id: historyId, title }),
            );
        },
    });

    const applyFavoriteState = useCallback(
        (historyId: string, favorited: boolean, favoritedAt: number | null) => {
            queryClient.setQueryData<ConversationHistoryQueryData | undefined>(queryKey, (currentData) =>
                updateConversationHistoryData(currentData, {
                    _id: historyId,
                    favorited,
                    favorited_at: favoritedAt,
                }),
            );

            queryClient.setQueryData<ConversationHistoryQueryData | undefined>(allQueryKey, (currentData) =>
                updateConversationHistoryData(currentData, {
                    _id: historyId,
                    favorited,
                    favorited_at: favoritedAt,
                }),
            );

            queryClient.setQueryData<ConversationHistoryQueryData | undefined>(favoritesQueryKey, (currentData) => {
                if (!favorited) {
                    return removeFavoritesData(currentData, historyId);
                }

                const favoritesLoaded = getLoadedHistories(currentData);
                const historyLoaded = getLoadedHistories(
                    queryClient.getQueryData<ConversationHistoryQueryData>(queryKey),
                );
                const allLoaded = getLoadedHistories(
                    queryClient.getQueryData<ConversationHistoryQueryData>(allQueryKey),
                );
                const base =
                    favoritesLoaded.find((item) => item._id === historyId) ??
                    historyLoaded.find((item) => item._id === historyId) ??
                    allLoaded.find((item) => item._id === historyId);

                if (!base) {
                    return currentData;
                }

                return prependFavoritesData(currentData, { ...base, favorited: true, favorited_at: favoritedAt });
            });
        },
        [queryClient, queryKey, favoritesQueryKey, allQueryKey],
    );

    const favoriteConversationMutation = useMutation({
        mutationFn: async ({ historyId }: { historyId: string }) => conversations.toggleFavorite(historyId),
        onMutate: async ({ historyId }: { historyId: string }) => {
            await Promise.all([
                queryClient.cancelQueries({ queryKey }),
                queryClient.cancelQueries({ queryKey: allQueryKey }),
                queryClient.cancelQueries({ queryKey: favoritesQueryKey }),
            ]);

            const previousHistory = queryClient.getQueryData<ConversationHistoryQueryData>(queryKey);
            const previousAll = queryClient.getQueryData<ConversationHistoryQueryData>(allQueryKey);
            const previousFavorites = queryClient.getQueryData<ConversationHistoryQueryData>(favoritesQueryKey);

            const currentItem =
                getLoadedHistories(previousFavorites).find((item) => item._id === historyId) ??
                getLoadedHistories(previousAll).find((item) => item._id === historyId) ??
                getLoadedHistories(previousHistory).find((item) => item._id === historyId);
            const nextFavorited = !(currentItem?.favorited ?? false);

            applyFavoriteState(historyId, nextFavorited, nextFavorited ? Date.now() : null);

            return { previousHistory, previousAll, previousFavorites };
        },
        onError: (_error, _variables, context) => {
            if (context?.previousHistory !== undefined) {
                queryClient.setQueryData(queryKey, context.previousHistory);
            }
            if (context?.previousAll !== undefined) {
                queryClient.setQueryData(allQueryKey, context.previousAll);
            }
            if (context?.previousFavorites !== undefined) {
                queryClient.setQueryData(favoritesQueryKey, context.previousFavorites);
            }
        },
        onSuccess: (result, { historyId }) => {
            applyFavoriteState(historyId, result?.favorited ?? false, result?.favoritedAt ?? null);
        },
    });

    const fetchConversations = useCallback(
        async (page: number) => {
            if (page === 0) {
                await refetch();

                return;
            }

            if (hasNextPage) {
                await fetchNextPage();
            }
        },
        [fetchNextPage, hasNextPage, refetch],
    );

    const fetchAllConversations = useCallback(
        async (page: number) => {
            if (page === 0) {
                await refetchAll();

                return;
            }

            if (hasNextAllPage) {
                await fetchNextAllPage();
            }
        },
        [fetchNextAllPage, hasNextAllPage, refetchAll],
    );

    const fetchFavorites = useCallback(async () => {
        if (hasNextFavoritesPage) {
            await fetchNextFavoritesPage();
        }
    }, [fetchNextFavoritesPage, hasNextFavoritesPage]);

    const deleteConversation = useCallback(
        async (historyId: string, onSuccess?: () => void) => {
            await deleteConversationMutation.mutateAsync({ historyId });
            onSuccess?.();
        },
        [deleteConversationMutation],
    );

    const clearAllConversations = useCallback(
        async (force: boolean = false) => {
            await clearAllConversationsMutation.mutateAsync({ force });
        },
        [clearAllConversationsMutation],
    );

    const renameConversation = useCallback(
        async (historyId: string, title: string, onSuccess?: () => void) => {
            await renameConversationMutation.mutateAsync({ historyId, title });
            onSuccess?.();
        },
        [renameConversationMutation],
    );

    const favoriteConversation = useCallback(
        async (historyId: string, onSuccess?: () => void) => {
            await favoriteConversationMutation.mutateAsync({ historyId });
            onSuccess?.();
        },
        [favoriteConversationMutation],
    );

    return {
        histories,
        favoriteHistories,
        allHistories,
        state: {
            loading: isLoading,
            error: isError && histories.length === 0,
            page: lastPageInfo?.page || 0,
            pages: lastPageInfo?.totalPages || 0,
            showMoreLoading: isFetchingNextPage,
            favoritesLoading: isFavoritesLoading,
            allLoading: isAllLoading,
            allError: isAllError && allHistories.length === 0,
            allPage: allPageInfo?.page || 0,
            allPages: allPageInfo?.totalPages || 0,
            allShowMoreLoading: isFetchingNextAllPage,
            favoritesPage: favoritesPageInfo?.page || 0,
            favoritesPages: favoritesPageInfo?.totalPages || 0,
            favoritesShowMoreLoading: isFetchingNextFavoritesPage,
        },
        fetchConversations,
        fetchAllConversations,
        fetchFavorites,
        deleteConversation,
        clearAllConversations,
        renameConversation,
        favoriteConversation,
        isDeleteSubmitting: deleteConversationMutation.isPending,
        isRenameSubmitting: renameConversationMutation.isPending,
        isFavoriteSubmitting: favoriteConversationMutation.isPending,
    };
};

export default useConversationHistory;
