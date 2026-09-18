import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import qs from 'qs';

import type { PagedList, RawPagedList } from '@/types/api-types';

import { apiClient } from '../client';
import { mapPagedList } from '../mappers';

export interface AboutListParams {
    page?: number;
    size?: number;
    search?: string;
    sortBy?: string[];
}

export interface AboutUpsertPayload {
    key: string;
    value: unknown;
    isPublic: boolean;
}

export interface UploadAssetResult {
    url: string;
    [key: string]: unknown;
}

const ABOUTS_PAGE_SIZE = 200;

export const adminAboutApi = {
    async list<T = unknown>(params: AboutListParams = {}): Promise<PagedList<T>> {
        const response = await apiClient.get<RawPagedList<T>>('/abouts', {
            params,
            paramsSerializer: (requestParams) => qs.stringify(requestParams, { arrayFormat: 'repeat' }),
        });

        return mapPagedList(response);
    },

    create<T = unknown>(data: AboutUpsertPayload) {
        return apiClient.post<T, AboutUpsertPayload>('/abouts', data);
    },

    update<T = unknown>(id: string, data: AboutUpsertPayload) {
        return apiClient.put<T, AboutUpsertPayload>(`/abouts/${id}`, data);
    },

    delete(id: string) {
        return apiClient.delete<unknown>(`/abouts/${id}`);
    },

    uploadAsset(data: FormData) {
        return apiClient.post<UploadAssetResult, FormData>('/assets', data, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },

    /** Rows can carry keys the frontend does not know, so the count is never a frontend constant. */
    async listAll<T = unknown>(): Promise<T[]> {
        const values: T[] = [];
        let page = 0;

        for (;;) {
            const response = await adminAboutApi.list<T>({ page, size: ABOUTS_PAGE_SIZE });
            const { totalCount, totalPages } = response.pageInfo;

            values.push(...response.values);
            page += 1;

            if (!response.values.length || values.length >= totalCount || page >= totalPages) {
                return values;
            }
        }
    },

    async getByKey<T extends { key?: string } = { key?: string }>(key: string): Promise<T | undefined> {
        const values = await adminAboutApi.listAll<T>();

        return values.find((item) => item.key === key);
    },

    upsertByKey(id: string | undefined, data: AboutUpsertPayload): Promise<unknown> {
        if (id) return adminAboutApi.update(id, data);

        return adminAboutApi.create(data);
    },
};

export const ABOUTS_QUERY_KEY = ['admin', 'abouts'] as const;
export const ABOUTS_ALL_KEYS_QUERY_KEY = [...ABOUTS_QUERY_KEY, 'all-keys'] as const;

export function useAllAboutsListQuery<T = unknown>() {
    return useQuery({
        queryKey: ABOUTS_ALL_KEYS_QUERY_KEY,
        queryFn: () => adminAboutApi.listAll<T>(),
    });
}

export function useCreateAboutMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: AboutUpsertPayload) => adminAboutApi.create(data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ABOUTS_QUERY_KEY }),
    });
}

export function useUpdateAboutMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: AboutUpsertPayload }) => adminAboutApi.update(id, data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ABOUTS_QUERY_KEY }),
    });
}

export function useDeleteAboutMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => adminAboutApi.delete(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ABOUTS_QUERY_KEY }),
    });
}

export function useAboutByKeyQuery<T extends { key?: string } = { key?: string }>(key: string) {
    return useQuery({
        queryKey: [...ABOUTS_QUERY_KEY, 'by-key', key],
        queryFn: () => adminAboutApi.getByKey<T>(key),
    });
}

export function useUpsertAboutByKeyMutation(options: { invalidate?: boolean } = {}) {
    const queryClient = useQueryClient();
    const { invalidate = true } = options;

    return useMutation({
        mutationFn: ({ id, data }: { id?: string; key: string; data: AboutUpsertPayload }) =>
            adminAboutApi.upsertByKey(id, data),
        onSuccess: invalidate ? () => queryClient.invalidateQueries({ queryKey: ABOUTS_QUERY_KEY }) : undefined,
    });
}
