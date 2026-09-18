import {
    keepPreviousData,
    useInfiniteQuery,
    useMutation,
    useQuery,
    useQueryClient,
    type UseMutationOptions,
} from '@tanstack/react-query';
import qs from 'qs';

import type { CodeTypeEnum } from '@/types/admin';
import type { RawPagedList } from '@/types/api-types';
import { getBrowserTimezone } from '@/utils/browser-timezone';

import { apiClient, type ApiRequestConfig } from '../client';

import { downloadCsvExport } from './csv-export';

export const AUDIT_LOG_SEVERITIES = ['critical', 'warning', 'notice', 'info'] as const;
export const AUDIT_LOG_CATEGORIES = [
    'Access',
    'Authorization',
    'Configuration',
    'Knowledge',
    'Consumption',
    'Governance',
] as const;
export const AUDIT_LOG_OUTCOMES = ['success', 'denied', 'error'] as const;
export const AUDIT_LOG_ACTOR_TYPES = ['person', 'agent', 'system', 'unknown'] as const;
export const AUDIT_LOG_RANGES = ['1h', '24h', '7d', '30d', 'custom'] as const;

export type AuditLogSource = 'audit' | 'auth';
export type AuditLogSeverity = (typeof AUDIT_LOG_SEVERITIES)[number];
export type AuditLogCategory = (typeof AUDIT_LOG_CATEGORIES)[number];
export type AuditLogOutcome = (typeof AUDIT_LOG_OUTCOMES)[number];
export type AuditLogActorType = (typeof AUDIT_LOG_ACTOR_TYPES)[number];
export type AuditLogRange = (typeof AUDIT_LOG_RANGES)[number];
export type AuditLogGroupBy = 'none' | 'burst' | 'session' | 'actor';

export interface AuditLogActor {
    _id: string;
    name: {
        first: string;
        middle?: string;
        last: string;
    };
    avatar?: string;
}

/**
 * The record the audited resource belongs to — a code's owning agent, for
 * example. `kind` is singular (`agent`), unlike the plural collection names in
 * `resourceType`.
 */
export interface AuditLogSummaryParent {
    id: string;
    kind: string;
    name: string;
}

/** Shape varies by resource type; only the fields common enough to render are typed. */
export interface AuditLogSummary {
    resourceName?: string | null;
    label?: string | null;
    parent?: AuditLogSummaryParent | null;
    /** `codes` events only — which editor tab on the parent holds this code. */
    codeType?: CodeTypeEnum | null;
    /** `codes` events only — the version and language of the code that changed. */
    version?: string | null;
    lang?: string | null;
}

export interface AuditLogTarget {
    type: string;
    /** Null when what was acted on was never a stored record. */
    id: string | null;
    name: string | null;
}

export interface AuditLogGroup {
    mode: 'burst' | 'session' | 'actor';
    key: string;
    count: number;
    firstAt: string;
    lastAt: string;
}

export interface AuditLog {
    _id: string;
    source: AuditLogSource;
    createdAt: string;
    severity: AuditLogSeverity;
    category: AuditLogCategory;
    outcome: AuditLogOutcome;
    title: string;
    detail: string | null;
    target: AuditLogTarget | null;
    /** Null for an unauthenticated attempt and for a deleted account — `actorName` still resolves. */
    actor?: AuditLogActor | null;
    actorType: AuditLogActorType;
    actorName: string | null;
    actorEmail: string;
    actorRole: string | null;
    isSystemNoise: boolean;
    group: AuditLogGroup | null;
    /** Burst-mode alias of `group`, kept by the API for its first contract. */
    burst: AuditLogGroup | null;
    /** Null on rows written before the API captured sessions. */
    sessionId: string | null;
    method: string | null;
    path: string | null;
    resourceType: string | null;
    resourceId: string | null;
    action: string;
    statusCode: number | null;
    /** Names of the submitted body fields. The API never records their values. */
    bodyKeys?: string[];
    summary?: AuditLogSummary | null;
    ipAddr: string | null;
    userAgent: string | null;
}

export type AuditLogCounts<Key extends string> = Record<Key, number>;

export interface AuditLogHistogramBucket {
    /**
     * Tenant-local wall-clock text with no offset. Passing it through `new Date()`
     * re-reads it in the browser's zone and shifts the bar.
     */
    bucket: string;
    count: number;
    /** Absent on responses from before the API split buckets by severity. */
    severities?: AuditLogCounts<AuditLogSeverity>;
}

