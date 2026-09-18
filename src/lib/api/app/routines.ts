import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import type { z } from 'zod';

import type { PagedList, RawPagedList } from '@/types/api-types';
import {
    routineEventSourceSchema,
    routineConnectorSchema,
    routineRunSchema,
    routineRunStepSchema,
    routineSchema,
    routineTriggerInputSchema,
    routineTriggerSchema,
    type RoutineConnector,
    type RoutineEventSource,
    type RoutineRunDetailType,
    type RoutineRunStatus,
    type RoutineRunType,
    type RoutineStatus,
    type RoutineTriggerInput,
    type RoutineTriggerRecord,
    type RoutineType,
} from '@/types/routines';
import { showErrorToast } from '@/utils';

import { uiAxios } from '../../axios';
import { apiClient, type ApiRequestConfig } from '../client';
import { getApiErrorMessage } from '../get-api-error-message';
import { mapPagedList } from '../mappers';

export const ROUTINE_QUERY_KEY = ['routines', 'detail'] as const;
export const ROUTINES_LIST_QUERY_KEY = ['routines', 'list'] as const;
export const ROUTINE_RUNS_QUERY_KEY = ['routines', 'runs'] as const;
export const ROUTINE_RUN_QUERY_KEY = ['routines', 'run'] as const;
export const ROUTINE_TRIGGERS_QUERY_KEY = ['routines', 'triggers'] as const;

// Deliberately outside the `routines` prefix: the source list is api config, not routine state, so it must
// not refetch on every routine mutation.
export const ROUTINE_EVENT_SOURCES_QUERY_KEY = ['routine-event-sources'] as const;

export const ROUTINE_CONNECTOR_HEALTH_QUERY_KEY = ['routines', 'connector-health'] as const;

export const UNREAD_RUNS_ACTIVE_POLL_MS = 30_000;

// A scheduled run appears with no user action, so the feed must still discover the first `running` row.
export const UNREAD_RUNS_IDLE_POLL_MS = 300_000;

export const RUNS_DISCOVERY_POLL_MS = 5_000;

// `POST /routines/:id/run` returns a Temporal handle and the worker writes the run row afterwards, so
// the feed is still empty when the mutation settles and a manual run needs a fast-poll window.
export const RUNS_DISCOVERY_WINDOW_MS = 120_000;

let manualRunStartedAt = 0;

export const markManualRunStarted = (at: number = Date.now()): void => {
    manualRunStartedAt = at;
};

// The window is module state, so a test that starts a run would otherwise fast-poll every later test.
export const clearManualRunWindow = (): void => {
    manualRunStartedAt = 0;
};

export const isAwaitingManualRun = (now: number = Date.now()): boolean =>
    manualRunStartedAt > 0 && now - manualRunStartedAt < RUNS_DISCOVERY_WINDOW_MS;

export const unreadRunsPollInterval = (
    runs: readonly Pick<RoutineRunType, 'status'>[],
    now: number = Date.now(),
): number => {
    if (runs.some((run) => run.status === 'running')) return UNREAD_RUNS_ACTIVE_POLL_MS;
    if (isAwaitingManualRun(now)) return RUNS_DISCOVERY_POLL_MS;

    return UNREAD_RUNS_IDLE_POLL_MS;
};

export const RUNS_ACTIVE_POLL_MS = 15_000;

export const runsPollInterval = (
    runs: readonly Pick<RoutineRunType, 'status'>[],
    now: number = Date.now(),
): number | false => {
    if (runs.some((run) => run.status === 'running')) return RUNS_ACTIVE_POLL_MS;
    if (isAwaitingManualRun(now)) return RUNS_DISCOVERY_POLL_MS;

    return false;
};

// A run detail is fetched by a known id, so run discovery never applies: only the run's own status may poll it.
export const runDetailPollInterval = (run: Pick<RoutineRunType, 'status'> | undefined): number | false =>
    run?.status === 'running' ? RUNS_ACTIVE_POLL_MS : false;

export const ROUTINES_LIST_POLL_MS = 60_000;

