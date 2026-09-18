import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';

import { appMediaApi } from '@/lib/api/app/media';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import type { FileApiResponse, GeneratedItem } from '@/types/gallery';
import { showErrorToast } from '@/utils';

import { dedupeById } from '../../utils/dedupe-by-id';

import { FETCH_ERROR_MESSAGE, PAGE_SIZE } from './constants';
import { buildGalleryQueryKey, mapFileToItem } from './gallery-media-helpers';
import type { GalleryInfiniteData, GalleryPage, GalleryQueryKey, GalleryTab } from './types';

interface UseGalleryHistoryQueryArgs {
    agentId: string;
    creatorId: string | undefined;
    activeTab: GalleryTab;
    searchQuery: string;
    userId: string;
}

export interface UseGalleryHistoryQueryResult {
    queryKey: GalleryQueryKey;
    serverItems: GeneratedItem[];
    fetchFileById: (fileId: string) => Promise<GeneratedItem | null>;
    isLoading: boolean;
    errorMessage: string | null;
    isFetchingNextPage: boolean;
    lastPageInfo: { page: number; totalPages: number } | undefined;
    retryFetch: () => Promise<void>;
    loadMore: () => void;
    removeItem: (id: string, currentHistory: GeneratedItem[]) => GeneratedItem[];
    onItemChange: (item: GeneratedItem) => void;
    onLikeItemClicked: (item: GeneratedItem) => void;
}

export const useGalleryHistoryQuery = (args: UseGalleryHistoryQueryArgs): UseGalleryHistoryQueryResult => {
    const { agentId, creatorId, activeTab, searchQuery, userId } = args;

    const queryClient = useQueryClient();

    const queryKey = useMemo(
        () => buildGalleryQueryKey(agentId, creatorId, activeTab, searchQuery),
        [agentId, creatorId, activeTab, searchQuery],
    );

    const galleryQuery = useInfiniteQuery<GalleryPage, Error, GalleryInfiniteData, GalleryQueryKey, number>({
        queryKey,
        queryFn: async ({ pageParam, signal }) => {
            const response = await appMediaApi.listFiles<FileApiResponse>(
                {
                    page: pageParam,
                    size: PAGE_SIZE,
                    agentId,
                    search: searchQuery.trim() || undefined,
                    mineOnly: creatorId || activeTab === 'fav' ? undefined : activeTab === 'my',
                    aiGenerated: true,
                    creatorId,
                    liked: activeTab === 'fav' ? true : undefined,
                },
                { signal },
            );
            const items = (response.values as unknown as GeneratedItem[]).map((item) => mapFileToItem(item, userId));

            return { items, pageInfo: response.pageInfo };
        },
        initialPageParam: 0,
        enabled: !!agentId,
        getNextPageParam: (lastPage) =>
            lastPage.pageInfo.page < lastPage.pageInfo.totalPages - 1 ? lastPage.pageInfo.page + 1 : undefined,
        staleTime: 0,
        refetchOnWindowFocus: false,
    });

    const { data, isLoading, isError, isFetchingNextPage, hasNextPage, fetchNextPage, refetch, errorUpdatedAt, error } =
        galleryQuery;

    const errorMessage = isError ? getApiErrorMessage(error, FETCH_ERROR_MESSAGE) : null;

    const retryFetch = useCallback(async () => {
        await refetch();
    }, [refetch]);

    // Keyed on `errorUpdatedAt`, not just `isError`: a Retry that fails again
    // leaves `isError` true throughout, so without the timestamp the second
    // failure would pass silently.
    useEffect(() => {
        if (isError) showErrorToast(errorMessage ?? FETCH_ERROR_MESSAGE);
    }, [isError, errorUpdatedAt]);

    const serverItems = useMemo(() => dedupeById((data?.pages ?? []).flatMap((page) => page.items)), [data]);

    const fetchFileById = useCallback(
        async (fileId: string): Promise<GeneratedItem | null> => {
            try {
                const value = await appMediaApi.getFile<FileApiResponse>(fileId);

                if (!value || (value as { is_deleted?: boolean }).is_deleted === true) {
                    return null;
                }

                return mapFileToItem(value as unknown as GeneratedItem, userId);
            } catch {
                return null;
            }
        },
        [userId],
    );

    const lastPageInfo = data?.pages[data.pages.length - 1]?.pageInfo;

    const loadMore = useCallback(() => {
        if (hasNextPage && !isFetchingNextPage) fetchNextPage();
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    const removeItem = useCallback(
        (id: string, currentHistory: GeneratedItem[]): GeneratedItem[] => {
            queryClient.setQueryData<GalleryInfiniteData>(queryKey, (old) => {
                if (!old) return old;

                return {
                    ...old,
                    pages: old.pages.map((page) => ({
                        ...page,
                        items: page.items.filter((item) => item._id !== id),
                    })),
                };
            });

            return currentHistory.filter((item) => item._id !== id);
        },
        [queryClient, queryKey],
    );

    const onItemChange = useCallback(
        (item: GeneratedItem) => {
            if (!item?._id) return;

            queryClient.setQueryData<GalleryInfiniteData>(queryKey, (old) => {
                if (!old) return old;

                return {
                    ...old,
                    pages: old.pages.map((page) => ({
                        ...page,
                        items: page.items.map((existing) =>
                            existing._id === item._id ? { ...existing, ...item } : existing,
                        ),
                    })),
                };
            });
        },
        [queryClient, queryKey],
    );

    const onLikeItemClicked = useCallback(
        (item: GeneratedItem) => {
            if (!item?._id) return;

            const newLikes = item.isLikedByThisUser
                ? [...(item?.likes || []).filter((id): id is string => id != null), userId]
                : (item?.likes || []).filter((id): id is string => id != null && id !== userId);

            queryClient.setQueryData<GalleryInfiniteData>(queryKey, (old) => {
                if (!old) return old;

                return {
                    ...old,
                    pages: old.pages.map((page) => ({
                        ...page,
                        items: page.items.map((existing) =>
                            existing._id === item._id
                                ? {
                                      ...existing,
                                      isLikedByThisUser: item.isLikedByThisUser,
                                      likes_count: item.likes_count,
                                      likes: newLikes as string[],
                                  }
                                : existing,
                        ),
                    })),
                };
            });
        },
        [queryClient, queryKey, userId],
    );

    return {
        queryKey,
        serverItems,
        fetchFileById,
        isLoading,
        errorMessage,
        isFetchingNextPage,
        lastPageInfo,
        retryFetch,
        loadMore,
        removeItem,
        onItemChange,
        onLikeItemClicked,
    };
};
