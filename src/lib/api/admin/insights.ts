import { keepPreviousData, useQuery, useQueries } from '@tanstack/react-query';
import { addDays, isValid, parse, startOfDay, subDays } from 'date-fns';

import { apiClient } from '../client';

import { downloadCsvExportPost } from './csv-export';
import {
    buildAdoptionTrend,
    buildCapabilities,
    buildConsumption,
    buildDistribution,
    buildFailures,
    buildFunnel,
    buildGovernance,
    buildLeaderboards,
    buildSummary,
} from './insights-adapters';
import {
    usageCostByModelResponseSchema,
    usageCostBySecurityGroupResponseSchema,
    usageFailuresResponseSchema,
    usageMetricsResponseSchema,
    usageSeriesByModelResponseSchema,
    usageSeriesTenantResponseSchema,
    usageUserDetailResponseSchema,
    usageUsersResponseSchema,
    type ActivationFunnel,
    type AdoptionTrend,
    type Capabilities,
    type Consumption,
    type Distribution,
    type InsightsSummary,
    type Leaderboards,
    type SeriesInterval,
    type UsageMetricsResponse,
    type UsageUserDetailResponse,
    type UsageUsersResponse,
    type UserSegment,
    type Watchlist,
} from './insights-schema';

/**
 * `/reports/usage/*` (AMP-565) — see the "All four gaps closed" comment on that ticket for the
 * full contract, including `GET /reports/usage/series` (real trend data, no more sample
 * fixtures) and `POST /reports/usage/export` (existing route, not a new one).
 */
export const INSIGHTS_RANGES = ['24h', '7d', '30d', '90d', 'custom'] as const;

/** The range the report opens on when the URL says nothing. */
export const DEFAULT_RANGE = '7d' as const satisfies Exclude<InsightsRange, 'custom'>;

export type InsightsRange = (typeof INSIGHTS_RANGES)[number];

export interface InsightsFilters {
    range: InsightsRange;
    from: string;
    to: string;
    securityGroupIds: string[];
    agentIds: string[];
}

export const DEFAULT_INSIGHTS_FILTERS: InsightsFilters = {
    range: '7d',
    from: '',
    to: '',
    securityGroupIds: [],
    agentIds: [],
};

export interface UsagePeriod {
    from: string;
    to: string;
}

/** Whole calendar days each preset covers, today included. */
export const RANGE_DAYS: Record<Exclude<InsightsRange, 'custom'>, number> = {
    '24h': 1,
    '7d': 7,
    '30d': 30,
    '90d': 90,
};

/**
 * The first day a preset covers. Presets are whole calendar days, not rolling hours, so that
 * the dates shown in the pickers are the dates actually queried and switching a preset to
 * Custom cannot move the window: a rolling `now - 7d` spans 7.0 days but the same two dates
 * read as a custom range span 8.0, which silently inflated every total by a day.
 */
export const rangeStartDay = (range: Exclude<InsightsRange, 'custom'>, now: Date): Date =>
    startOfDay(subDays(now, RANGE_DAYS[range] - 1));

