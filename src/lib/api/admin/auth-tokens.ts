import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SortingState } from '@tanstack/react-table';
import qs from 'qs';

import type { UserType } from '@/types/admin';
import type { PagedList, RawPagedList } from '@/types/api-types';

import { apiClient, type ApiRequestConfig } from '../client';
import { mapPagedList } from '../mappers';

export type AuthTokenType = {
    readonly _id: string;
    name: string;
    keyId: string;
    privateKey: string;
    creatorId: UserType;
    updatedById: UserType;
    createdAt: string;
    updatedAt: string;
};

export const adminAuthTokensApi = {
    async list(
        params: { page?: number; size?: number; search?: string; sortBy?: string[] } = {},
        config?: ApiRequestConfig,
    ): Promise<PagedList<AuthTokenType>> {
        const raw = await apiClient.get<RawPagedList<AuthTokenType>>('/authTokens', {
            params,
            paramsSerializer: (p) => qs.stringify(p, { arrayFormat: 'repeat' }),
            ...config,
        });

        return mapPagedList(raw);
    },

    async create(data: object): Promise<AuthTokenType> {
        return apiClient.post<AuthTokenType>('/authtokens', data);
    },

    async update(id: string, data: object): Promise<AuthTokenType> {
        return apiClient.put<AuthTokenType>(`/authtokens/${id}`, data);
    },

    async delete(id: string): Promise<unknown> {
        return apiClient.delete<unknown>(`/authtokens/${id}`);
    },
};

export const AUTH_TOKENS_QUERY_KEY = ['admin', 'auth-tokens'] as const;
export const AUTH_TOKENS_LIST_QUERY_KEY = [...AUTH_TOKENS_QUERY_KEY, 'list'] as const;

export interface AuthTokensQueryParams {
    pageIndex: number;
    pageSize: number;
    search: string;
    sort: SortingState;
}

export function useAuthTokensQuery(params: AuthTokensQueryParams) {
    return useQuery({
        queryKey: [...AUTH_TOKENS_LIST_QUERY_KEY, params],
        queryFn: () =>
            adminAuthTokensApi.list({
                page: params.pageIndex,
                size: params.pageSize,
                search: params.search,
                sortBy: params.sort.map((s) => `${s.id}:${s.desc ? 'desc' : 'asc'}`),
            }),
        placeholderData: keepPreviousData,
    });
}

export function useCreateAuthTokenMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: object) => adminAuthTokensApi.create(data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: AUTH_TOKENS_QUERY_KEY }),
    });
}

export function useUpdateAuthTokenMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: object }) => adminAuthTokensApi.update(id, data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: AUTH_TOKENS_QUERY_KEY }),
    });
}

export function useDeleteAuthTokenMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => adminAuthTokensApi.delete(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: AUTH_TOKENS_QUERY_KEY }),
    });
}