interface RoutinePayloadFields {
    name: string;
    prompt: string;
    agentId: string;
    status?: RoutineStatus;
    modelId?: string | null;
    projectId?: string | null;
    emailOnRun?: boolean;
    /**
     * USER IDS, and NOT the `{ userId, user }` shape `routineSchema` reads back. Absent leaves a
     * stored list alone on update; absent or `[]` means the owner alone, since "nobody" is
     * `emailOnRun: false`. The api 400s by name for a recipient who cannot see the agent or Space.
     */
    recipients?: string[];
    /** Offers the run the deep-research tool; the ai side decides whether the turn calls it. */
    deepResearch?: boolean;
    icon?: string | null;
}

export interface RoutineTriggersPayload extends RoutinePayloadFields {
    triggers: RoutineTriggerInput[];
}

export interface RoutineListParams {
    search?: string;
    archived?: boolean;
    pinned?: boolean;
    /** A Space id: returns that Space's routines to every member, not only the caller's own. */
    projectId?: string;
    /** Honored server-side (probed live): a bogus id returns zero rows, so no client backstop is needed. */
    agentId?: string;
    /** Comma-separated values are accepted; empty behaves as no filter. */
    status?: 'active' | 'paused';
    /** `<field>:<asc|desc>`; pinned rows lead regardless, and omitting it keeps the api's default order. */
    sortBy?: string;
    page?: number;
    size?: number;
}

export interface RoutineRunListParams {
    unreadOnly?: boolean;
    /** A Space id: returns that Space's runs to every member, not only the caller's own. */
    projectId?: string;
    /** Only the runs that opened these conversations. The api 400s on anything that is not an id. */
    conversationIds?: readonly string[];
    page?: number;
    size?: number;
}

const parsePage = <T>(schema: z.ZodType<T>, page: PagedList<unknown>): PagedList<T> => ({
    values: page.values.flatMap((item) => {
        const parsed = schema.safeParse(item);

        return parsed.success ? [parsed.data] : [];
    }),
    pageInfo: page.pageInfo,
});

