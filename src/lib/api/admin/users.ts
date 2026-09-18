import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SortingState } from '@tanstack/react-table';
import qs from 'qs';

import type { LoginActivitySessionType, UserType } from '@/types/admin';
import type { PagedList, RawPagedList } from '@/types/api-types';

import { apiClient, type ApiRequestConfig } from '../client';
import { mapPagedList } from '../mappers';

import { INSIGHTS_QUERY_KEY } from './insights';
import {
    bulkUsersResponseSchema,
    userSecurityGroupMembershipSchema,
    type BulkUsersResponse,
    type UserSecurityGroupMembership,
} from './insights-schema';

export interface UserUpdatePayload {
    name?: { first: string; middle?: string; last: string };
    email?: string;
    mobile?: string;
    role?: string;
    defaultLanguage?: string;
    timezone?: string;
    timezoneOffset?: string;
    tags?: string[];
    avatar?: string | File;
    portalAccessEnabled?: boolean;
    customFields?: Record<string, unknown> | null;
}

export interface UsersListParams {
    page?: number;
    size?: number;
    search?: string;
    sortBy?: string[];
}

export const adminUsersApi = {
    async list(params: UsersListParams = {}, config?: ApiRequestConfig): Promise<PagedList<UserType>> {
        const raw = await apiClient.get<RawPagedList<UserType>>('/users', {
            params,
            paramsSerializer: (p) => qs.stringify(p, { arrayFormat: 'repeat' }),
            ...config,
        });

        return mapPagedList(raw);
    },

    async search(query: string, size = 10): Promise<UserType[]> {
        const result = await adminUsersApi.list({ page: 0, size, search: query });

        return result.values;
    },

    async getById(id: string): Promise<UserType> {
        return apiClient.get<UserType>(`/users/${id}`);
    },

    async getSecurityGroups(id: string): Promise<UserSecurityGroupMembership[]> {
        const raw = await apiClient.get<unknown[]>(`/users/${id}/securitygroups`);

        return raw.map((row) => userSecurityGroupMembershipSchema.parse(row));
    },

    async create(data: object): Promise<UserType> {
        return apiClient.post<UserType>('/users', data);
    },

    async update(id: string, data: UserUpdatePayload): Promise<UserType> {
        return apiClient.put<UserType, UserUpdatePayload>(`/users/${id}`, data);
    },

    async delete(id: string): Promise<unknown> {
        return apiClient.delete<unknown>(`/users/${id}`);
    },

    async getLoginActivities(
        userId: string,
        params: { page?: number; size?: number } = {},
    ): Promise<PagedList<LoginActivitySessionType>> {
        const raw = await apiClient.get<RawPagedList<LoginActivitySessionType>>(`/users/${userId}/loginactivities`, {
            params,
            paramsSerializer: (p) => qs.stringify(p, { arrayFormat: 'repeat' }),
        });

        return mapPagedList(raw);
    },
};

export const USERS_QUERY_KEY = ['admin', 'users'] as const;
export const USERS_LIST_QUERY_KEY = [...USERS_QUERY_KEY, 'list'] as const;

function buildSortBy(sort: SortingState): string[] {
    return sort.flatMap((s) =>
        s.id === 'name'
            ? [`name.first:${s.desc ? 'desc' : 'asc'}`, `name.last:${s.desc ? 'desc' : 'asc'}`]
            : [`${s.id}:${s.desc ? 'desc' : 'asc'}`],
    );
}

export interface UsersQueryParams {
    pageIndex: number;
    pageSize: number;
    search: string;
    sort: SortingState;
}

export function useUsersQuery(params: UsersQueryParams) {
    return useQuery({
        queryKey: [...USERS_LIST_QUERY_KEY, params],
        queryFn: () =>
            adminUsersApi.list({
                page: params.pageIndex,
                size: params.pageSize,
                search: params.search,
                sortBy: buildSortBy(params.sort),
            }),
        placeholderData: keepPreviousData,
    });
}

export function useCreateUserMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: adminUsersApi.create,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY }),
    });
}

export function useUpdateUserMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: UserUpdatePayload }) => adminUsersApi.update(id, data),
        onSuccess: (updatedUser) => {
            queryClient.setQueriesData<PagedList<UserType>>({ queryKey: USERS_LIST_QUERY_KEY }, (prev) => {
                if (!prev) return prev;

                return {
                    ...prev,
                    values: prev.values.map((u: UserType) => (u._id === updatedUser._id ? updatedUser : u)),
                };
            });
        },
    });
}

export const USER_DETAIL_QUERY_KEY = [...USERS_QUERY_KEY, 'detail'] as const;

export function useUserByIdQuery(id: string | undefined) {
    return useQuery({
        queryKey: [...USER_DETAIL_QUERY_KEY, id],
        queryFn: () => adminUsersApi.getById(id as string),
        enabled: !!id,
    });
}

/** `GET /users/:id/securitygroups` — the reverse lookup AMP-565 added, `direct` vs inherited. */
export function useUserSecurityGroupsQuery(id: string | undefined) {
    return useQuery({
        queryKey: [...USER_DETAIL_QUERY_KEY, id, 'security-groups'],
        queryFn: () => adminUsersApi.getSecurityGroups(id as string),
        enabled: !!id,
    });
}

export function useUpdateUserCustomFieldsMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, customFields }: { id: string; customFields: Record<string, unknown> }) =>
            adminUsersApi.update(id, { customFields }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY }),
    });
}

export const USER_LOGIN_ACTIVITIES_QUERY_KEY = [...USERS_QUERY_KEY, 'login-activities'] as const;

export function useUserLoginActivitiesQuery(userId: string, pageIndex: number, pageSize: number) {
    return useQuery({
        queryKey: [...USER_LOGIN_ACTIVITIES_QUERY_KEY, userId, pageIndex, pageSize],
        queryFn: () => adminUsersApi.getLoginActivities(userId, { page: pageIndex, size: pageSize }),
        enabled: !!userId,
        placeholderData: keepPreviousData,
        staleTime: 30_000,
    });
}

export function useDeleteUserMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => adminUsersApi.delete(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY }),
    });
}

/**
 * `PUT /users/bulk` — one write across many people. Confirmed live: `userIds` (>=1) plus at
 * least one of `portalAccessEnabled`, `role` (`admin` | `owner` | `user`), or a non-empty
 * `securityGroups.add`/`.remove`. The response never throws for a per-person failure — it
 * names who succeeded and who did not in `results`, so a caller must read `failed` itself.
 */
export interface BulkUsersPayload {
    userIds: string[];
    portalAccessEnabled?: boolean;
    role?: 'admin' | 'owner' | 'user';
    securityGroups?: { add?: string[]; remove?: string[] };
}

export function useBulkUsersMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: BulkUsersPayload) =>
            apiClient
                .put<unknown, BulkUsersPayload>('/users/bulk', payload)
                .then((response) => bulkUsersResponseSchema.parse(response)),
        onSuccess: () =>
            Promise.all([
                queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY }),
                // Covers both the users list (`insights.users`) and the 5-stat summary strip
                // (`insights.metrics`) — a bulk change moves both.
                queryClient.invalidateQueries({ queryKey: [...INSIGHTS_QUERY_KEY, 'users'] }),
                queryClient.invalidateQueries({ queryKey: [...INSIGHTS_QUERY_KEY, 'metrics'] }),
            ]),
    });
}

export type { BulkUsersResponse };