/** The server takes only `from`/`to` (ISO, `to` exclusive) — no `range` param, per AMP-565's `z.strictObject` validation. */
export function resolveInsightsPeriod(filters: InsightsFilters): UsagePeriod {
    const now = new Date();

    if (filters.range === 'custom' && filters.from && filters.to) {
        // Parsed as a local calendar date, never `new Date(string)`: that reads `2026-09-04` as
        // UTC midnight, which is the 3rd in any timezone west of UTC, so `startOfDay` then
        // rounds a custom range back a whole day for US readers.
        const parsedFrom = parse(filters.from, 'yyyy-MM-dd', new Date());
        const parsedTo = parse(filters.to, 'yyyy-MM-dd', new Date());

        // A hand-edited URL can carry a garbage `from`/`to` — fall through to the default range
        // rather than letting `.toISOString()` throw on an Invalid Date and crash the render.
        if (isValid(parsedFrom) && isValid(parsedTo)) {
            const from = startOfDay(parsedFrom);
            const to = addDays(startOfDay(parsedTo), 1);

            return { from: from.toISOString(), to: to.toISOString() };
        }
    }

    const range = filters.range === 'custom' ? DEFAULT_RANGE : filters.range;

    // Same day bounds as the custom branch above, so the two modes describe the same window.
    return {
        from: rangeStartDay(range, now).toISOString(),
        to: addDays(startOfDay(now), 1).toISOString(),
    };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** A compact sparkline over a long range needs coarser buckets than a 7-day one. */
export function resolveSeriesInterval(period: UsagePeriod): SeriesInterval {
    const days = (new Date(period.to).getTime() - new Date(period.from).getTime()) / DAY_MS;

    return days > 60 ? 'week' : 'day';
}

const usageReportsApi = {
    metrics: (period: UsagePeriod): Promise<UsageMetricsResponse> =>
        apiClient
            .get('/reports/usage/metrics', { params: period })
            .then((response) => usageMetricsResponseSchema.parse(response)),

    failures: (
        period: UsagePeriod,
        params: {
            reasons?: string[];
            agent_id?: string;
            fingerprint?: string;
            capability?: string;
            page?: number;
            size?: number;
        } = {},
    ) =>
        apiClient
            .get('/reports/usage/failures', { params: { ...period, ...params } })
            .then((response) => usageFailuresResponseSchema.parse(response)),

    costByModel: (period: UsagePeriod) =>
        apiClient
            .get('/reports/usage/cost', { params: { ...period, dimension: 'model' } })
            .then((response) => usageCostByModelResponseSchema.parse(response)),

    costBySecurityGroup: (period: UsagePeriod) =>
        apiClient
            .get('/reports/usage/cost', { params: { ...period, dimension: 'security_group' } })
            .then((response) => usageCostBySecurityGroupResponseSchema.parse(response)),

    series: (period: UsagePeriod, interval: SeriesInterval) =>
        apiClient
            .get('/reports/usage/series', { params: { ...period, interval } })
            .then((response) => usageSeriesTenantResponseSchema.parse(response)),

    seriesByModel: (period: UsagePeriod, interval: SeriesInterval) =>
        apiClient
            .get('/reports/usage/series', { params: { ...period, interval, dimension: 'model' } })
            .then((response) => usageSeriesByModelResponseSchema.parse(response)),

    export: (period: UsagePeriod): Promise<void> =>
        downloadCsvExportPost(
            '/reports/usage/export',
            { from: period.from, to: period.to },
            `usage_${period.from.slice(0, 10)}_${period.to.slice(0, 10)}.csv`,
        ),

    users: (period: UsagePeriod, params: UsageUsersParams = {}): Promise<UsageUsersResponse> =>
        apiClient
            .get('/reports/usage/users', {
                params: { ...period, ...params },
                // `flags` is repeatable and OR-ed server-side (`?flags=a&flags=b`); axios's
                // default array serializer emits `flags[]=a&flags[]=b`, which the endpoint's
                // strict query schema rejects outright as an unrecognized key.
                paramsSerializer: { serialize: serializeUsersParams },
            })
            .then((response) => usageUsersResponseSchema.parse(response)),

    userDetail: (userId: string, period: UsagePeriod): Promise<UsageUserDetailResponse> =>
        apiClient
            .get(`/reports/usage/users/${userId}`, { params: period })
            .then((response) => usageUserDetailResponseSchema.parse(response)),
};

/** Valid `sortBy` fields per the live endpoint's validation error: `(last_active|conversations|tokens|name|email):(asc|desc)`. */
export const USER_SORT_FIELDS = ['last_active', 'conversations', 'tokens', 'name', 'email'] as const;
export type UserSortField = (typeof USER_SORT_FIELDS)[number];
export type UserSortDirection = 'asc' | 'desc';

export interface UsageUsersParams {
    segment?: UserSegment;
    search?: string;
    sortBy?: `${UserSortField}:${UserSortDirection}`;
    page?: number;
    size?: number;
    /** Repeated on the wire as `flags=<a>&flags=<b>`, OR-ed. */
    flags?: string[];
}

const serializeUsersParams = (params: Record<string, unknown>): string => {
    const search = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;

        if (Array.isArray(value)) {
            value.forEach((item) => search.append(key, String(item)));
        } else {
            search.append(key, String(value));
        }
    });

    return search.toString();
};

export const INSIGHTS_QUERY_KEY = ['admin', 'insights'] as const;
const METRICS_KEY = (period: UsagePeriod) => [...INSIGHTS_QUERY_KEY, 'metrics', period] as const;
const FAILURES_KEY = (period: UsagePeriod) => [...INSIGHTS_QUERY_KEY, 'failures', period] as const;
const COST_MODEL_KEY = (period: UsagePeriod) => [...INSIGHTS_QUERY_KEY, 'cost', 'model', period] as const;
const COST_SECURITY_GROUP_KEY = (period: UsagePeriod) =>
    [...INSIGHTS_QUERY_KEY, 'cost', 'security_group', period] as const;
