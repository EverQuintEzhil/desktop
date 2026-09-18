import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import qs from 'qs';

import type { UserType } from '@/types/admin';
import type { PagedList, RawPagedList } from '@/types/api-types';

import { apiClient, type ApiRequestConfig } from '../client';
import { mapPagedList } from '../mappers';

export interface MemoryDoc {
    id: string;
    scope: string;
    userId: string;
    agentId: string;
    text: string;
    metadata: unknown;
    user?: UserType | null;
    createdAt: string;
    updatedAt: string;
}

export interface MemoryDocHistoryEntry {
    id: string;
    memoryRef: string;
    itemId: string;
    op: 'ADD' | 'UPDATE' | 'DELETE' | 'NOOP';
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    trigger: {
        conversationId: string;
        turnId: string;
    };
    extractor: {
        model: string;
        promptVersion: string;
    };
    actorUserId: string | null;
    ts: string;
}

export interface MemoryDocWithHistory extends MemoryDoc {
    history: MemoryDocHistoryEntry[];
}

export interface MemoryDocsQueryParams {
    memoryId: string;
    search?: string;
    agentId?: string;
    userId?: string;
    scope?: string;
    page?: number;
    size?: number;
    sortBy?: string;
}

export interface MemoryHistoryQueryParams {
    memoryId: string;
    userId?: string;
    agentId?: string;
    docId?: string;
    op?: string;
    from?: string;
    to?: string;
    page?: number;
    size?: number;
}

export const adminMemoryDocsApi = {
    async list(
        memoryId: string,
        params: Omit<MemoryDocsQueryParams, 'memoryId'> = {},
        config?: ApiRequestConfig,
    ): Promise<PagedList<MemoryDoc>> {
        const raw = await apiClient.get<RawPagedList<MemoryDoc>>(`/memories/${memoryId}/docs`, {
            params,
            paramsSerializer: (p) => qs.stringify(p, { arrayFormat: 'repeat' }),
            ...config,
        });

        return mapPagedList(raw);
    },

    async getById(
        memoryId: string,
        docId: string,
        includeHistory = true,
        config?: ApiRequestConfig,
    ): Promise<MemoryDocWithHistory> {
        return apiClient.get<MemoryDocWithHistory>(`/memories/${memoryId}/docs/${encodeURIComponent(docId)}`, {
            params: { includeHistory },
            ...config,
        });
    },

    async delete(memoryId: string, docId: string, config?: ApiRequestConfig): Promise<{ deleted: boolean }> {
        return apiClient.delete<{ deleted: boolean }>(
            `/memories/${memoryId}/docs/${encodeURIComponent(docId)}`,
            config,
        );
    },
};

export const adminMemoryHistoryApi = {
    async list(
        memoryId: string,
        params: Omit<MemoryHistoryQueryParams, 'memoryId'> = {},
        config?: ApiRequestConfig,
    ): Promise<PagedList<MemoryDocHistoryEntry>> {
        const raw = await apiClient.get<RawPagedList<MemoryDocHistoryEntry>>(`/memories/${memoryId}/history`, {
            params,
            paramsSerializer: (p) => qs.stringify(p, { arrayFormat: 'repeat' }),
            ...config,
        });

        return mapPagedList(raw);
    },
};

export const MEMORY_DOCS_QUERY_KEY = ['admin', 'memory-docs'] as const;

export function useMemoryDocsQuery(params: MemoryDocsQueryParams) {
    const { memoryId, ...rest } = params;

    return useQuery({
        queryKey: [...MEMORY_DOCS_QUERY_KEY, memoryId, rest],
        queryFn: () => adminMemoryDocsApi.list(memoryId, rest),
        placeholderData: keepPreviousData,
        enabled: !!memoryId,
    });
}

export const MEMORY_HISTORY_QUERY_KEY = ['admin', 'memory-history'] as const;

export function useMemoryHistoryQuery(params: MemoryHistoryQueryParams) {
    const { memoryId, ...rest } = params;

    return useQuery({
        queryKey: [...MEMORY_HISTORY_QUERY_KEY, memoryId, rest],
        queryFn: () => adminMemoryHistoryApi.list(memoryId, rest),
        placeholderData: keepPreviousData,
        enabled: !!memoryId,
    });
}

export function useMemoryDocDetailQuery(memoryId: string, docId: string | null) {
    return useQuery({
        queryKey: [...MEMORY_DOCS_QUERY_KEY, 'detail', memoryId, docId],
        queryFn: () => adminMemoryDocsApi.getById(memoryId, docId!),
        enabled: !!memoryId && !!docId,
    });
}

export function useDeleteMemoryDocMutation(memoryId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (docId: string) => adminMemoryDocsApi.delete(memoryId, docId),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: [...MEMORY_DOCS_QUERY_KEY, memoryId] });
            void queryClient.invalidateQueries({ queryKey: [...MEMORY_HISTORY_QUERY_KEY, memoryId] });
        },
    });
}
