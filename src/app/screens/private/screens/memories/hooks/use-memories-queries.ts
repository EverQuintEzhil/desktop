import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { adminMemoriesApi } from '@/lib/api/admin/memories';
import { adminMemoryDocsApi, MEMORY_DOCS_QUERY_KEY } from '@/lib/api/admin/memory-docs';

const PAGE_SIZE = 20;
const DOCS_PAGE_SIZE = 10;

export const useMemoriesCatalogQuery = (search: string) =>
    useInfiniteQuery({
        queryKey: ['memories', 'catalog', search],
        queryFn: ({ pageParam = 0, signal }) =>
            adminMemoriesApi.list(
                {
                    search: search || undefined,
                    size: PAGE_SIZE,
                    page: pageParam as number,
                },
                { signal },
            ),
        initialPageParam: 0,
        getNextPageParam: (lastPage) => {
            const { page, totalPages } = lastPage.pageInfo;

            return totalPages - page > 1 ? page + 1 : undefined;
        },
    });

export const useMemoryDetailQuery = (memoryId: string | undefined) =>
    useQuery({
        queryKey: ['memories', 'detail', memoryId],
        queryFn: () => adminMemoriesApi.getById(memoryId as string),
        enabled: !!memoryId,
    });

export type MemoryDocsSort = 'createdAt:asc' | 'createdAt:desc' | 'updatedAt:asc' | 'updatedAt:desc';

export const useMemoryDocsInfiniteQuery = (
    memoryId: string | undefined,
    userId: string | undefined,
    // Callers pass `false` when the docs must not be shown at all (admin-only learned
    // hints), so the hint text is never fetched or cached client-side.
    enabled = true,
    sortBy: MemoryDocsSort = 'updatedAt:desc',
) =>
    useInfiniteQuery({
        // Shares the admin docs key namespace so a doc deleted in the admin console
        // invalidates this list too — `useDeleteMemoryDocMutation` keys off [..., memoryId].
        queryKey: [...MEMORY_DOCS_QUERY_KEY, memoryId, 'infinite', userId, sortBy],
        queryFn: ({ pageParam = 0, signal }) =>
            adminMemoryDocsApi.list(
                memoryId as string,
                {
                    page: pageParam as number,
                    size: DOCS_PAGE_SIZE,
                    userId,
                    sortBy,
                },
                { signal },
            ),
        initialPageParam: 0,
        getNextPageParam: (lastPage) => {
            const { page, totalPages } = lastPage.pageInfo;

            return totalPages - page > 1 ? page + 1 : undefined;
        },
        enabled: enabled && !!memoryId && !!userId,
    });
