import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { SortingState } from '@tanstack/react-table';
import qs from 'qs';

import type { AgentType } from '@/types/admin';
import type { PagedList, RawPagedList } from '@/types/api-types';

import { apiClient, type ApiRequestConfig } from '../client';
import { ADMIN_AGENT_DETAIL_KEY } from '../common/agent-cache';
import { mapPagedList } from '../mappers';

/** Raw paginated search result — keeps snake_case page_info (including optional count). */
export interface RawSearchPageInfo {
    page: number;
    total_pages: number;
    total_count: number;
    count?: number;
}

export interface RawSearchList<T> {
    values: T[];
    page_info: RawSearchPageInfo;
}

export const adminAgentsApi = {
    async list(
        params: {
            page?: number;
            size?: number;
            search?: string;
            sortBy?: string[];
            isDeleted?: boolean;
            ids?: string[];
            userIds?: string[];
        } = {},
        config?: ApiRequestConfig,
    ): Promise<PagedList<AgentType>> {
        const raw = await apiClient.get<RawPagedList<AgentType>>('/agents', {
            ...config,
            params,
            paramsSerializer: (p) => qs.stringify(p, { arrayFormat: 'repeat' }),
        });

        return mapPagedList(raw);
    },

    async getBySlugOrId(slugOrId: string, config?: ApiRequestConfig): Promise<AgentType> {
        return apiClient.get<AgentType>(`/agents/${slugOrId}`, config);
    },

    async create(data: Partial<AgentType>): Promise<AgentType> {
        return apiClient.post<AgentType>('/agents', data);
    },

    async update(id: string, data: Partial<AgentType> | Record<string, unknown>): Promise<AgentType> {
        return apiClient.put<AgentType>(`/agents/${id}`, data);
    },

    async delete(id: string, force = false): Promise<unknown> {
        const url = force ? `/agents/${id}/force` : `/agents/${id}`;

        return apiClient.delete<unknown>(url);
    },

    async clone(id: string): Promise<AgentType> {
        return apiClient.post<AgentType>(`/agents/${id}/clone`);
    },

    async revert(id: string): Promise<unknown> {
        return apiClient.post<unknown>(`/agents/${id}/revert`);
    },

    async execute(id: string, data: unknown): Promise<unknown> {
        return apiClient.post<unknown>(`/agents/${id}/execute`, data);
    },

    async getBinary(id: string, config?: ApiRequestConfig): Promise<unknown> {
        return apiClient.get<unknown>(`/agents/${id}/binary`, config);
    },

    async createBinary(id: string, data: unknown): Promise<unknown> {
        return apiClient.post<unknown>(`/agents/${id}/binary`, data);
    },

    async updateBinary(id: string, data: unknown): Promise<unknown> {
        return apiClient.put<unknown>(`/agents/${id}/binary`, data);
    },

    async searchConversations(
        agentId: string,
        data: unknown,
        config?: ApiRequestConfig,
    ): Promise<RawSearchList<unknown>> {
        return apiClient.post<RawSearchList<unknown>>(`/agents/${agentId}/conversations/search`, data, config);
    },

    async getConversationMessages(
        agentId: string,
        conversationId: string,
        params?: Record<string, unknown>,
    ): Promise<RawSearchList<unknown>> {
        return apiClient.get<RawSearchList<unknown>>(`/agents/${agentId}/conversations/${conversationId}/messages`, {
            params,
        });
    },
};

export const AGENTS_QUERY_KEY = ['admin', 'agents'] as const;
export const AGENTS_LIST_QUERY_KEY = [...AGENTS_QUERY_KEY, 'list'] as const;
export const AGENTS_DETAIL_QUERY_KEY = ADMIN_AGENT_DETAIL_KEY;

export interface AgentsQueryParams {
    pageIndex: number;
    pageSize: number;
    search: string;
    sort: SortingState;
    isDeleted: boolean;
    ids?: string[];
    userIds?: string[];
}

export function useAgentsQuery(params: AgentsQueryParams) {
    return useQuery({
        queryKey: [...AGENTS_LIST_QUERY_KEY, params],
        queryFn: () =>
            adminAgentsApi.list({
                page: params.pageIndex,
                size: params.pageSize,
                search: params.search,
                sortBy: params.sort.map((s) => `${s.id}:${s.desc ? 'desc' : 'asc'}`),
                isDeleted: params.isDeleted,
                ids: params.ids,
                userIds: params.userIds,
            }),
        placeholderData: keepPreviousData,
    });
}

export function useAgentBySlugOrIdQuery(slugOrId: string | undefined) {
    return useQuery({
        queryKey: [...AGENTS_DETAIL_QUERY_KEY, slugOrId],
        queryFn: () => adminAgentsApi.getBySlugOrId(slugOrId!),
        enabled: !!slugOrId,
        refetchOnWindowFocus: false,
    });
}

