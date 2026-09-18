import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SortingState } from '@tanstack/react-table';
import qs from 'qs';

import type { AppType, AppVersionType } from '@/types/admin';
import type { PagedList, RawPagedList } from '@/types/api-types';

import { apiClient, type ApiRequestConfig } from '../client';
import { mapPagedList } from '../mappers';

export const adminAppsApi = {
    async list(
        params: { page?: number; size?: number; search?: string; sortBy?: string[] } = {},
        config?: ApiRequestConfig,
    ): Promise<PagedList<AppType>> {
        const raw = await apiClient.get<RawPagedList<AppType>>('/apps', {
            params,
            paramsSerializer: (p) => qs.stringify(p, { arrayFormat: 'repeat' }),
            ...config,
        });

        return mapPagedList(raw);
    },

    async getById(id: string): Promise<AppType> {
        return apiClient.get<AppType>(`/apps/${id}`);
    },

    async create(data: object): Promise<AppType> {
        return apiClient.post<AppType>('/apps', data);
    },

    async update(id: string, data: object): Promise<AppType> {
        return apiClient.put<AppType>(`/apps/${id}`, data);
    },

    async updateFile(id: string, data: object): Promise<AppType> {
        return apiClient.put<AppType>(`/apps/${id}/files`, data);
    },

    async getVersions(
        id: string,
        params: { page?: number; size?: number; search?: string; sortBy?: string[] } = {},
        config?: ApiRequestConfig,
    ): Promise<PagedList<AppVersionType>> {
        const raw = await apiClient.get<RawPagedList<AppVersionType>>(`/apps/${id}/versions`, {
            params,
            paramsSerializer: (p) => qs.stringify(p, { arrayFormat: 'repeat' }),
            ...config,
        });

        return mapPagedList(raw);
    },

    async delete(id: string): Promise<unknown> {
        return apiClient.delete<unknown>(`/apps/${id}`);
    },
};

export const APPS_QUERY_KEY = ['admin', 'apps'] as const;
export const APPS_LIST_QUERY_KEY = [...APPS_QUERY_KEY, 'list'] as const;

export interface AppsQueryParams {
    pageIndex: number;
    pageSize: number;
    search: string;
    sort: SortingState;
}

export function useAppsQuery(params: AppsQueryParams) {
    return useQuery({
        queryKey: [...APPS_LIST_QUERY_KEY, params],
        queryFn: () =>
            adminAppsApi.list({
                page: params.pageIndex,
                size: params.pageSize,
                search: params.search,
                sortBy: params.sort.map((s) => `${s.id}:${s.desc ? 'desc' : 'asc'}`),
            }),
        placeholderData: keepPreviousData,
    });
}

export function useCreateAppMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: object) => adminAppsApi.create(data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: APPS_QUERY_KEY }),
    });
}

export function useUpdateAppMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: object }) => adminAppsApi.update(id, data),
        onSuccess: (updatedApp) => {
            queryClient.setQueriesData<PagedList<AppType>>({ queryKey: APPS_LIST_QUERY_KEY }, (prev) => {
                if (!prev) return prev;

                return {
                    ...prev,
                    values: prev.values.map((a: AppType) => (a._id === updatedApp._id ? updatedApp : a)),
                };
            });
            queryClient.invalidateQueries({ queryKey: [...APPS_QUERY_KEY, 'detail', updatedApp._id] });
        },
    });
}

export function useUpdateAppFileMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: object }) => adminAppsApi.updateFile(id, data),
        onSuccess: (updatedApp) => {
            queryClient.setQueriesData<PagedList<AppType>>({ queryKey: APPS_LIST_QUERY_KEY }, (prev) => {
                if (!prev) return prev;

                return {
                    ...prev,
                    values: prev.values.map((a: AppType) => (a._id === updatedApp._id ? updatedApp : a)),
                };
            });
            queryClient.invalidateQueries({ queryKey: [...APPS_QUERY_KEY, 'detail', updatedApp._id] });
            queryClient.invalidateQueries({ queryKey: [...APPS_QUERY_KEY, 'versions', updatedApp._id] });
        },
    });
}

export function useAppVersionsQuery(id: string, params: AppsQueryParams) {
    return useQuery({
        queryKey: [...APPS_QUERY_KEY, 'versions', id, params],
        queryFn: () =>
            adminAppsApi.getVersions(id, {
                page: params.pageIndex,
                size: params.pageSize,
                search: params.search,
                sortBy: params.sort.map((s) => `${s.id}:${s.desc ? 'desc' : 'asc'}`),
            }),
        placeholderData: keepPreviousData,
        enabled: !!id,
    });
}

export function useAppByIdQuery(id: string) {
    return useQuery({
        queryKey: [...APPS_QUERY_KEY, 'detail', id],
        queryFn: () => adminAppsApi.getById(id),
        enabled: !!id,
    });
}

export function useDeleteAppMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => adminAppsApi.delete(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: APPS_QUERY_KEY }),
    });
}