export interface AuditLogFacets {
    whoActed: { everyone: number; people: number; agents: number; system: number; unknown: number };
    severities: AuditLogCounts<AuditLogSeverity>;
    outcomes: AuditLogCounts<AuditLogOutcome>;
    categories: AuditLogCounts<AuditLogCategory>;
    needsAttention: { total: number; values: AuditLog[] };
    histogram: {
        /** Open on purpose — the API chooses the granularity and has added values before. */
        interval: string;
        timezone: string;
        /** The API omits empty buckets, so the axis has to be padded here. */
        buckets: AuditLogHistogramBucket[];
    };
    hiddenNoiseCount: number;
    /** `enforced: false` — the log is append-only but nothing prunes rows at `days` yet. */
    retention: { days: number; immutable: boolean; enforced: boolean };
}

export interface AuditLogsFilters {
    sources: AuditLogSource[];
    search?: string;
    range: AuditLogRange;
    createdStartDate?: string;
    createdEndDate?: string;
    severities: AuditLogSeverity[];
    categories: AuditLogCategory[];
    outcomes: AuditLogOutcome[];
    actorTypes: AuditLogActorType[];
    actorIds: string[];
    hideSystemNoise: boolean;
    groupBy: AuditLogGroupBy;
    sortBy: string[];
}

export const DEFAULT_AUDIT_LOGS_PAGE_SIZE = 25;

/**
 * The API validates every audit route with a strict object, so an unknown key is a
 * 400 rather than being ignored — only keys with a real value may be sent.
 */
const toQuery = (filters: AuditLogsFilters): Record<string, unknown> => ({
    sources: filters.sources,
    search: filters.search || undefined,
    range: filters.range,
    createdStartDate: filters.range === 'custom' ? filters.createdStartDate || undefined : undefined,
    createdEndDate: filters.range === 'custom' ? filters.createdEndDate || undefined : undefined,
    severities: filters.severities.length ? filters.severities : undefined,
    categories: filters.categories.length ? filters.categories : undefined,
    outcomes: filters.outcomes.length ? filters.outcomes : undefined,
    actorTypes: filters.actorTypes.length ? filters.actorTypes : undefined,
    actorIds: filters.actorIds.length ? filters.actorIds : undefined,
    hideSystemNoise: filters.hideSystemNoise ? true : undefined,
    groupBy: filters.groupBy,
    sortBy: filters.sortBy,
    timezone: getBrowserTimezone(),
});

const serializeParams = (params: Record<string, unknown>) => qs.stringify(params, { arrayFormat: 'repeat' });

const request = <T>(url: string, params: Record<string, unknown>, config?: ApiRequestConfig) =>
    apiClient.get<T>(url, { params, paramsSerializer: serializeParams, ...config });

export const adminAuditLogsApi = {
    /** With `groupBy` set, `total_count` counts groups, not the events inside them. */
    async list(
        filters: AuditLogsFilters,
        page: number,
        size = DEFAULT_AUDIT_LOGS_PAGE_SIZE,
        config?: ApiRequestConfig,
    ): Promise<RawPagedList<AuditLog>> {
        return request<RawPagedList<AuditLog>>('/auditlogs', { ...toQuery(filters), page, size }, config);
    },

    async facets(filters: AuditLogsFilters, config?: ApiRequestConfig): Promise<AuditLogFacets> {
        return request<AuditLogFacets>('/auditlogs/facets', toQuery(filters), config);
    },

    /** The key names a group *within* the filtered population, so the filters go with it. */
    async groupMembers(filters: AuditLogsFilters, groupKey: string, size?: number): Promise<AuditLogGroupMembers> {
        return request<AuditLogGroupMembers>('/auditlogs/burst', {
            ...toQuery(filters),
            groupKey,
            ...(size ? { size } : {}),
        });
    },

    /** Requests the CSV from `/auditlogs/export` and triggers a browser download. */
    async export(filters: AuditLogsFilters): Promise<void> {
        return downloadCsvExport('/auditlogs/export', toQuery(filters), 'activity-log.csv');
    },

    async getById(id: string, config?: ApiRequestConfig): Promise<AuditLog> {
        return request<AuditLog>(`/auditlogs/${id}`, {}, config);
    },
};