export const appRoutinesApi = {
    async get(id: string, config?: ApiRequestConfig): Promise<RoutineType> {
        const raw = await apiClient.get<unknown>(`/routines/${id}`, config);

        return routineSchema.parse(raw);
    },

    async list(params: RoutineListParams = {}, config?: ApiRequestConfig): Promise<PagedList<RoutineType>> {
        const raw = await apiClient.get<RawPagedList<unknown>>('/routines', { ...config, params });

        return parsePage(routineSchema, mapPagedList(raw));
    },

    async create(data: RoutineTriggersPayload, config?: ApiRequestConfig): Promise<RoutineType> {
        const raw = await apiClient.post<unknown>('/routines', data, config);

        return routineSchema.parse(raw);
    },

    async update(id: string, data: Partial<RoutineTriggersPayload>, config?: ApiRequestConfig): Promise<RoutineType> {
        const raw = await apiClient.put<unknown>(`/routines/${id}`, data, config);

        return routineSchema.parse(raw);
    },

    async delete(id: string, config?: ApiRequestConfig): Promise<RoutineType> {
        return apiClient.delete<RoutineType>(`/routines/${id}`, config);
    },

    async runNow(id: string, config?: ApiRequestConfig): Promise<unknown> {
        return apiClient.post<unknown>(`/routines/${id}/run`, undefined, config);
    },

    /**
     * `agentId` must be the ObjectId: the endpoint rejects an agent slug with a 400, and every routines
     * route carries a slug, so a caller that forwards the route param gets a validation error.
     * A row that does not parse is dropped rather than failing the list, the way run steps are.
     */
    async getConnectorHealth(agentId: string, config?: ApiRequestConfig): Promise<RoutineConnector[]> {
        const raw = await apiClient.get<{ connectors?: unknown }>('/routines/connector-health', {
            ...config,
            params: { agentId },
        });
        const rows = Array.isArray(raw?.connectors) ? raw.connectors : [];

        return rows.flatMap((row) => {
            const parsed = routineConnectorSchema.safeParse(row);

            return parsed.success ? [parsed.data] : [];
        });
    },

    async pause(id: string, config?: ApiRequestConfig): Promise<RoutineType> {
        return apiClient.post<RoutineType>(`/routines/${id}/pause`, undefined, config);
    },

    async resume(id: string, config?: ApiRequestConfig): Promise<RoutineType> {
        return apiClient.post<RoutineType>(`/routines/${id}/resume`, undefined, config);
    },

    async pin(id: string, config?: ApiRequestConfig): Promise<RoutineType> {
        return apiClient.put<RoutineType>(`/routines/${id}/pin`, undefined, config);
    },

    async archive(id: string, config?: ApiRequestConfig): Promise<RoutineType> {
        return apiClient.post<RoutineType>(`/routines/${id}/archive`, undefined, config);
    },

    async unarchive(id: string, config?: ApiRequestConfig): Promise<RoutineType> {
        return apiClient.post<RoutineType>(`/routines/${id}/unarchive`, undefined, config);
    },

    async listRuns(
        routineId: string,
        params: { page?: number; size?: number; status?: readonly RoutineRunStatus[] } = {},
        config?: ApiRequestConfig,
    ): Promise<PagedList<RoutineRunType>> {
        const { status, ...rest } = params;
        // `?status=a,b` is the api's own multi-value form; an empty set is an absent param, not "match nothing".
        const query = { ...rest, ...(status?.length ? { status: status.join(',') } : {}) };
        const raw = await apiClient.get<RawPagedList<unknown>>(`/routines/${routineId}/runs`, {
            ...config,
            params: query,
        });

        return parsePage(routineRunSchema, mapPagedList(raw));
    },

    async getRun(routineId: string, runId: string, config?: ApiRequestConfig): Promise<RoutineRunDetailType> {
        const raw = await apiClient.get<{ steps?: unknown }>(`/routines/${routineId}/runs/${runId}`, config);
        const rawSteps = Array.isArray(raw?.steps) ? raw.steps : [];

        const steps = rawSteps.flatMap((item) => {
            const parsed = routineRunStepSchema.safeParse(item);

            return parsed.success ? [parsed.data] : [];
        });

        return { ...routineRunSchema.parse(raw), steps };
    },

    async listTriggers(routineId: string, config?: ApiRequestConfig): Promise<RoutineTriggerRecord[]> {
        const raw = await apiClient.get<{ values?: unknown }>(`/routines/${routineId}/triggers`, config);

        return (Array.isArray(raw?.values) ? raw.values : []).flatMap((item) => {
            const parsed = routineTriggerSchema.safeParse(item);

            return parsed.success ? [parsed.data] : [];
        });
    },

    async createTrigger(
        routineId: string,
        trigger: RoutineTriggerInput,
        config?: ApiRequestConfig,
    ): Promise<RoutineTriggerRecord> {
        const body = { trigger: routineTriggerInputSchema.parse(trigger) };
        const raw = await apiClient.post<unknown>(`/routines/${routineId}/triggers`, body, config);

        return routineTriggerSchema.parse(raw);
    },

    async updateTrigger(
        routineId: string,
        triggerId: string,
        trigger: RoutineTriggerInput,
        config?: ApiRequestConfig,
    ): Promise<RoutineTriggerRecord> {
        const body = { trigger: routineTriggerInputSchema.parse(trigger) };
        const raw = await apiClient.put<unknown>(`/routines/${routineId}/triggers/${triggerId}`, body, config);

        return routineTriggerSchema.parse(raw);
    },

    async deleteTrigger(
        routineId: string,
        triggerId: string,
        config?: ApiRequestConfig,
    ): Promise<{ _id: string; isDeleted: boolean }> {
        return apiClient.delete<{ _id: string; isDeleted: boolean }>(
            `/routines/${routineId}/triggers/${triggerId}`,
            config,
        );
    },

    async fireTrigger(
        routineId: string,
        triggerId: string,
        payload?: Record<string, unknown> | null,
        config?: ApiRequestConfig,
    ): Promise<unknown> {
        return apiClient.post<unknown>(
            `/routines/${routineId}/triggers/${triggerId}/fire`,
            payload === undefined ? {} : { payload },
            config,
        );
    },

    async listAllRuns(
        params: RoutineRunListParams = {},
        config?: ApiRequestConfig,
    ): Promise<PagedList<RoutineRunType>> {
        const { conversationIds, ...rest } = params;
        // Axios would serialize an array as `conversationIds[]=`, which the api does not read.
        const query = conversationIds?.length ? { ...rest, conversationIds: conversationIds.join(',') } : rest;
        const raw = await apiClient.get<RawPagedList<unknown>>('/routines/runs', { ...config, params: query });

        return parsePage(routineRunSchema, mapPagedList(raw));
    },

    // `/routines/event-sources` answers `{ success, sources }` with no `value`, so `apiClient` cannot unwrap
    // it — which also means its `success` flag has to be checked here, or a soft failure would read as an
    // empty source list and quietly drop the event trigger type.
    async listEventSources(config?: ApiRequestConfig): Promise<RoutineEventSource[]> {
        const response = await uiAxios.get<{ success?: boolean; message?: string; sources?: unknown }>(
            '/routines/event-sources',
            config,
        );

        if (response.data?.success === false) {
            throw new Error(response.data.message ?? 'Event sources could not be loaded');
        }

        const raw = response.data?.sources;

        return (Array.isArray(raw) ? raw : []).flatMap((item) => {
            const parsed = routineEventSourceSchema.safeParse(item);

            return parsed.success ? [parsed.data] : [];
        });
    },

    async markRunsRead(runIds?: string[], config?: ApiRequestConfig): Promise<{ marked: number }> {
        return apiClient.put<{ marked: number }>('/routines/runs/read', runIds?.length ? { runIds } : {}, config);
    },
};

