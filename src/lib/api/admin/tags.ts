import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SortingState } from '@tanstack/react-table';

import type { TagForEnum, TagType } from '@/types/admin';

import { apiClient } from '../client';
import { tagsApi } from '../common/tags';

export const adminTagsApi = {
    list: tagsApi.list,
    getById: tagsApi.getById,

    async create(data: object): Promise<TagType> {
        return apiClient.post<TagType>('/tags', data);
    },

    async update(id: string, data: object): Promise<TagType> {
        return apiClient.put<TagType>(`/tags/${id}`, data);
    },

    async delete(id: string): Promise<unknown> {
        return apiClient.delete<unknown>(`/tags/${id}`);
    },
};

export const TAGS_QUERY_KEY = ['admin', 'tags'] as const;
export const TAGS_LIST_QUERY_KEY = [...TAGS_QUERY_KEY, 'list'] as const;

export interface TagsQueryParams {
    pageIndex: number;
    pageSize: number;
    search: string;
    sort: SortingState;
    tagFor: TagForEnum;
}

export function useTagsQuery(params: TagsQueryParams) {
    return useQuery({
        queryKey: [...TAGS_LIST_QUERY_KEY, params],
        queryFn: () =>
            adminTagsApi.list({
                page: params.pageIndex,
                size: params.pageSize,
                search: params.search,
                sortBy: params.sort.map((s) => `${s.id}:${s.desc ? 'desc' : 'asc'}`),
                tagFor: params.tagFor,
            }),
        placeholderData: keepPreviousData,
    });
}

export function useCreateTagMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: object) => adminTagsApi.create(data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: TAGS_QUERY_KEY }),
    });
}

export function useUpdateTagMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: object }) => adminTagsApi.update(id, data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: TAGS_QUERY_KEY }),
    });
}

export function useDeleteTagMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => adminTagsApi.delete(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: TAGS_QUERY_KEY }),
    });
}