export interface AuditLogGroupMembers {
    count: number;
    values: AuditLog[];
}

export const AUDIT_LOGS_QUERY_KEY = ['admin', 'audit-logs'] as const;
export const AUDIT_LOGS_LIST_QUERY_KEY = [...AUDIT_LOGS_QUERY_KEY, 'list'] as const;
export const AUDIT_LOGS_FACETS_QUERY_KEY = [...AUDIT_LOGS_QUERY_KEY, 'facets'] as const;
export const AUDIT_LOGS_GROUP_QUERY_KEY = [...AUDIT_LOGS_QUERY_KEY, 'group'] as const;
export const AUDIT_LOGS_RELATED_QUERY_KEY = [...AUDIT_LOGS_QUERY_KEY, 'related'] as const;
export const AUDIT_LOGS_BY_ID_QUERY_KEY = [...AUDIT_LOGS_QUERY_KEY, 'by-id'] as const;

export function useAuditLogsFeedQuery(filters: AuditLogsFilters, size = DEFAULT_AUDIT_LOGS_PAGE_SIZE) {
    return useInfiniteQuery({
        queryKey: [...AUDIT_LOGS_LIST_QUERY_KEY, filters, size],
        queryFn: ({ pageParam }) => adminAuditLogsApi.list(filters, pageParam, size),
        initialPageParam: 0,
        getNextPageParam: (lastPage) => {
            const next = lastPage.page_info.page + 1;

            return next < lastPage.page_info.total_pages ? next : undefined;
        },
        placeholderData: keepPreviousData,
    });
}

export function useAuditLogFacetsQuery(filters: AuditLogsFilters) {
    return useQuery({
        queryKey: [...AUDIT_LOGS_FACETS_QUERY_KEY, filters],
        queryFn: () => adminAuditLogsApi.facets(filters),
        placeholderData: keepPreviousData,
    });
}

export function useAuditLogGroupQuery(filters: AuditLogsFilters, groupKey: string | null) {
    return useQuery({
        queryKey: [...AUDIT_LOGS_GROUP_QUERY_KEY, filters, groupKey],
        queryFn: async () => (await adminAuditLogsApi.groupMembers(filters, groupKey as string)).values,
        enabled: Boolean(groupKey),
    });
}

export function useAuditLogQuery(id: string | null) {
    return useQuery({
        queryKey: [...AUDIT_LOGS_BY_ID_QUERY_KEY, id],
        queryFn: () => adminAuditLogsApi.getById(id as string),
        enabled: Boolean(id),
        retry: false,
    });
}

export interface AuditLogRelatedRequest {
    filters: AuditLogsFilters;
    /** Set for a session lookup, which the group route answers rather than the list. */
    groupKey?: string;
}

export interface AuditLogRelated {
    values: AuditLog[];
    totalCount: number;
}

/**
 * A single fetch, not a page: the drawer shows a preview and hands anything longer to the
 * feed, which is the screen built for reading a long list.
 */
export function useAuditLogRelatedQuery(request_: AuditLogRelatedRequest | null, size = 6) {
    return useQuery({
        queryKey: [...AUDIT_LOGS_RELATED_QUERY_KEY, request_, size],
        enabled: request_ !== null,
        queryFn: async (): Promise<AuditLogRelated> => {
            const { filters, groupKey } = request_ as AuditLogRelatedRequest;

            if (groupKey) {
                const group = await adminAuditLogsApi.groupMembers(filters, groupKey, size);

                return { values: group.values, totalCount: group.count };
            }

            const page = await adminAuditLogsApi.list(filters, 0, size);

            return { values: page.values, totalCount: page.page_info.total_count };
        },
    });
}

/**
 * An export writes a Critical event about itself, which reaches the feed at once —
 * so the refetch lives here rather than at each call site.
 */
export function useExportAuditLogsMutation(
    options?: Omit<UseMutationOptions<void, unknown, AuditLogsFilters>, 'mutationFn'>,
) {
    const queryClient = useQueryClient();

    return useMutation({
        ...options,
        mutationFn: (filters: AuditLogsFilters) => adminAuditLogsApi.export(filters),
        onSuccess: (...args) => {
            void queryClient.invalidateQueries({ queryKey: AUDIT_LOGS_QUERY_KEY });
            options?.onSuccess?.(...args);
        },
    });
}
