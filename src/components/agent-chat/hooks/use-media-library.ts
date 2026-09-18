import type { InfiniteData } from '@tanstack/react-query';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { useEmbeddingStatusPoll } from '@/components/agent-chat/hooks/use-embedding-status-poll';
import { appAgentApi } from '@/lib/api/app/agent';
import type { PagedList } from '@/types/api-types';
import type { FileApiResponse } from '@/types/gallery';
import { definedFieldsOf, showErrorToast } from '@/utils';

const PAGE_SIZE = 20;

export type LibraryScope = 'all' | 'yours' | 'shared';

export const VALID_SCOPES: LibraryScope[] = ['all', 'yours', 'shared'];

export const normalizeScope = (value?: string): LibraryScope => {
    return VALID_SCOPES.includes(value as LibraryScope) ? (value as LibraryScope) : 'yours';
};

export type LibrarySort = 'newest' | 'oldest' | 'largest' | 'smallest';

export interface LibraryFilters {
    source?: 'uploaded' | 'generated';
    fileType?: 'image' | 'document' | 'spreadsheet' | 'presentation' | 'pdf' | 'video';
    liked?: boolean;
    deleted?: boolean;
    agentId?: string;
    projectId?: string;
    originTypes?: string[];
    sort: LibrarySort;
}

const SORT_BY_MAP: Record<LibrarySort, string> = {
    newest: 'updated_at:desc',
    oldest: 'updated_at:asc',
    largest: 'meta.size:desc',
    smallest: 'meta.size:asc',
};

export interface LibraryItem {
    _id: string;
    agentId: string;
    agentName?: string;
    agentSlug?: string;
    modelName?: string;
    name: string;
    title: string;
    extension: string;
    type: string;
    url: string;
    thumbnailUrl: string;
    isGenerated: boolean;
    conversationId: string | null;
    originType: string | null;
    projectId: string | null;
    creatorId: string;
    creatorName: string;
    isPublic: boolean;
    isMyItem: boolean;
    isLikedByThisUser: boolean;
    likes: string[];
    likesCount: number;
    size?: number;
    aspectRatio?: number;
    embeddingStatus?: string;
    embeddingError?: string | null;
    createdAt: number;
    updatedAt: number;
}

interface UseMediaLibraryOptions {
    agentId?: string;
    userId: string;
    scope: LibraryScope;
    searchQuery: string;
    filters: LibraryFilters;
}

type MediaLibraryQueryData = InfiniteData<PagedList<LibraryItem>, number>;

export const buildListFilesParams = (
    agentId: string | undefined,
    scope: LibraryScope,
    searchQuery: string,
    filters: LibraryFilters,
    page: number,
    size: number,
): Record<string, unknown> => {
    const params: Record<string, unknown> = {
        page,
        size,
        resolveAgent: true,
        scope: scope === 'yours' ? 'mine' : scope,
        sortBy: SORT_BY_MAP[filters.sort] ?? SORT_BY_MAP.newest,
    };

    const search = searchQuery.trim();

    if (search) params.search = search;
    if (filters.source === 'uploaded') params.aiGenerated = false;
    if (filters.source === 'generated') params.aiGenerated = true;
    if (filters.fileType) params.type = filters.fileType;
    if (filters.liked) params.liked = true;
    if (filters.deleted) params.deletedOnly = true;

    const resolvedAgentId = agentId ?? filters.agentId;

    if (resolvedAgentId) params.agentId = resolvedAgentId;
    if (filters.projectId) params.projectId = filters.projectId;
    if (filters.originTypes?.length) params.originTypes = filters.originTypes;

    return params;
};

const getMediaLibraryQueryKey = (
    agentId: string | undefined,
    scope: LibraryScope,
    searchQuery: string,
    filters: LibraryFilters,
) =>
    [
        'media-library',
        agentId ?? 'global',
        scope,
        searchQuery.trim(),
        filters.source ?? null,
        filters.fileType ?? null,
        filters.liked ?? false,
        filters.deleted ?? false,
        filters.agentId ?? null,
        filters.projectId ?? null,
        filters.originTypes?.join(',') ?? null,
        filters.sort,
    ] as const;

export const toLibraryItem = (item: FileApiResponse, userId: string): LibraryItem => ({
    _id: item._id,
    agentId: item.agent_id,
    agentName: item.agent_name,
    agentSlug: item.agent_slug,
    modelName: item.ai?.model_name,
    name: item.name,
    title: item.title,
    extension: item.extension,
    type: item.type,
    url: item.url,
    thumbnailUrl: item.thumbnail_url,
    isGenerated: item.ai?.generated ?? false,
    conversationId: item.origin?.conversation_id ?? item.conversation_id ?? null,
    originType: item.origin?.type ?? null,
    projectId: item.origin?.project_id ?? null,
    creatorId: item.creator_id,
    creatorName: item.creator_name,
    isPublic: item.is_public,
    isMyItem: item.creator_id === userId,
    isLikedByThisUser: item.likes?.includes(userId) ?? false,
    likes: (item.likes ?? []).filter((id): id is string => Boolean(id)),
    likesCount: item.likes_count ?? 0,
    size: item.meta?.size,
    aspectRatio: item.meta?.aspect_ratio,
    embeddingStatus: item.embedding_status,
    embeddingError: item.embedding_error,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
});

const updateItems = (
    currentData: MediaLibraryQueryData | undefined,
    updater: (item: LibraryItem) => LibraryItem | null,
): MediaLibraryQueryData | undefined => {
    if (!currentData) return currentData;

    return {
        ...currentData,
        pages: currentData.pages.map((page) => ({
            ...page,
            values: page.values.map(updater).filter((item): item is LibraryItem => Boolean(item)),
        })),
    };
};