export const invalidateRoutinesQueries = (queryClient: QueryClient): void => {
    void queryClient.invalidateQueries({ queryKey: ['routines'] });
};

export function useRoutinesQuery(params: RoutineListParams = {}, options: { poll?: boolean } = {}) {
    const poll = options.poll ?? true;

    return useQuery({
        queryKey: [...ROUTINES_LIST_QUERY_KEY, params],
        queryFn: ({ signal }) => appRoutinesApi.list(params, { signal }),
        placeholderData: keepPreviousData,
        refetchInterval: poll ? ROUTINES_LIST_POLL_MS : false,
        refetchOnWindowFocus: poll,
    });
}

// No retry and no poll: a 404 or 403 here is the answer, not a hiccup, and the page has to say so.
export function useRoutineQuery(routineId: string | null | undefined) {
    return useQuery({
        queryKey: [...ROUTINE_QUERY_KEY, routineId],
        queryFn: ({ signal }) => appRoutinesApi.get(routineId as string, { signal }),
        enabled: Boolean(routineId),
        retry: false,
    });
}

export const ROUTINES_PAGE_SIZE = 20;

export function useRoutinesInfiniteQuery(params: Omit<RoutineListParams, 'page'> = {}) {
    const size = params.size ?? ROUTINES_PAGE_SIZE;

    return useInfiniteQuery({
        queryKey: [...ROUTINES_LIST_QUERY_KEY, 'infinite', { ...params, size }],
        queryFn: ({ pageParam, signal }) => appRoutinesApi.list({ ...params, page: pageParam, size }, { signal }),
        initialPageParam: 0,
        getNextPageParam: (lastPage) => {
            const { page, totalPages } = lastPage.pageInfo;

            return totalPages - page > 1 ? page + 1 : undefined;
        },
        placeholderData: keepPreviousData,
        // An infinite query refetches every loaded page per tick, so polling stops once more than one page is loaded.
        refetchInterval: (query) => ((query.state.data?.pages.length ?? 0) > 1 ? false : ROUTINES_LIST_POLL_MS),
        refetchOnWindowFocus: true,
    });
}

export function useRoutineRunsQuery(routineId: string | null, params: { page?: number; size?: number } = {}) {
    return useQuery({
        queryKey: [...ROUTINE_RUNS_QUERY_KEY, routineId, params],
        queryFn: ({ signal }) => appRoutinesApi.listRuns(routineId as string, params, { signal }),
        enabled: Boolean(routineId),
        refetchInterval: (query) => runsPollInterval(query.state.data?.values ?? []),
        refetchOnWindowFocus: true,
    });
}

