import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import qs from 'qs';

import type { CodeType } from '@/types/admin';
import type { RawPagedList } from '@/types/api-types';

import { apiClient } from '../client';

export const CODE_MANAGER_QUERY_KEY = ['admin', 'code-manager'] as const;

const CODE_LIST_SORT = 'createdAt:desc';

export const adminCodeManagerApi = {
    async listCodes(
        params: {
            toolId?: string;
            agentId?: string;
            sortBy?: string;
            type?: string[];
            page?: number;
            size?: number;
        } = {},
    ): Promise<RawPagedList<CodeType>> {
        return apiClient.get<RawPagedList<CodeType>>('/codes', {
            params,
            paramsSerializer: (p) => qs.stringify(p, { arrayFormat: 'repeat' }),
        });
    },

    async createCode(data: object): Promise<CodeType> {
        return apiClient.post<CodeType>('/codes', data);
    },

    async updateCode(id: string, data: object): Promise<CodeType> {
        return apiClient.put<CodeType>(`/codes/${id}`, data);
    },

    async deleteCode(id: string): Promise<void> {
        return apiClient.delete<void>(`/codes/${id}`);
    },

    async updateEntity<T = unknown>(category: string, categoryId: string, data: object): Promise<T> {
        return apiClient.put<T>(`/${category}/${categoryId}`, data);
    },

    async getEntity<T = unknown>(category: string, categoryId: string): Promise<T> {
        return apiClient.get<T>(`/${category}/${categoryId}`);
    },

    async executeTool<T = unknown>(toolId: string, data: object): Promise<T> {
        return apiClient.post<T>(`/tools/${toolId}/execute`, data);
    },
};

export function useCodeListQuery(
    categoryId: string | undefined,
    categoryIdFieldName: string = 'toolId',
    type?: string[],
) {
    return useQuery({
        queryKey: [...CODE_MANAGER_QUERY_KEY, 'list', categoryId, type, CODE_LIST_SORT],
        queryFn: () =>
            adminCodeManagerApi.listCodes({
                [categoryIdFieldName]: categoryId,
                sortBy: CODE_LIST_SORT,
                type,
            }),
        enabled: !!categoryId,
        refetchOnWindowFocus: false,
    });
}

export function useCodeListInfiniteQuery(
    categoryId: string | undefined,
    categoryIdFieldName: string = 'toolId',
    type?: string[],
) {
    return useInfiniteQuery({
        queryKey: [...CODE_MANAGER_QUERY_KEY, 'list-infinite', categoryId, type, CODE_LIST_SORT],
        queryFn: ({ pageParam = 0 }) =>
            adminCodeManagerApi.listCodes({
                [categoryIdFieldName]: categoryId,
                sortBy: CODE_LIST_SORT,
                type,
                page: pageParam,
                size: 20,
            }),
        initialPageParam: 0,
        getNextPageParam: (lastPage) => {
            const nextPage = lastPage.page_info.page + 1;

            return nextPage < lastPage.page_info.total_pages ? nextPage : undefined;
        },
        enabled: !!categoryId,
        refetchOnWindowFocus: false,
    });
}

export function useCreateCodeMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: object) => adminCodeManagerApi.createCode(data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: CODE_MANAGER_QUERY_KEY }),
    });
}

export function useUpdateCodeMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: object }) => adminCodeManagerApi.updateCode(id, data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: CODE_MANAGER_QUERY_KEY }),
    });
}

export function useDeleteCodeMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => adminCodeManagerApi.deleteCode(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: CODE_MANAGER_QUERY_KEY }),
    });
}

export interface CodeManagerUpdateEntityVariables {
    category: string;
    categoryId: string;
    data: object;
}

export function useCodeManagerUpdateEntityMutation() {
    return useMutation({
        mutationFn: (vars: CodeManagerUpdateEntityVariables) =>
            adminCodeManagerApi.updateEntity(vars.category, vars.categoryId, vars.data),
    });
}

export function useExecuteToolMutation() {
    return useMutation({
        mutationFn: ({ toolId, data }: { toolId: string; data: object }) =>
            adminCodeManagerApi.executeTool(toolId, data),
    });
}
