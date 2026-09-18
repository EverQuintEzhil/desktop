import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SortingState } from '@tanstack/react-table';
import qs from 'qs';

import type { LauncherType } from '@/types/admin';
import type { PagedList, RawPagedList } from '@/types/api-types';

import { apiClient, type ApiRequestConfig } from '../client';
import { mapPagedList } from '../mappers';

export const adminLaunchersApi = {
    async list(
        params: {
            page?: number;
            size?: number;
            search?: string;
            sortBy?: string[];
            includeDrafts?: boolean;
            tags?: string[];
        } = {},
        config?: ApiRequestConfig,
    ): Promise<PagedList<LauncherType>> {
        const raw = await apiClient.get<RawPagedList<LauncherType>>('/launchers', {
            params,
            paramsSerializer: (p) => qs.stringify(p, { arrayFormat: 'repeat' }),
            ...config,
        });

        return mapPagedList(raw);
    },

    async getById(id: string, config?: ApiRequestConfig): Promise<LauncherType> {
        return apiClient.get<LauncherType>(`/launchers/${id}`, config);
    },

    /** Answers `null` when the route's post-transaction read misses, so the row is created but not projected. */
    async create(data: object, config?: ApiRequestConfig): Promise<LauncherType | null> {
        return apiClient.post<LauncherType | null>('/launchers', data, config);
    },

    async update(id: string, data: object, config?: ApiRequestConfig): Promise<LauncherType> {
        return apiClient.put<LauncherType>(`/launchers/${id}`, data, config);
    },

    async delete(id: string, config?: ApiRequestConfig): Promise<unknown> {
        return apiClient.delete<unknown>(`/launchers/${id}`, config);
    },
};

export const LAUNCHERS_QUERY_KEY = ['admin', 'launchers'] as const;
export const LAUNCHERS_LIST_QUERY_KEY = [...LAUNCHERS_QUERY_KEY, 'list'] as const;

export interface LaunchersQueryParams {
    pageIndex: number;
    pageSize: number;
    search: string;
    sort: SortingState;
    includeDrafts: boolean;
    tags: string[];
}

export function useLaunchersQuery(params: LaunchersQueryParams) {
    return useQuery({
        queryKey: [...LAUNCHERS_LIST_QUERY_KEY, params],
        queryFn: () =>
            adminLaunchersApi.list({
                page: params.pageIndex,
                size: params.pageSize,
                search: params.search,
                sortBy: params.sort.map((s) => `${s.id}:${s.desc ? 'desc' : 'asc'}`),
                includeDrafts: params.includeDrafts,
                tags: params.tags,
            }),
        placeholderData: keepPreviousData,
    });
}

export function useLauncherByIdQuery(id: string | undefined) {
    return useQuery({
        queryKey: [...LAUNCHERS_QUERY_KEY, 'detail', id],
        queryFn: () => adminLaunchersApi.getById(id!),
        enabled: !!id,
    });
}

export function useCreateLauncherMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: object) => adminLaunchersApi.create(data),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: LAUNCHERS_LIST_QUERY_KEY });
        },
    });
}

export function useUpdateLauncherMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: object }) => adminLaunchersApi.update(id, data),
        onSuccess: (_, variables) => {
            void queryClient.invalidateQueries({ queryKey: LAUNCHERS_LIST_QUERY_KEY });
            void queryClient.invalidateQueries({ queryKey: [...LAUNCHERS_QUERY_KEY, 'detail', variables.id] });
        },
    });
}

export function useDeleteLauncherMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => adminLaunchersApi.delete(id),
        onSuccess: (_data, deletedId) => {
            queryClient.removeQueries({ queryKey: [...LAUNCHERS_QUERY_KEY, 'detail', deletedId] });
            void queryClient.invalidateQueries({ queryKey: LAUNCHERS_LIST_QUERY_KEY });
        },
    });
}
