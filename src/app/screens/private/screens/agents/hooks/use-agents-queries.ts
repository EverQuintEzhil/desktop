import { keepPreviousData, useInfiniteQuery, useQuery, type QueryClient } from '@tanstack/react-query';

import { appAgentsApi } from '@/lib/api/app/agents';
import type { AgentType, LauncherType, TagType } from '@/types/admin';

import { listMyAgents, mapAgentToLauncher } from '../../create-agent/lib/create-agent-api';
import { AGENT_PIN_LIMIT } from '../agent-layout';

const PAGE_SIZE = 20;

/** A pin set can never exceed the cap, so one page always covers it and the by-ids hooks below never paginate. */
const PINNED_LOOKUP_SIZE = AGENT_PIN_LIMIT;

/**
 * The pin set is the only thing that changes this lookup's answer, so a focus refetch re-requests
 * records already on screen — and on failure re-mints the `Error` the consumer keys its warning on.
 */
const PINNED_LOOKUP_REFETCH_ON_FOCUS = false;

/** Sorted so reordering pins is a cache hit rather than a refetch: the resolved set is order-independent. */
export const idsCacheKey = (ids: string[]): string[] => [...ids].sort();

export const MY_AGENTS_QUERY_KEY = ['my-agents'] as const;
export const MY_AGENTS_BY_IDS_QUERY_KEY = ['my-agents-by-ids'] as const;
/** Second segment kept so the prefix cannot also match `['agents', 'filter-options', …]`. */
export const AGENT_LAUNCHERS_QUERY_KEY = ['agents', 'list'] as const;
export const LAUNCHERS_BY_IDS_QUERY_KEY = ['launchers-by-ids'] as const;

export const useAgentTagsQuery = () =>
    useQuery({
        queryKey: ['agentTags'],
        queryFn: () => appAgentsApi.listTags<TagType>(),
        staleTime: 5 * 60_000,
    });

export const useAgentLaunchersQuery = (search: string, category: string | null | undefined, enabled: boolean) =>
    useInfiniteQuery({
        queryKey: [...AGENT_LAUNCHERS_QUERY_KEY, search, category],
        queryFn: ({ pageParam = 0, signal }) =>
            appAgentsApi.listLaunchers<LauncherType>(
                {
                    search: search || undefined,
                    tags: category || undefined,
                    size: PAGE_SIZE,
                    page: pageParam as number,
                },
                { signal },
            ),
        initialPageParam: 0,
        enabled,
        getNextPageParam: (lastPage) => {
            const { page, totalPages } = lastPage.pageInfo;

            return totalPages - page > 1 ? page + 1 : undefined;
        },
    });

/**
 * Resolves a known set of launcher ids in one request, so a firmwide pin whose record sits on a page
 * the grid has not fetched still gets a tile. Deliberately not part of the grid's paginated queries.
 *
 * Pinning or unpinning changes the id set, so it mints a cache entry with no data yet. The previous
 * records are retained across that key change: without them a tile only this read can resolve would
 * blank for the whole in-flight window, and permanently if the new request fails. The consumer
 * indexes the result by id and renders only currently-pinned ids, so a record left over from the
 * previous set cannot produce a tile of its own.
 */
export const useLaunchersByIdsQuery = (ids: string[], enabled: boolean) =>
    useQuery({
        queryKey: [...LAUNCHERS_BY_IDS_QUERY_KEY, idsCacheKey(ids)],
        queryFn: async ({ signal }) => {
            const page = await appAgentsApi.listLaunchers<LauncherType>({ ids, size: PINNED_LOOKUP_SIZE }, { signal });

            return page.values;
        },
        enabled: enabled && ids.length > 0,
        placeholderData: keepPreviousData,
        refetchOnWindowFocus: PINNED_LOOKUP_REFETCH_ON_FOCUS,
    });

/** The `my` tab's counterpart: its pins are agent ids, mapped through the same launcher shape the list uses. */
export const useMyAgentsByIdsQuery = (userId: string | null | undefined, ids: string[], enabled: boolean) =>
    useQuery({
        queryKey: [...MY_AGENTS_BY_IDS_QUERY_KEY, userId, idsCacheKey(ids)],
        queryFn: async ({ signal }) => {
            const page = await appAgentsApi.listAgents<AgentType>(
                { ids, size: PINNED_LOOKUP_SIZE, mineOnly: true },
                { signal },
            );

            return page.values.map(mapAgentToLauncher);
        },
        enabled: enabled && ids.length > 0,
        placeholderData: keepPreviousData,
        refetchOnWindowFocus: PINNED_LOOKUP_REFETCH_ON_FOCUS,
    });

export const useMyAgentsQuery = (userId: string | null | undefined, enabled: boolean, search = '', sortBy = '') =>
    useInfiniteQuery({
        queryKey: [...MY_AGENTS_QUERY_KEY, userId, search, sortBy],
        queryFn: ({ pageParam = 0 }) => listMyAgents(userId!, pageParam as number, search, sortBy),
        initialPageParam: 0,
        enabled,
        // Re-sorting mints a new key: without the previous pages the grid empties, which unmounts the
        // hand-ordered pinned row and re-fires the by-ids pin lookup for a set page 0 already carried.
        placeholderData: keepPreviousData,
        getNextPageParam: (lastPage) => {
            const { page, totalPages } = lastPage.pageInfo;

            return totalPages - page > 1 ? page + 1 : undefined;
        },
    });

/**
 * Every cache that can put a tile on the home screen for an agent or its launcher. Publishing or
 * deleting a launcher changes what the grid should show, and the app's 30s default `staleTime` is
 * long enough for a navigation straight back to `/` to render the stale set.
 */
export const invalidateAgentTiles = (queryClient: QueryClient) =>
    Promise.all(
        [MY_AGENTS_QUERY_KEY, MY_AGENTS_BY_IDS_QUERY_KEY, AGENT_LAUNCHERS_QUERY_KEY, LAUNCHERS_BY_IDS_QUERY_KEY].map(
            (queryKey) => queryClient.invalidateQueries({ queryKey }),
        ),
    );
