import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SortingState } from '@tanstack/react-table';
import qs from 'qs';

import type { AssetType } from '@/types/admin';
import type { PagedList, RawPagedList } from '@/types/api-types';

import { apiClient, type ApiRequestConfig } from '../client';
import { mapPagedList } from '../mappers';

export const adminAssetsApi = {
    async list(
        params: { page?: number; size?: number; search?: string; sortBy?: string[] } = {},
        config?: ApiRequestConfig,
    ): Promise<PagedList<AssetType>> {
        const raw = await apiClient.get<RawPagedList<AssetType>>('/assets', {
            params,
            paramsSerializer: (p) => qs.stringify(p, { arrayFormat: 'repeat' }),
            ...config,
        });

        return mapPagedList(raw);
    },

    async upload(formData: FormData): Promise<AssetType> {
        return apiClient.post<AssetType>('/assets', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },

    async delete(key: string): Promise<unknown> {
        return apiClient.delete<unknown>(`/assets/${key}`);
    },
};

export const ASSETS_QUERY_KEY = ['admin', 'assets'] as const;
export const ASSETS_LIST_QUERY_KEY = [...ASSETS_QUERY_KEY, 'list'] as const;

export interface AssetsQueryParams {
    pageIndex: number;
    pageSize: number;
    search: string;
    sort: SortingState;
}

export function useAssetsQuery(params: AssetsQueryParams) {
    return useQuery({
        queryKey: [...ASSETS_LIST_QUERY_KEY, params],
        queryFn: () =>
            adminAssetsApi.list({
                page: params.pageIndex,
                size: params.pageSize,
                search: params.search,
                sortBy: params.sort.map((s) => `${s.id}:${s.desc ? 'desc' : 'asc'}`),
            }),
        placeholderData: keepPreviousData,
    });
}

export function useUploadAssetMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (formData: FormData) => adminAssetsApi.upload(formData),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ASSETS_QUERY_KEY }),
    });
}

export function useDeleteAssetMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (key: string) => adminAssetsApi.delete(key),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ASSETS_QUERY_KEY }),
    });
}
