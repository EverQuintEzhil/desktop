import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { SortingState } from '@tanstack/react-table';
import qs from 'qs';

import type { PromptType } from '@/types/admin';
import type { PagedList, RawPagedList } from '@/types/api-types';

import { apiClient, type ApiRequestConfig } from '../client';
import { mapPagedList } from '../mappers';

export const adminPromptsApi = {
    async list(
        params: { page?: number; size?: number; search?: string; sortBy?: string[] } = {},
        config?: ApiRequestConfig,
    ): Promise<PagedList<PromptType>> {
        const raw = await apiClient.get<RawPagedList<PromptType>>('/prompts', {
            params,
            paramsSerializer: (p) => qs.stringify(p, { arrayFormat: 'repeat' }),
            ...config,
        });

        return mapPagedList(raw);
    },

    async getById(id: string, config?: ApiRequestConfig): Promise<PromptType> {
        return apiClient.get<PromptType>(`/prompts/${id}`, config);
    },

    async create(data: object, config?: ApiRequestConfig): Promise<PromptType> {
        return apiClient.post<PromptType>('/prompts', data, config);
    },

    async update(id: string, data: object, config?: ApiRequestConfig): Promise<PromptType> {
        return apiClient.put<PromptType>(`/prompts/${id}`, data, config);
    },

    async delete(id: string, config?: ApiRequestConfig): Promise<unknown> {
        return apiClient.delete<unknown>(`/prompts/${id}`, config);
    },
};

export const PROMPTS_QUERY_KEY = ['admin', 'prompts'] as const;
export const PROMPTS_LIST_QUERY_KEY = [...PROMPTS_QUERY_KEY, 'list'] as const;

export interface PromptsQueryParams {
    pageIndex: number;
    pageSize: number;
    search: string;
    sort: SortingState;
}

export function invalidatePromptsQueries(queryClient: QueryClient, promptId?: string) {
    void queryClient.invalidateQueries({ queryKey: PROMPTS_LIST_QUERY_KEY });

    if (promptId) {
        void queryClient.invalidateQueries({
            queryKey: [...PROMPTS_QUERY_KEY, 'detail', promptId],
            exact: true,
        });
    }
}

export function usePromptsQuery(params: PromptsQueryParams) {
    return useQuery({
        queryKey: [...PROMPTS_LIST_QUERY_KEY, params],
        queryFn: ({ signal }) =>
            adminPromptsApi.list(
                {
                    page: params.pageIndex,
                    size: params.pageSize,
                    search: params.search,
                    sortBy: params.sort.map((s) => `${s.id}:${s.desc ? 'desc' : 'asc'}`),
                },
                { signal },
            ),
        placeholderData: keepPreviousData,
    });
}

export function usePromptByIdQuery(id: string | undefined) {
    return useQuery({
        queryKey: [...PROMPTS_QUERY_KEY, 'detail', id],
        queryFn: ({ signal }) => adminPromptsApi.getById(id!, { signal }),
        enabled: !!id,
    });
}

export function useCreatePromptMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: object) => adminPromptsApi.create(data),
        onSuccess: () => invalidatePromptsQueries(queryClient),
    });
}

export function useUpdatePromptMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: object }) => adminPromptsApi.update(id, data),
        onSuccess: (updatedPrompt, variables) => {
            queryClient.setQueriesData<PagedList<PromptType>>({ queryKey: PROMPTS_LIST_QUERY_KEY }, (prev) => {
                if (!prev) return prev;

                return {
                    ...prev,
                    values: prev.values.map((p: PromptType) => (p._id === updatedPrompt._id ? updatedPrompt : p)),
                };
            });
            queryClient.setQueryData([...PROMPTS_QUERY_KEY, 'detail', variables.id], updatedPrompt);
            if (updatedPrompt._id !== variables.id) {
                queryClient.setQueryData([...PROMPTS_QUERY_KEY, 'detail', updatedPrompt._id], updatedPrompt);
            }
        },
    });
}

export function useDeletePromptMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => adminPromptsApi.delete(id),
        onSuccess: (_data, deletedId) => {
            queryClient.removeQueries({ queryKey: [...PROMPTS_QUERY_KEY, 'detail', deletedId] });
            void queryClient.invalidateQueries({ queryKey: PROMPTS_LIST_QUERY_KEY });
        },
    });
}