function invalidateAgentsQueries(queryClient: QueryClient) {
    queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEY });
}

export function useCreateAgentMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: Partial<AgentType>) => adminAgentsApi.create(data),
        onSuccess: () => invalidateAgentsQueries(queryClient),
    });
}

export type UpdateAgentMutationVariables = {
    id: string;
    data: Partial<AgentType> | Record<string, unknown>;
    /**
     * Current `/admin/agents/:agentId` segment when updating from detail (often slug).
     * Required so React Query updates the cache entry that is actually subscribed after the slug changes.
     */
    routeSlugOrId?: string;
};

/** Writes agent detail cache under every key callers might use (`_id`, response slug, mutation id, current route segment). */
export function setAgentDetailCaches(
    queryClient: QueryClient,
    updatedAgent: AgentType,
    mutationId: string,
    routeSlugOrId?: string,
) {
    const keys = new Set<string>();

    keys.add(mutationId);
    keys.add(updatedAgent._id);

    const slug = updatedAgent.slug?.trim();

    if (slug) {
        keys.add(slug);
    }

    const routeKey = routeSlugOrId?.trim();

    if (routeKey) {
        keys.add(routeKey);
    }

    keys.forEach((key) => {
        if (key) {
            queryClient.setQueryData([...AGENTS_DETAIL_QUERY_KEY, key], updatedAgent);
        }
    });
}

export function useUpdateAgentMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: UpdateAgentMutationVariables) => adminAgentsApi.update(id, data),
        onSuccess: (updatedAgent, variables) => {
            queryClient.setQueriesData<PagedList<AgentType>>({ queryKey: AGENTS_LIST_QUERY_KEY }, (prev) => {
                if (!prev) return prev;

                return {
                    ...prev,
                    values: prev.values.map((a: AgentType) => (a._id === updatedAgent._id ? updatedAgent : a)),
                };
            });
            setAgentDetailCaches(queryClient, updatedAgent, variables.id, variables.routeSlugOrId);
        },
    });
}

export function useDeleteAgentMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            id,
            force = false,
        }: {
            id: string;
            force?: boolean;
            /** Detail query key uses URL segment (often slug); pass for cache removal when deleting from list/detail. */
            slug?: string;
        }) => adminAgentsApi.delete(id, force),
        onSuccess: (_data, variables) => {
            queryClient.removeQueries({ queryKey: [...AGENTS_DETAIL_QUERY_KEY, variables.id] });
            if (variables.slug != null && variables.slug !== variables.id) {
                queryClient.removeQueries({ queryKey: [...AGENTS_DETAIL_QUERY_KEY, variables.slug] });
            }
            void queryClient.invalidateQueries({ queryKey: AGENTS_LIST_QUERY_KEY });
        },
    });
}

export function useCloneAgentMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => adminAgentsApi.clone(id),
        onSuccess: () => invalidateAgentsQueries(queryClient),
    });
}

export function useRevertAgentMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => adminAgentsApi.revert(id),
        onSuccess: () => invalidateAgentsQueries(queryClient),
    });
}

export function useExecuteAgentMutation() {
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: unknown }) => adminAgentsApi.execute(id, data),
    });
}

export function useAgentBinaryQuery(agentId: string | undefined) {
    return useQuery({
        queryKey: [...AGENTS_QUERY_KEY, 'binary', agentId],
        queryFn: () => adminAgentsApi.getBinary(agentId!),
        enabled: !!agentId,
        retry: false,
    });
}

export function useCreateAgentBinaryMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: unknown }) => adminAgentsApi.createBinary(id, data),
        onSuccess: (_, variables) => {
            invalidateAgentsQueries(queryClient);
            queryClient.invalidateQueries({ queryKey: [...AGENTS_QUERY_KEY, 'binary', variables.id] });
        },
    });
}

export function useUpdateAgentBinaryMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: unknown }) => adminAgentsApi.updateBinary(id, data),
        onSuccess: (_, variables) => {
            invalidateAgentsQueries(queryClient);
            queryClient.invalidateQueries({ queryKey: [...AGENTS_QUERY_KEY, 'binary', variables.id] });
        },
    });
}

export function useSearchAgentConversationsMutation() {
    return useMutation({
        mutationFn: ({ agentId, data, config }: { agentId: string; data: unknown; config?: ApiRequestConfig }) =>
            adminAgentsApi.searchConversations(agentId, data, config),
    });
}

export function useAgentConversationMessagesQuery(
    agentId: string | undefined,
    conversationId: string | undefined,
    params?: Record<string, unknown>,
) {
    return useQuery({
        queryKey: [...AGENTS_QUERY_KEY, agentId, 'conversation-messages', conversationId, params],
        queryFn: () => adminAgentsApi.getConversationMessages(agentId!, conversationId!, params),
        enabled: !!agentId && !!conversationId,
    });
}
