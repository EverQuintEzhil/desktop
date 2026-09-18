import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { mcpServersApi } from '@/lib/api';
import type { McpServer, McpToolPreference } from '@/lib/api';
import { CONNECTED_CONNECTORS_QUERY_KEY, NOT_CONNECTED_CONNECTORS_QUERY_KEY } from '@/lib/api/common/mcp-servers';
import type { PageInfo, PagedList } from '@/types/api-types';

const PAGE_SIZE = 20;

const CONNECTED_PAGE_SIZE = 100;
const CONNECTED_MAX_PAGES = 100;

const hasPageAfter = ({ page, totalPages }: PageInfo) => totalPages - page > 1;

export type ToolPermission = 'always_allow' | 'needs_approval' | 'blocked';

export interface ToolUpdate {
    name: string;
    permission: ToolPermission;
}

const toolPreferencesKey = (serverId: string) => ['connectors', 'tool-preferences', serverId];

const PERMISSION_TO_FLAGS: Record<ToolPermission, { needsApproval: boolean; disabled: boolean }> = {
    always_allow: { needsApproval: false, disabled: false },
    needs_approval: { needsApproval: true, disabled: false },
    blocked: { needsApproval: false, disabled: true },
};

export const useNotConnectedConnectorsQuery = (search: string) =>
    useInfiniteQuery({
        queryKey: [...NOT_CONNECTED_CONNECTORS_QUERY_KEY, search],
        queryFn: ({ pageParam = 0, signal }) =>
            mcpServersApi.list(
                {
                    search: search || undefined,
                    size: PAGE_SIZE,
                    page: pageParam as number,
                    connected: 'false',
                },
                { signal },
            ),
        initialPageParam: 0,
        getNextPageParam: (lastPage) => (hasPageAfter(lastPage.pageInfo) ? lastPage.pageInfo.page + 1 : undefined),
    });

const fetchAllConnected = async (search: string, signal: AbortSignal): Promise<PagedList<McpServer>> => {
    const first = await mcpServersApi.list(
        {
            search: search || undefined,
            size: CONNECTED_PAGE_SIZE,
            page: 0,
            connected: 'true',
        },
        { signal },
    );
    const values = [...first.values];
    let totalPages = first.pageInfo.totalPages;

    for (let page = 1; page < CONNECTED_MAX_PAGES && page < totalPages; page += 1) {
        const next = await mcpServersApi.list(
            {
                search: search || undefined,
                size: CONNECTED_PAGE_SIZE,
                page,
                connected: 'true',
            },
            { signal },
        );

        values.push(...next.values);
        totalPages = next.pageInfo.totalPages;
    }

    return { values, pageInfo: { page: 0, totalPages: 1, totalCount: first.pageInfo.totalCount } };
};

export const useConnectedConnectorsQuery = (search: string) =>
    useQuery({
        queryKey: [...CONNECTED_CONNECTORS_QUERY_KEY, search],
        queryFn: ({ signal }) => fetchAllConnected(search, signal),
    });

const PENDING_POLL_INTERVAL_MS = 4_000;

export const useConnectorDetailQuery = (connectorId: string | undefined) =>
    useQuery({
        queryKey: ['connectors', 'detail', connectorId],
        queryFn: () => mcpServersApi.getById(connectorId as string),
        enabled: !!connectorId,
        // This payload carries live `connection` state, so never serve it stale — returning to
        // the page after starting an OAuth handshake must reflect the pending connection.
        staleTime: 0,
        // Poll while a connection is mid-handshake so the pane flips pending → connected on
        // its own — the detail payload carries `connection`, so no separate connections query.
        refetchInterval: (query) =>
            query.state.data?.connection?.status === 'pending' ? PENDING_POLL_INTERVAL_MS : false,
    });

export const useConnectorToolsQuery = (serverId: string, enabled: boolean) =>
    useQuery({
        queryKey: ['connectors', 'tools', serverId],
        queryFn: () => mcpServersApi.getTools(serverId),
        enabled,
        retry: false,
        staleTime: 5 * 60 * 1000,
    });

export const useToolPreferencesQuery = (serverId: string, enabled: boolean) =>
    useQuery({
        queryKey: toolPreferencesKey(serverId),
        queryFn: () => mcpServersApi.getToolPreferences(serverId, 'user'),
        enabled,
        retry: false,
        staleTime: 5 * 60 * 1000,
    });

export const useUpdateToolPreferencesMutation = (serverId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (updates: ToolUpdate[]) =>
            Promise.all(
                updates.map((update) =>
                    mcpServersApi.putToolsPreferences(serverId, {
                        name: update.name,
                        ...PERMISSION_TO_FLAGS[update.permission],
                        hasUserPreferences: true,
                        preferenceLevel: 'user',
                    }),
                ),
            ),
        onMutate: async (updates) => {
            await queryClient.cancelQueries({ queryKey: toolPreferencesKey(serverId) });
            const previous = queryClient.getQueryData<McpToolPreference[]>(toolPreferencesKey(serverId));

            queryClient.setQueryData<McpToolPreference[]>(toolPreferencesKey(serverId), (old) => {
                const next = [...(old ?? [])];

                updates.forEach((update) => {
                    const index = next.findIndex((row) => row.toolName === update.name);
                    const merged: McpToolPreference = {
                        ...(index >= 0 ? next[index] : {}),
                        toolName: update.name,
                        ...PERMISSION_TO_FLAGS[update.permission],
                        hasUserPreferences: true,
                    };

                    if (index >= 0) {
                        next[index] = merged;
                    } else {
                        next.push(merged);
                    }
                });

                return next;
            });

            return { previous };
        },
        onError: (_error, _updates, context) => {
            queryClient.setQueryData(toolPreferencesKey(serverId), context?.previous);
            toast.error("Couldn't update tool permissions. Please try again.");
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: toolPreferencesKey(serverId) });
        },
    });
};
