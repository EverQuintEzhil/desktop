import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SortingState } from '@tanstack/react-table';
import qs from 'qs';

import type { ToolType } from '@/types/admin';
import type { PagedList, RawPagedList } from '@/types/api-types';

import { apiClient, type ApiRequestConfig } from '../client';
import { mapPagedList } from '../mappers';

export const adminToolsApi = {
    async list(
        params: {
            page?: number;
            size?: number;
            search?: string;
            sortBy?: string[];
            datastoreIds?: string[];
        } = {},
        config?: ApiRequestConfig,
    ): Promise<PagedList<ToolType>> {
        const raw = await apiClient.get<RawPagedList<ToolType>>('/tools', {
            params,
            paramsSerializer: (p) => qs.stringify(p, { arrayFormat: 'repeat' }),
            ...config,
        });

        return mapPagedList(raw);
    },

    async getById(id: string, config?: ApiRequestConfig): Promise<ToolType> {
        return apiClient.get<ToolType>(`/tools/${id}`, config);
    },

    async create(data: object, config?: ApiRequestConfig): Promise<ToolType> {
        return apiClient.post<ToolType>('/tools', data, config);
    },

    async update(id: string, data: object, config?: ApiRequestConfig): Promise<ToolType> {
        return apiClient.put<ToolType>(`/tools/${id}`, data, config);
    },

    async delete(id: string, config?: ApiRequestConfig): Promise<unknown> {
        return apiClient.delete<unknown>(`/tools/${id}`, config);
    },
};

export const TOOLS_QUERY_KEY = ['admin', 'tools'] as const;
export const TOOLS_LIST_QUERY_KEY = [...TOOLS_QUERY_KEY, 'list'] as const;

export interface ToolsQueryParams {
    pageIndex: number;
    pageSize: number;
    search: string;
    sort: SortingState;
    datastoreIds: string[];
}

export function useToolsQuery(params: ToolsQueryParams) {
    return useQuery({
        queryKey: [...TOOLS_LIST_QUERY_KEY, params],
        queryFn: () =>
            adminToolsApi.list({
                page: params.pageIndex,
                size: params.pageSize,
                search: params.search,
                sortBy: params.sort.map((s) => `${s.id}:${s.desc ? 'desc' : 'asc'}`),
                datastoreIds: params.datastoreIds,
            }),
        placeholderData: keepPreviousData,
    });
}

export function useToolByIdQuery(id: string | undefined) {
    return useQuery({
        queryKey: [...TOOLS_QUERY_KEY, 'detail', id],
        queryFn: () => adminToolsApi.getById(id!),
        enabled: !!id,
    });
}

export function useCreateToolMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: object) => adminToolsApi.create(data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: TOOLS_QUERY_KEY }),
    });
}

export function useUpdateToolMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: object }) => adminToolsApi.update(id, data),
        onSuccess: (updatedTool, variables) => {
            queryClient.setQueriesData<PagedList<ToolType>>({ queryKey: TOOLS_LIST_QUERY_KEY }, (prev) => {
                if (!prev) return prev;

                return {
                    ...prev,
                    values: prev.values.map((t: ToolType) => (t._id === updatedTool._id ? updatedTool : t)),
                };
            });
            queryClient.setQueryData([...TOOLS_QUERY_KEY, 'detail', variables.id], updatedTool);
            if (updatedTool._id !== variables.id) {
                queryClient.setQueryData([...TOOLS_QUERY_KEY, 'detail', updatedTool._id], updatedTool);
            }
        },
    });
}

export function useDeleteToolMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => adminToolsApi.delete(id),
        onSuccess: (_data, deletedId) => {
            queryClient.removeQueries({ queryKey: [...TOOLS_QUERY_KEY, 'detail', deletedId] });
            void queryClient.invalidateQueries({ queryKey: TOOLS_LIST_QUERY_KEY });
        },
    });
}
