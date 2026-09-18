import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SortingState } from '@tanstack/react-table';
import qs from 'qs';

import type { ModelType } from '@/types/admin';
import type { PagedList, RawPagedList } from '@/types/api-types';

import { apiClient, type ApiRequestConfig } from '../client';
import { mapPagedList } from '../mappers';

export const adminModelsApi = {
    async list(
        params: {
            page?: number;
            size?: number;
            search?: string;
            sortBy?: string[];
            ids?: string[];
            capability?: string[];
        } = {},
        config?: ApiRequestConfig,
    ): Promise<PagedList<ModelType>> {
        const raw = await apiClient.get<RawPagedList<ModelType>>('/models', {
            params,
            paramsSerializer: (p) => qs.stringify(p, { arrayFormat: 'repeat' }),
            ...config,
        });

        return mapPagedList(raw);
    },

    async getById(id: string, config?: ApiRequestConfig): Promise<ModelType> {
        return apiClient.get<ModelType>(`/models/${id}`, config);
    },

    async create(data: object, config?: ApiRequestConfig): Promise<ModelType> {
        return apiClient.post<ModelType>('/models', data, config);
    },

    async update(id: string, data: object, config?: ApiRequestConfig): Promise<ModelType> {
        return apiClient.put<ModelType>(`/models/${id}`, data, config);
    },

    async delete(id: string, config?: ApiRequestConfig): Promise<unknown> {
        return apiClient.delete<unknown>(`/models/${id}`, config);
    },
};

export const MODELS_QUERY_KEY = ['admin', 'models'] as const;
export const MODELS_LIST_QUERY_KEY = [...MODELS_QUERY_KEY, 'list'] as const;

export interface ModelsQueryParams {
    pageIndex: number;
    pageSize: number;
    search: string;
    sort: SortingState;
    ids?: string[];
    capability?: string[];
}

export function useModelsQuery(params: ModelsQueryParams) {
    return useQuery({
        queryKey: [...MODELS_LIST_QUERY_KEY, params],
        queryFn: () =>
            adminModelsApi.list({
                page: params.pageIndex,
                size: params.pageSize,
                search: params.search,
                sortBy: params.sort.map((s) => `${s.id}:${s.desc ? 'desc' : 'asc'}`),
                ...(params.ids?.length ? { ids: params.ids } : {}),
                ...(params.capability?.length ? { capability: params.capability } : {}),
            }),
        placeholderData: keepPreviousData,
    });
}

export function useModelByIdQuery(id: string | undefined) {
    return useQuery({
        queryKey: [...MODELS_QUERY_KEY, 'detail', id],
        queryFn: () => adminModelsApi.getById(id!),
        enabled: !!id,
    });
}

export function useCreateModelMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: object) => adminModelsApi.create(data),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: MODELS_LIST_QUERY_KEY });
        },
    });
}

export function useUpdateModelMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: object }) => adminModelsApi.update(id, data),
        onSuccess: (updatedModel, variables) => {
            queryClient.setQueriesData<PagedList<ModelType>>({ queryKey: MODELS_LIST_QUERY_KEY }, (prev) => {
                if (!prev) return prev;

                return {
                    ...prev,
                    values: prev.values.map((m: ModelType) => (m._id === updatedModel._id ? updatedModel : m)),
                };
            });
            queryClient.setQueryData([...MODELS_QUERY_KEY, 'detail', variables.id], updatedModel);
            if (updatedModel._id !== variables.id) {
                queryClient.setQueryData([...MODELS_QUERY_KEY, 'detail', updatedModel._id], updatedModel);
            }
        },
    });
}

export function useDeleteModelMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => adminModelsApi.delete(id),
        onSuccess: (_data, deletedId) => {
            queryClient.removeQueries({ queryKey: [...MODELS_QUERY_KEY, 'detail', deletedId] });
            void queryClient.invalidateQueries({ queryKey: MODELS_LIST_QUERY_KEY });
        },
    });
}
