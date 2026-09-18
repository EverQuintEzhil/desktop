import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SortingState } from '@tanstack/react-table';
import qs from 'qs';

import type { PagedList, RawPagedList } from '@/types/api-types';

import { apiClient, type ApiRequestConfig } from '../client';
import { mapPagedList } from '../mappers';

export const adminIdpApi = {
    async list<T = unknown>(
        params: { page?: number; size?: number; search?: string; sortBy?: string[] } = {},
        config?: ApiRequestConfig,
    ): Promise<PagedList<T>> {
        const raw = await apiClient.get<RawPagedList<T>>('/idps', {
            params,
            paramsSerializer: (p) => qs.stringify(p, { arrayFormat: 'repeat' }),
            ...config,
        });

        return mapPagedList(raw);
    },

    async getById<T = unknown>(id: string): Promise<T> {
        return apiClient.get<T>(`/idps/${id}`);
    },

    async create<T = unknown>(data: object): Promise<T> {
        return apiClient.post<T>('/idps', data);
    },

    async update<T = unknown>(id: string, data: object): Promise<T> {
        return apiClient.put<T>(`/idps/${id}`, data);
    },

    async delete(id: string): Promise<unknown> {
        return apiClient.delete<unknown>(`/idps/${id}`);
    },

    async updateRequestConfig<T = unknown>(idpId: string, data: object): Promise<T> {
        return apiClient.put<T>(`/idps/${idpId}/requestConfig`, data);
    },

    async updateValidationConfig<T = unknown>(idpId: string, name: string, data: object): Promise<T> {
        return apiClient.put<T>(`/idps/${idpId}/validationConfigs/${name}`, data);
    },

    async createValidationConfig<T = unknown>(idpId: string, data: object): Promise<T> {
        return apiClient.post<T>(`/idps/${idpId}/validationConfigs`, data);
    },

    async updateSecret<T = unknown>(idpId: string, secret: string, data: object): Promise<T> {
        return apiClient.put<T>(`/idps/${idpId}/secrets/${secret}`, data);
    },

    async createSecret<T = unknown>(idpId: string, data: object): Promise<T> {
        return apiClient.post<T>(`/idps/${idpId}/secrets`, data);
    },

    async deleteNested<T = unknown>(path: string): Promise<T> {
        return apiClient.delete<T>(path);
    },
};

export const IDPS_QUERY_KEY = ['admin', 'idps'] as const;
export const IDPS_LIST_QUERY_KEY = [...IDPS_QUERY_KEY, 'list'] as const;

export interface IdpsQueryParams {
    pageIndex: number;
    pageSize: number;
    search: string;
    sort: SortingState;
}

export function useIdpsQuery<T = unknown>(params: IdpsQueryParams) {
    return useQuery({
        queryKey: [...IDPS_LIST_QUERY_KEY, params],
        queryFn: () =>
            adminIdpApi.list<T>({
                page: params.pageIndex,
                size: params.pageSize,
                search: params.search,
                sortBy: params.sort.map((s) => `${s.id}:${s.desc ? 'desc' : 'asc'}`),
            }),
        placeholderData: keepPreviousData,
    });
}

export function useIdpByIdQuery<T = unknown>(id: string | undefined) {
    return useQuery({
        queryKey: [...IDPS_QUERY_KEY, 'detail', id],
        queryFn: () => adminIdpApi.getById<T>(id!),
        enabled: !!id,
    });
}

export function useCreateIdpMutation<T = unknown>() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: object) => adminIdpApi.create<T>(data),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: IDPS_LIST_QUERY_KEY });
        },
    });
}

export function useUpdateIdpMutation<T = unknown>() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: object }) => adminIdpApi.update<T>(id, data),
        onSuccess: (_, variables) => {
            void queryClient.invalidateQueries({ queryKey: IDPS_LIST_QUERY_KEY });
            void queryClient.invalidateQueries({ queryKey: [...IDPS_QUERY_KEY, 'detail', variables.id] });
        },
    });
}

export function useDeleteIdpMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => adminIdpApi.delete(id),
        onSuccess: (_, deletedId) => {
            queryClient.removeQueries({ queryKey: [...IDPS_QUERY_KEY, 'detail', deletedId] });
            void queryClient.invalidateQueries({ queryKey: IDPS_LIST_QUERY_KEY });
        },
    });
}

export function useUpdateIdpRequestConfigMutation<T = unknown>() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ idpId, data }: { idpId: string; data: object }) =>
            adminIdpApi.updateRequestConfig<T>(idpId, data),
        onSuccess: (_, variables) => {
            void queryClient.invalidateQueries({ queryKey: IDPS_LIST_QUERY_KEY });
            void queryClient.invalidateQueries({ queryKey: [...IDPS_QUERY_KEY, 'detail', variables.idpId] });
        },
    });
}

export function useUpdateIdpValidationConfigMutation<T = unknown>() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ idpId, name, data }: { idpId: string; name: string; data: object }) =>
            adminIdpApi.updateValidationConfig<T>(idpId, name, data),
        onSuccess: (_, variables) => {
            void queryClient.invalidateQueries({ queryKey: IDPS_LIST_QUERY_KEY });
            void queryClient.invalidateQueries({ queryKey: [...IDPS_QUERY_KEY, 'detail', variables.idpId] });
        },
    });
}

export function useCreateIdpValidationConfigMutation<T = unknown>() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ idpId, data }: { idpId: string; data: object }) =>
            adminIdpApi.createValidationConfig<T>(idpId, data),
        onSuccess: (_, variables) => {
            void queryClient.invalidateQueries({ queryKey: IDPS_LIST_QUERY_KEY });
            void queryClient.invalidateQueries({ queryKey: [...IDPS_QUERY_KEY, 'detail', variables.idpId] });
        },
    });
}

export function useUpdateIdpSecretMutation<T = unknown>() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ idpId, secret, data }: { idpId: string; secret: string; data: object }) =>
            adminIdpApi.updateSecret<T>(idpId, secret, data),
        onSuccess: (_, variables) => {
            void queryClient.invalidateQueries({ queryKey: IDPS_LIST_QUERY_KEY });
            void queryClient.invalidateQueries({ queryKey: [...IDPS_QUERY_KEY, 'detail', variables.idpId] });
        },
    });
}

export function useCreateIdpSecretMutation<T = unknown>() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ idpId, data }: { idpId: string; data: object }) => adminIdpApi.createSecret<T>(idpId, data),
        onSuccess: (_, variables) => {
            void queryClient.invalidateQueries({ queryKey: IDPS_LIST_QUERY_KEY });
            void queryClient.invalidateQueries({ queryKey: [...IDPS_QUERY_KEY, 'detail', variables.idpId] });
        },
    });
}

export function useDeleteIdpNestedMutation<T = unknown>() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (path: string) => adminIdpApi.deleteNested<T>(path),
        onSuccess: (_, path) => {
            const match = /^\/idps\/([^/]+)/.exec(path);
            const idpId = match?.[1];

            void queryClient.invalidateQueries({ queryKey: IDPS_LIST_QUERY_KEY });
            if (idpId) {
                void queryClient.invalidateQueries({ queryKey: [...IDPS_QUERY_KEY, 'detail', idpId] });
            }
        },
    });
}