const SERIES_KEY = (period: UsagePeriod, interval: SeriesInterval) =>
    [...INSIGHTS_QUERY_KEY, 'series', period, interval] as const;
const SERIES_MODEL_KEY = (period: UsagePeriod, interval: SeriesInterval) =>
    [...INSIGHTS_QUERY_KEY, 'series', 'model', period, interval] as const;
const USERS_KEY = (period: UsagePeriod, params: UsageUsersParams) =>
    [...INSIGHTS_QUERY_KEY, 'users', period, params] as const;

/** The one call behind the KPIs, funnel, capability adoption and governance sections — they share this cache entry. */
export function useUsageMetricsQuery(period: UsagePeriod) {
    return useQuery({
        queryKey: METRICS_KEY(period),
        queryFn: () => usageReportsApi.metrics(period),
        placeholderData: keepPreviousData,
    });
}

function useMetricsSection<T>(period: UsagePeriod, select: (metrics: UsageMetricsResponse) => T) {
    return useQuery({
        queryKey: METRICS_KEY(period),
        queryFn: () => usageReportsApi.metrics(period),
        placeholderData: keepPreviousData,
        select,
    });
}

/** Trend is best-effort: the KPIs render off `metrics` alone, and pick up a trend line once `series` resolves. */
export function useInsightsSummaryQuery(period: UsagePeriod) {
    const interval = resolveSeriesInterval(period);
    const [metricsResult, seriesResult] = useQueries({
        queries: [
            {
                queryKey: METRICS_KEY(period),
                queryFn: () => usageReportsApi.metrics(period),
                placeholderData: keepPreviousData,
            },
            {
                // No `keepPreviousData` here: the trend line is a best-effort decoration on
                // top of `metrics`, and metrics has its own placeholder. Letting series keep a
                // stale placeholder across a range change would combine a fresh total with a
                // trend line from the previous range — momentarily wrong, not just stale.
                queryKey: SERIES_KEY(period, interval),
                queryFn: () => usageReportsApi.series(period, interval),
            },
        ],
    });

    const data: InsightsSummary | undefined = metricsResult.data
        ? buildSummary(metricsResult.data, seriesResult.data)
        : undefined;

    return {
        data,
        isPending: metricsResult.isPending,
        isError: metricsResult.isError,
        refetch: () => metricsResult.refetch(),
    };
}

/** The window immediately before `period`, the same length — the ghost line's source range. */
function shiftPeriodBack(period: UsagePeriod): UsagePeriod {
    const lengthMs = new Date(period.to).getTime() - new Date(period.from).getTime();

    return { from: new Date(new Date(period.from).getTime() - lengthMs).toISOString(), to: period.from };
}

/** "Adoption over time" — the current-period series plus a previous-period one for the ghost line. */
export function useInsightsSeriesComparisonQuery(period: UsagePeriod) {
    const interval = resolveSeriesInterval(period);
    const previousPeriod = shiftPeriodBack(period);

    const [currentResult, previousResult] = useQueries({
        queries: [
            {
                // Same key as the summary/consumption series calls — one request serves all three.
                queryKey: SERIES_KEY(period, interval),
                queryFn: () => usageReportsApi.series(period, interval),
            },
            {
                // No `keepPreviousData` — see the matching comment in useInsightsSummaryQuery;
                // a stale ghost line from the previous range read would be silently wrong.
                queryKey: SERIES_KEY(previousPeriod, interval),
                queryFn: () => usageReportsApi.series(previousPeriod, interval),
            },
        ],
    });

    const data: AdoptionTrend | undefined = currentResult.data
        ? buildAdoptionTrend(currentResult.data, previousResult.data)
        : undefined;

    return {
        data,
        isPending: currentResult.isPending,
        isError: currentResult.isError,
        refetch: () => Promise.all([currentResult.refetch(), previousResult.refetch()]),
    };
}

export function useInsightsFunnelQuery(period: UsagePeriod) {
    return useMetricsSection<ActivationFunnel>(period, buildFunnel);
}

export function useInsightsCapabilitiesQuery(period: UsagePeriod) {
    return useMetricsSection<Capabilities>(period, buildCapabilities);
}

export function useInsightsWatchlistQuery(period: UsagePeriod) {
    return useMetricsSection<Watchlist>(period, buildGovernance);
}

