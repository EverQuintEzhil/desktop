import { keepPreviousData, useQuery } from '@tanstack/react-query';
import qs from 'qs';

import type { PagedList, RawPagedList } from '@/types/api-types';

import { apiClient, type ApiRequestConfig } from '../client';
import { mapPagedList } from '../mappers';

export interface RecallSection {
    type: string;
    memory_ref: string;
    tokens: number;
    score: number;
    metadata_json: string;
}

export interface RecallStats {
    tokens_used: number;
    state: string;
    latency_ms: number;
    dropped: unknown[];
}

export interface RecallLog {
    id: string;
    agentId: string;
    userId: string;
    conversationId: string;
    query: string;
    sections: RecallSection[];
    stats: RecallStats;
    ts: string;
}

export interface RecallLogsQueryParams {
    agentId?: string;
    userId?: string;
    conversationId?: string;
    memoryRef?: string;
    from?: string;
    to?: string;
    page?: number;
    size?: number;
}

/**
 * The recalls endpoint rejects requests with none of agentId / userId /
 * conversationId / memoryRef set (400 "At least one ... is required"). Callers
 * gate the query on this so we never fire an unsatisfiable request.
 */
export function hasRequiredRecallFilter(params: RecallLogsQueryParams): boolean {
    return Boolean(params.agentId || params.userId || params.conversationId || params.memoryRef);
}

export const adminMemoryRecallsApi = {
    async list(params: RecallLogsQueryParams = {}, config?: ApiRequestConfig): Promise<PagedList<RecallLog>> {
        const raw = await apiClient.get<RawPagedList<RecallLog>>('/memories/recalls', {
            params,
            paramsSerializer: (p) => qs.stringify(p, { arrayFormat: 'repeat' }),
            ...config,
        });

        return mapPagedList(raw);
    },
};

export const MEMORY_RECALLS_QUERY_KEY = ['admin', 'memory-recalls'] as const;

export function useRecallLogsQuery(params: RecallLogsQueryParams) {
    return useQuery({
        queryKey: [...MEMORY_RECALLS_QUERY_KEY, params],
        queryFn: () => adminMemoryRecallsApi.list(params),
        placeholderData: keepPreviousData,
        enabled: hasRequiredRecallFilter(params),
    });
}
