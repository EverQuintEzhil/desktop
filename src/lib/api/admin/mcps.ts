import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SortingState } from '@tanstack/react-table';
import qs from 'qs';

import type { McpType } from '@/types/admin';
import type { PagedList, RawPagedList } from '@/types/api-types';

import { apiClient, type ApiRequestConfig } from '../client';
import { mapPagedList } from '../mappers';

export const adminMcpsApi = {
    async list(
        params: {
            page?: number;
            size?: number;
            search?: string;
            sortBy?: string[];
            authType?: string[];
        } = {},
        config?: ApiRequestConfig,
    ): Promise<PagedList<McpType>> {
        const raw = await apiClient.get<RawPagedList<McpType>>('/mcpservers', {
            params,
            paramsSerializer: (p) => qs.stringify(p, { arrayFormat: 'repeat' }),
            ...config,
        });

        return mapPagedList(raw);
    },

    async getById(id: string, config?: ApiRequestConfig): Promise<McpType> {
        return apiClient.get<McpType>(`/mcpservers/${id}`, config);
    },

    async create(data: object, config?: ApiRequestConfig): Promise<McpType> {
        return apiClient.post<McpType>('/mcpservers', data, config);
    },

    async update(id: string, data: object, config?: ApiRequestConfig): Promise<McpType> {
        return apiClient.put<McpType>(`/mcpservers/${id}`, data, config);
    },

    async delete(id: string, config?: ApiRequestConfig): Promise<unknown> {
        return apiClient.delete<unknown>(`/mcpservers/${id}`, config);
    },
};

export const MCPS_QUERY_KEY = ['admin', 'mcps'] as const;
export const MCPS_LIST_QUERY_KEY = [...MCPS_QUERY_KEY, 'list'] as const;

export interface McpsQueryParams {
    pageIndex: number;
    pageSize: number;
    search: string;
    sort: SortingState;
    authTypes?: string[];
}

export function useMcpsQuery(params: McpsQueryParams) {
    return useQuery({
        queryKey: [...MCPS_LIST_QUERY_KEY, params],
        queryFn: () =>
            adminMcpsApi.list({
                page: params.pageIndex,
                size: params.pageSize,
                search: params.search,
                sortBy: params.sort.map((s) => `${s.id}:${s.desc ? 'desc' : 'asc'}`),
                authType: params.authTypes,
            }),
        placeholderData: keepPreviousData,
    });
}

export function useMcpByIdQuery(id: string | undefined) {
    return useQuery({
        queryKey: [...MCPS_QUERY_KEY, 'detail', id],
        queryFn: () => adminMcpsApi.getById(id!),
        enabled: !!id,
    });
}

export function useCreateMcpMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: object) => adminMcpsApi.create(data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: MCPS_QUERY_KEY }),
    });
}

export function useUpdateMcpMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: object }) => adminMcpsApi.update(id, data),
        onSuccess: (updatedMcp, variables) => {
            queryClient.setQueriesData<PagedList<McpType>>({ queryKey: MCPS_LIST_QUERY_KEY }, (prev) => {
                if (!prev) return prev;

                return {
                    ...prev,
                    values: prev.values.map((m: McpType) => (m._id === updatedMcp._id ? updatedMcp : m)),
                };
            });
            queryClient.setQueryData([...MCPS_QUERY_KEY, 'detail', variables.id], updatedMcp);
            if (updatedMcp._id !== variables.id) {
                queryClient.setQueryData([...MCPS_QUERY_KEY, 'detail', updatedMcp._id], updatedMcp);
            }
        },
    });
}

export function useDeleteMcpMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => adminMcpsApi.delete(id),
        onSuccess: (_data, deletedId) => {
            queryClient.removeQueries({ queryKey: [...MCPS_QUERY_KEY, 'detail', deletedId] });
            void queryClient.invalidateQueries({ queryKey: MCPS_LIST_QUERY_KEY });
        },
    });
}