export function useInsightsFailuresQuery(period: UsagePeriod) {
    return useQuery({
        queryKey: FAILURES_KEY(period),
        queryFn: () => usageReportsApi.failures(period),
        placeholderData: keepPreviousData,
        select: buildFailures,
    });
}

/** Model mix and the "Over time" chart need `metrics` + `cost`; the trend line and cost movers are best-effort on top. */
export function useInsightsConsumptionQuery(period: UsagePeriod) {
    const interval = resolveSeriesInterval(period);
    const [metricsResult, costResult, seriesResult, modelSeriesResult] = useQueries({
        queries: [
            {
                queryKey: METRICS_KEY(period),
                queryFn: () => usageReportsApi.metrics(period),
                placeholderData: keepPreviousData,
            },
            {
                queryKey: COST_MODEL_KEY(period),
                queryFn: () => usageReportsApi.costByModel(period),
                placeholderData: keepPreviousData,
            },
            {
                // No `keepPreviousData` — see the matching comment in useInsightsSummaryQuery.
                queryKey: SERIES_KEY(period, interval),
                queryFn: () => usageReportsApi.series(period, interval),
            },
            {
                queryKey: SERIES_MODEL_KEY(period, interval),
                queryFn: () => usageReportsApi.seriesByModel(period, interval),
            },
        ],
    });

    const data: Consumption | undefined =
        metricsResult.data && costResult.data
            ? buildConsumption(metricsResult.data, costResult.data, seriesResult.data, modelSeriesResult.data)
            : undefined;

    return {
        data,
        isPending: metricsResult.isPending || costResult.isPending,
        isError: metricsResult.isError || costResult.isError,
        refetch: () =>
            Promise.all([
                metricsResult.refetch(),
                costResult.refetch(),
                seriesResult.refetch(),
                modelSeriesResult.refetch(),
            ]),
    };
}

export function useInsightsDistributionQuery(period: UsagePeriod) {
    return useQuery({
        queryKey: COST_SECURITY_GROUP_KEY(period),
        queryFn: () => usageReportsApi.costBySecurityGroup(period),
        placeholderData: keepPreviousData,
        select: (response): Distribution => buildDistribution(response),
    });
}

/** `GET /reports/usage/users` — the identity + activity + segment source for the Users list and the leaderboards. */
export function useUsageUsersQuery(period: UsagePeriod, params: UsageUsersParams = {}) {
    return useQuery({
        queryKey: USERS_KEY(period, params),
        queryFn: () => usageReportsApi.users(period, params),
        placeholderData: keepPreviousData,
    });
}

/** `GET /reports/usage/users/:userId` — one person's stats and 12-week activity for the detail page. */
export function useUsageUserDetailQuery(userId: string | undefined, period: UsagePeriod) {
    return useQuery({
        queryKey: [...INSIGHTS_QUERY_KEY, 'users', 'detail', userId, period] as const,
        queryFn: () => usageReportsApi.userDetail(userId as string, period),
        enabled: !!userId,
    });
}

/** "Most active" and "Broadest capability use" — two `/reports/usage/users` reads shaped for the leaderboard cards. */
export function useLeaderboardsQuery(period: UsagePeriod) {
    const mostActiveParams: UsageUsersParams = { sortBy: 'conversations:desc', size: 5 };
    // No server-side sort for capabilities_used_count — see the comment on buildLeaderboards.
    const broadestParams: UsageUsersParams = { size: 100 };

    const [mostActiveResult, broadestResult] = useQueries({
        queries: [
            {
                queryKey: USERS_KEY(period, mostActiveParams),
                queryFn: () => usageReportsApi.users(period, mostActiveParams),
                placeholderData: keepPreviousData,
            },
            {
                queryKey: USERS_KEY(period, broadestParams),
                queryFn: () => usageReportsApi.users(period, broadestParams),
                placeholderData: keepPreviousData,
            },
        ],
    });

    const data: Leaderboards | undefined =
        mostActiveResult.data && broadestResult.data
            ? buildLeaderboards(mostActiveResult.data, broadestResult.data)
            : undefined;

    return {
        data,
        isPending: mostActiveResult.isPending || broadestResult.isPending,
        isError: mostActiveResult.isError || broadestResult.isError,
        refetch: () => Promise.all([mostActiveResult.refetch(), broadestResult.refetch()]),
    };
}

export const exportUsageReport = (period: UsagePeriod): Promise<void> => usageReportsApi.export(period);

export type { Failures } from './insights-schema';