const useMediaLibrary = ({ agentId, userId, scope, searchQuery, filters }: UseMediaLibraryOptions) => {
    const queryClient = useQueryClient();
    const queryKey = getMediaLibraryQueryKey(agentId, scope, searchQuery, filters);

    const { data, isLoading, isError, isFetchingNextPage, fetchNextPage, hasNextPage } = useInfiniteQuery({
        queryKey,
        queryFn: async ({ pageParam = 0, signal }) => {
            const result = await appAgentApi.listFiles<FileApiResponse>(
                buildListFilesParams(agentId, scope, searchQuery, filters, pageParam as number, PAGE_SIZE),
                { signal },
            );

            return {
                ...result,
                values: (result.values || []).map((item) => toLibraryItem(item, userId)),
            };
        },
        initialPageParam: 0,
        getNextPageParam: (lastPage) => {
            const { page, totalPages } = lastPage.pageInfo;

            return totalPages - page > 1 ? page + 1 : undefined;
        },
        staleTime: 0,
        gcTime: 0,
        refetchOnMount: 'always',
    });

    const deleteItemMutation = useMutation({
        mutationFn: (itemId: string) => appAgentApi.deleteFile(itemId),
        onSuccess: (_, itemId) => {
            queryClient.setQueryData<MediaLibraryQueryData>(queryKey, (currentData) =>
                updateItems(currentData, (item) => (item._id === itemId ? null : item)),
            );
        },
        onError: (error) => {
            console.error(error);
            showErrorToast('Failed to delete item. Please try again.');
        },
    });

    const setVisibilityMutation = useMutation({
        mutationFn: ({ itemId, isPublic }: { itemId: string; isPublic: boolean }) =>
            appAgentApi.updateFile(itemId, { isPublic }),
        onMutate: ({ itemId, isPublic }) => {
            const previous = queryClient.getQueryData<MediaLibraryQueryData>(queryKey);

            queryClient.setQueryData<MediaLibraryQueryData>(queryKey, (currentData) =>
                updateItems(currentData, (item) => (item._id === itemId ? { ...item, isPublic } : item)),
            );

            return { previous };
        },
        onError: (error, _variables, context) => {
            if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
            console.error(error);
            showErrorToast('Failed to update visibility. Please try again.');
        },
    });

    const history = useMemo(() => data?.pages.flatMap((page) => page.values) || [], [data]);

    const lastPageInfo = data?.pages.at(-1)?.pageInfo;

    const updateItem = useCallback(
        (item: LibraryItem) => {
            if (!item?._id) return;

            queryClient.setQueryData<MediaLibraryQueryData>(queryKey, (currentData) =>
                updateItems(currentData, (currentItem) => {
                    if (currentItem._id !== item._id) return currentItem;

                    return {
                        ...currentItem,
                        ...definedFieldsOf(item),
                    };
                }),
            );
        },
        [queryClient, queryKey],
    );

    useEmbeddingStatusPoll<LibraryItem>({
        items: history,
        getId: (item) => item._id,
        getStatus: (item) => item.embeddingStatus,
        fetchFile: async (id, signal) => {
            // Without resolveAgent the single-file payload carries only agent_id, so the polled
            // item would come back with no agent name or slug for the attribution link.
            const raw = await appAgentApi.getFile<FileApiResponse>(id, { params: { resolveAgent: true }, signal });

            return toLibraryItem(raw, userId);
        },
        onUpdate: updateItem,
    });

    const updateLikeItem = useCallback(
        (item: LibraryItem) => {
            if (!item?._id) return;

            const newLikes = item.isLikedByThisUser
                ? [...item.likes.filter((id) => id !== userId), userId]
                : item.likes.filter((id) => id !== userId);

            queryClient.setQueryData<MediaLibraryQueryData>(queryKey, (currentData) =>
                updateItems(currentData, (currentItem) => {
                    if (currentItem._id !== item._id) return currentItem;

                    if (filters.liked && !item.isLikedByThisUser) return null;

                    return {
                        ...currentItem,
                        isLikedByThisUser: item.isLikedByThisUser,
                        likesCount: item.likesCount,
                        likes: newLikes,
                    };
                }),
            );

            queryClient.invalidateQueries({
                queryKey: ['media-library'],
                refetchType: 'none',
            });
        },
        [queryClient, queryKey, userId, filters.liked],
    );

    const deleteItem = useCallback(
        async (itemId: string) => {
            await deleteItemMutation.mutateAsync(itemId);
        },
        [deleteItemMutation],
    );

    const setItemVisibility = useCallback(
        async (itemId: string, isPublic: boolean) => {
            await setVisibilityMutation.mutateAsync({ itemId, isPublic });
        },
        [setVisibilityMutation],
    );

    return {
        state: {
            history,
            loading: isLoading,
            error: isError ? 'Failed to fetch library. Please try again.' : null,
            page: lastPageInfo?.page || 0,
            pages: lastPageInfo?.totalPages || 0,
            showMoreLoading: isFetchingNextPage,
        },
        fetchNextPage,
        hasNextPage,
        updateItem,
        updateLikeItem,
        deleteItem,
        isDeleteSubmitting: deleteItemMutation.isPending,
        setItemVisibility,
        visibilityUpdatingId: setVisibilityMutation.isPending
            ? (setVisibilityMutation.variables?.itemId ?? null)
            : null,
    };
};

export default useMediaLibrary;