export const ROUTINE_RUNS_PAGE_SIZE = 20;

export function useRoutineRunsInfiniteQuery(
    routineId: string | null,
    params: { size?: number; status?: readonly RoutineRunStatus[] } = {},
) {
    const size = params.size ?? ROUTINE_RUNS_PAGE_SIZE;
    const status = params.status?.length ? params.status : undefined;
    // The joined form, not the array: a fresh array literal per render would key every filter alike.
    const statusKey = status?.join(',');

    return useInfiniteQuery({
        queryKey: [...ROUTINE_RUNS_QUERY_KEY, routineId, 'infinite', { size, ...(statusKey ? { statusKey } : {}) }],
        queryFn: ({ pageParam, signal }) =>
            appRoutinesApi.listRuns(
                routineId as string,
                { page: pageParam, size, ...(status ? { status } : {}) },
                { signal },
            ),
        initialPageParam: 0,
        getNextPageParam: (lastPage) => {
            const { page, totalPages } = lastPage.pageInfo;

            return totalPages - page > 1 ? page + 1 : undefined;
        },
        enabled: Boolean(routineId),
        placeholderData: keepPreviousData,
        // A status filter hides running rows, so runsPollInterval would go silent exactly while a run settles — filtered lists poll flat.
        refetchInterval: (query) =>
            status
                ? RUNS_ACTIVE_POLL_MS
                : runsPollInterval((query.state.data?.pages ?? []).flatMap((page) => page.values)),
        refetchOnWindowFocus: true,
    });
}

export function useRoutineRunQuery(
    routineId: string | null,
    runId: string | null,
    options: { enabled?: boolean } = {},
) {
    return useQuery({
        queryKey: [...ROUTINE_RUN_QUERY_KEY, routineId, runId],
        queryFn: ({ signal }) => appRoutinesApi.getRun(routineId as string, runId as string, { signal }),
        enabled: (options.enabled ?? true) && Boolean(routineId && runId),
        refetchInterval: (query) => runDetailPollInterval(query.state.data),
        refetchOnWindowFocus: true,
        retry: false,
    });
}

export function useRoutineTriggersQuery(routineId: string | null) {
    return useQuery({
        queryKey: [...ROUTINE_TRIGGERS_QUERY_KEY, routineId],
        queryFn: ({ signal }) => appRoutinesApi.listTriggers(routineId as string, { signal }),
        enabled: Boolean(routineId),
    });
}

export function useAllRoutineRunsQuery(
    params: RoutineRunListParams = { size: 100 },
    options: { enabled?: boolean } = {},
) {
    return useQuery({
        queryKey: [...ROUTINE_RUNS_QUERY_KEY, 'all', params],
        queryFn: ({ signal }) => appRoutinesApi.listAllRuns(params, { signal }),
        placeholderData: keepPreviousData,
        refetchInterval: (query) => runsPollInterval(query.state.data?.values ?? []),
        refetchOnWindowFocus: true,
        enabled: options.enabled ?? true,
    });
}

/**
 * Read, never re-derived. The chat surfaces' own rule counts a lapsed token as broken; the backend
 * deliberately does not, because that state repairs itself inside the turn - so deriving it here would
 * warn falsely for about an hour after every ordinary token refresh.
 */
export function useRoutineConnectorHealthQuery(agentId: string | null, options: { enabled?: boolean } = {}) {
    return useQuery({
        queryKey: [...ROUTINE_CONNECTOR_HEALTH_QUERY_KEY, agentId],
        queryFn: ({ signal }) => appRoutinesApi.getConnectorHealth(agentId as string, { signal }),
        enabled: Boolean(agentId) && (options.enabled ?? true),
        /**
         * `always`, not the default true: the fix for the very thing this warns about happens in
         * ANOTHER TAB, whose `invalidateConnectorSurfaces` cannot reach this tab's QueryClient. A
         * merely-true refetch is skipped while the row is still fresh, so coming back from a
         * completed reconnect would keep the warning up - or, the other way, keep saying all clear
         * after a disconnect.
         */
        refetchOnWindowFocus: 'always',
        // A 404 is an agent the caller cannot use, and a 400 is a bad id: neither is worth a retry.
        retry: false,
    });
}

