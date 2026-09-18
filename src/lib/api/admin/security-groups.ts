import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SortingState } from '@tanstack/react-table';
import qs from 'qs';

import type { SecurityGroupType } from '@/types/admin';
import type { PagedList, RawPagedList } from '@/types/api-types';

import { apiClient, type ApiRequestConfig } from '../client';
import { mapPagedList } from '../mappers';

export type MemberType = 'adminIds' | 'memberIds' | 'securityGroupIds' | 'userIds';

export const adminSecurityGroupsApi = {
    async list(
        params: { page?: number; size?: number; search?: string; sortBy?: string[] } = {},
        config?: ApiRequestConfig,
    ): Promise<PagedList<SecurityGroupType>> {
        const raw = await apiClient.get<RawPagedList<SecurityGroupType>>('/securitygroups', {
            params,
            paramsSerializer: (p) => qs.stringify(p, { arrayFormat: 'repeat' }),
            ...config,
        });

        return mapPagedList(raw);
    },

    async search(query: string, size = 10): Promise<SecurityGroupType[]> {
        const result = await adminSecurityGroupsApi.list({ page: 0, size, search: query });

        return result.values;
    },

    async getById(id: string): Promise<SecurityGroupType> {
        return apiClient.get<SecurityGroupType>(`/securitygroups/${id}`);
    },

    async create(data: object): Promise<SecurityGroupType> {
        return apiClient.post<SecurityGroupType>('/securitygroups', data);
    },

    async updateName(id: string, name: string): Promise<SecurityGroupType> {
        return apiClient.put<SecurityGroupType>(`/securitygroups/${id}/name`, { name });
    },

    async delete(id: string): Promise<unknown> {
        return apiClient.delete<unknown>(`/securitygroups/${id}`);
    },

    async listMembers<T>(
        id: string,
        memberType: MemberType,
        params: { page?: number; size?: number; search?: string; sortBy?: string[] } = {},
        config?: ApiRequestConfig,
    ): Promise<PagedList<T>> {
        const raw = await apiClient.get<RawPagedList<T>>(`/securitygroups/${id}/${memberType}`, {
            params,
            paramsSerializer: (p) => qs.stringify(p, { arrayFormat: 'repeat' }),
            ...config,
        });

        return mapPagedList(raw);
    },

    async pushMembers(id: string, memberType: MemberType, ids: string[]): Promise<unknown> {
        return apiClient.post<unknown>(`/securitygroups/${id}/${memberType}/push`, { ids });
    },

    async pullMember(id: string, memberType: MemberType, ids: string[]): Promise<unknown> {
        return apiClient.post<unknown>(`/securitygroups/${id}/${memberType}/pull`, { ids });
    },
};

export const SECURITY_GROUPS_QUERY_KEY = ['admin', 'security-groups'] as const;
export const SECURITY_GROUPS_LIST_QUERY_KEY = [...SECURITY_GROUPS_QUERY_KEY, 'list'] as const;

export interface SecurityGroupsQueryParams {
    pageIndex: number;
    pageSize: number;
    search: string;
    sort: SortingState;
}

export interface SecurityGroupMembersParams {
    pageIndex: number;
    pageSize: number;
    search: string;
    sort: SortingState;
}

export function useSecurityGroupsQuery(params: SecurityGroupsQueryParams) {
    return useQuery({
        queryKey: [...SECURITY_GROUPS_LIST_QUERY_KEY, params],
        queryFn: () =>
            adminSecurityGroupsApi.list({
                page: params.pageIndex,
                size: params.pageSize,
                search: params.search,
                sortBy: params.sort.map((s) => `${s.id}:${s.desc ? 'desc' : 'asc'}`),
            }),
        placeholderData: keepPreviousData,
    });
}

export function useSecurityGroupByIdQuery(id: string) {
    return useQuery({
        queryKey: [...SECURITY_GROUPS_QUERY_KEY, 'detail', id],
        queryFn: () => adminSecurityGroupsApi.getById(id),
        enabled: !!id,
    });
}

export function useSecurityGroupMembersQuery<T>(
    id: string,
    memberType: MemberType,
    params: SecurityGroupMembersParams,
    enabled = true,
) {
    return useQuery({
        queryKey: [...SECURITY_GROUPS_QUERY_KEY, 'members', id, memberType, params],
        queryFn: () =>
            adminSecurityGroupsApi.listMembers<T>(id, memberType, {
                page: params.pageIndex,
                size: params.pageSize,
                search: params.search,
                sortBy: params.sort.map((s) => `${s.id}:${s.desc ? 'desc' : 'asc'}`),
            }),
        placeholderData: keepPreviousData,
        enabled: !!id && enabled,
    });
}

export function useCreateSecurityGroupMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: object) => adminSecurityGroupsApi.create(data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: SECURITY_GROUPS_QUERY_KEY }),
    });
}

export function useUpdateSecurityGroupNameMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, name }: { id: string; name: string }) => adminSecurityGroupsApi.updateName(id, name),
        onSuccess: (updatedGroup) => {
            queryClient.setQueriesData<PagedList<SecurityGroupType>>(
                { queryKey: SECURITY_GROUPS_LIST_QUERY_KEY },
                (prev) => {
                    if (!prev) return prev;

                    return {
                        ...prev,
                        values: prev.values.map((g: SecurityGroupType) =>
                            g._id === updatedGroup._id ? updatedGroup : g,
                        ),
                    };
                },
            );
            queryClient.setQueryData([...SECURITY_GROUPS_QUERY_KEY, 'detail', updatedGroup._id], updatedGroup);
        },
    });
}

export function useDeleteSecurityGroupMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => adminSecurityGroupsApi.delete(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: SECURITY_GROUPS_QUERY_KEY }),
    });
}

export function usePushMembersMutation(securityGroupId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ memberType, ids }: { memberType: MemberType; ids: string[] }) =>
            adminSecurityGroupsApi.pushMembers(securityGroupId, memberType, ids),
        onSuccess: () =>
            queryClient.invalidateQueries({
                queryKey: [...SECURITY_GROUPS_QUERY_KEY, 'members', securityGroupId],
            }),
    });
}

export function usePullMemberMutation(securityGroupId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ memberType, ids }: { memberType: MemberType; ids: string[] }) =>
            adminSecurityGroupsApi.pullMember(securityGroupId, memberType, ids),
        onSuccess: () =>
            queryClient.invalidateQueries({
                queryKey: [...SECURITY_GROUPS_QUERY_KEY, 'members', securityGroupId],
            }),
    });
}
