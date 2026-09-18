import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SortingState } from '@tanstack/react-table';
import qs from 'qs';

import type { MemoryType } from '@/types/admin';
import type { PagedList, RawPagedList } from '@/types/api-types';

import { apiClient, type ApiRequestConfig } from '../client';
import { mapPagedList } from '../mappers';

export type MemoryKind = 'conversation' | 'semantic' | 'learned_hint';

export interface CreateMemoryPayload {
    name: string;
    refName: string;
    description?: string;
    kind: 'semantic' | 'learned_hint';
    cardinality?: 'profile' | 'collection';
    scope?: 'user' | 'user_agent' | 'shared';
    retrieval?: 'inject' | 'vector' | 'hybrid';
    topK?: number;
    isShareable?: boolean;
    isDev?: boolean;
    specification?: Record<string, unknown>;
    adminIds?: string[];
    generatePolicy?: boolean;
    extractorModelId?: string;
    piiVerifierModelId?: string;
    embedModelId?: string;
}

export type UpdateMemoryPayload = Partial<CreateMemoryPayload> & {
    agentIds?: string[];
};

export const adminMemoriesApi = {
    async list(
        params: {
            page?: number;
            size?: number;
            search?: string;
            sortBy?: string;
            kind?: MemoryKind | ReadonlyArray<MemoryKind>;
            isShareable?: boolean;
        } = {},
        config?: ApiRequestConfig,
    ): Promise<PagedList<MemoryType>> {
        const raw = await apiClient.get<RawPagedList<MemoryType>>('/memories', {
            params,
            paramsSerializer: (p) => qs.stringify(p, { arrayFormat: 'repeat' }),
            ...config,
        });

        return mapPagedList(raw);
    },

    async getById(id: string, config?: ApiRequestConfig): Promise<MemoryType> {
        return apiClient.get<MemoryType>(`/memories/${id}`, config);
    },

    async create(data: CreateMemoryPayload, config?: ApiRequestConfig): Promise<MemoryType> {
        return apiClient.post<MemoryType>('/memories', data, config);
    },

    async update(id: string, data: UpdateMemoryPayload, config?: ApiRequestConfig): Promise<MemoryType> {
        return apiClient.put<MemoryType>(`/memories/${id}`, data, config);
    },

    async delete(id: string, config?: ApiRequestConfig): Promise<unknown> {
        return apiClient.delete<unknown>(`/memories/${id}`, config);
    },

    async getPreference(id: string, config?: ApiRequestConfig): Promise<{ disabled: boolean }> {
        return apiClient.get<{ disabled: boolean }>(`/memories/${id}/preference`, config);
    },

    async setPreference(
        id: string,
        data: { disabled: boolean },
        config?: ApiRequestConfig,
    ): Promise<{ memoryId: string; userId: string; disabled: boolean }> {
        return apiClient.put<{ memoryId: string; userId: string; disabled: boolean }>(
            `/memories/${id}/preference`,
            data,
            config,
        );
    },
};

export const MEMORIES_QUERY_KEY = ['admin', 'memories'] as const;
export const MEMORIES_LIST_QUERY_KEY = [...MEMORIES_QUERY_KEY, 'list'] as const;

export interface MemoriesQueryParams {
    pageIndex: number;
    pageSize: number;
    search: string;
    sort: SortingState;
    kind?: MemoryKind;
}

export function useMemoriesQuery(params: MemoriesQueryParams) {
    return useQuery({
        queryKey: [...MEMORIES_LIST_QUERY_KEY, params],
        queryFn: () => {
            const sortByField = params.sort.map((s) => `${s.id}:${s.desc ? 'desc' : 'asc'}`)[0];

            return adminMemoriesApi.list({
                page: params.pageIndex,
                size: params.pageSize,
                search: params.search,
                sortBy: sortByField,
                kind: params.kind,
            });
        },
        placeholderData: keepPreviousData,
    });
}

export function useMemoryByIdQuery(id: string | undefined) {
    return useQuery({
        queryKey: [...MEMORIES_QUERY_KEY, 'detail', id],
        queryFn: () => adminMemoriesApi.getById(id!),
        enabled: !!id,
    });
}

export function useCreateMemoryMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateMemoryPayload) => adminMemoriesApi.create(data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: MEMORIES_QUERY_KEY }),
    });
}

export function useUpdateMemoryMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: UpdateMemoryPayload }) => adminMemoriesApi.update(id, data),
        onSuccess: (updatedMemory, variables) => {
            // PUT responses omit hydrated relations (`agents`, `preference`) — merge over the
            // cached entry instead of replacing it, then refetch the detail for fresh relations.
            const merge = (prev: MemoryType | undefined): MemoryType => ({
                ...prev,
                ...updatedMemory,
                agents: updatedMemory.agents ?? prev?.agents,
                preference: updatedMemory.preference ?? prev?.preference,
            });

            queryClient.setQueriesData<PagedList<MemoryType>>({ queryKey: MEMORIES_LIST_QUERY_KEY }, (prev) => {
                if (!prev) return prev;

                return {
                    ...prev,
                    values: prev.values.map((t: MemoryType) => (t._id === updatedMemory._id ? merge(t) : t)),
                };
            });
            queryClient.setQueryData<MemoryType>([...MEMORIES_QUERY_KEY, 'detail', variables.id], merge);
            if (updatedMemory._id !== variables.id) {
                queryClient.setQueryData<MemoryType>([...MEMORIES_QUERY_KEY, 'detail', updatedMemory._id], merge);
            }
            void queryClient.invalidateQueries({ queryKey: [...MEMORIES_QUERY_KEY, 'detail', updatedMemory._id] });
        },
    });
}

export function useDeleteMemoryMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => adminMemoriesApi.delete(id),
        onSuccess: (_data, deletedId) => {
            queryClient.removeQueries({ queryKey: [...MEMORIES_QUERY_KEY, 'detail', deletedId] });
            void queryClient.invalidateQueries({ queryKey: MEMORIES_LIST_QUERY_KEY });
        },
    });
}