export function useRoutineEventSourcesQuery(options: { enabled?: boolean } = {}) {
    return useQuery({
        queryKey: ROUTINE_EVENT_SOURCES_QUERY_KEY,
        queryFn: ({ signal }) => appRoutinesApi.listEventSources({ signal }),
        staleTime: 5 * 60_000,
        enabled: options.enabled ?? true,
    });
}

export function useUnreadRoutineRunsQuery(options: { enabled?: boolean } = {}) {
    return useQuery({
        queryKey: [...ROUTINE_RUNS_QUERY_KEY, 'unread'],
        queryFn: ({ signal }) => appRoutinesApi.listAllRuns({ unreadOnly: true, size: 50 }, { signal }),
        refetchInterval: (query) => unreadRunsPollInterval(query.state.data?.values ?? []),
        refetchOnWindowFocus: true,
        enabled: options.enabled !== false,
    });
}

export function useCreateRoutineMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: RoutineTriggersPayload) => appRoutinesApi.create(data),
        onSuccess: () => invalidateRoutinesQueries(queryClient),
    });
}

export function useUpdateRoutineMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<RoutineTriggersPayload> }) =>
            appRoutinesApi.update(id, data),
        onSuccess: () => invalidateRoutinesQueries(queryClient),
    });
}

export function useDeleteRoutineMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => appRoutinesApi.delete(id),
        onSuccess: () => invalidateRoutinesQueries(queryClient),
    });
}

export function useRunRoutineNowMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => appRoutinesApi.runNow(id),
        onSuccess: () => {
            markManualRunStarted();
            invalidateRoutinesQueries(queryClient);
        },
    });
}

export function usePauseRoutineMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => appRoutinesApi.pause(id),
        onSuccess: () => invalidateRoutinesQueries(queryClient),
    });
}

export function useResumeRoutineMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => appRoutinesApi.resume(id),
        onSuccess: () => invalidateRoutinesQueries(queryClient),
    });
}

export function usePinRoutineMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => appRoutinesApi.pin(id),
        onSuccess: () => invalidateRoutinesQueries(queryClient),
    });
}

export function useArchiveRoutineMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => appRoutinesApi.archive(id),
        onSuccess: () => invalidateRoutinesQueries(queryClient),
    });
}

export function useUnarchiveRoutineMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => appRoutinesApi.unarchive(id),
        onSuccess: () => invalidateRoutinesQueries(queryClient),
    });
}

export function useCreateRoutineTriggerMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ routineId, trigger }: { routineId: string; trigger: RoutineTriggerInput }) =>
            appRoutinesApi.createTrigger(routineId, trigger),
        onSuccess: () => invalidateRoutinesQueries(queryClient),
    });
}

export function useUpdateRoutineTriggerMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            routineId,
            triggerId,
            trigger,
        }: {
            routineId: string;
            triggerId: string;
            trigger: RoutineTriggerInput;
        }) => appRoutinesApi.updateTrigger(routineId, triggerId, trigger),
        onSuccess: () => invalidateRoutinesQueries(queryClient),
    });
}

export function useDeleteRoutineTriggerMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ routineId, triggerId }: { routineId: string; triggerId: string }) =>
            appRoutinesApi.deleteTrigger(routineId, triggerId),
        onSuccess: () => invalidateRoutinesQueries(queryClient),
    });
}

export function useFireRoutineTriggerMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            routineId,
            triggerId,
            payload,
        }: {
            routineId: string;
            triggerId: string;
            payload?: Record<string, unknown> | null;
        }) => appRoutinesApi.fireTrigger(routineId, triggerId, payload),
        onSuccess: () => {
            markManualRunStarted();
            invalidateRoutinesQueries(queryClient);
        },
    });
}

export function useMarkRoutineRunsReadMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (runIds?: string[]) => appRoutinesApi.markRunsRead(runIds),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ROUTINE_RUNS_QUERY_KEY });
        },
        onError: (error) => {
            showErrorToast(getApiErrorMessage(error, 'Could not update notifications.'));
        },
    });
}
