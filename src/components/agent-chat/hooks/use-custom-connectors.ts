import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { mcpServersApi } from '@/lib/api';

import type { ConnectorSource } from './use-connectors';

const CUSTOM_CONNECTORS_PAGE_SIZE = 100;

// The user's own connectors, scoped server-side via `createdByMe`. Kept only when
// enabled at the global (settings) level; `agentEnabled` carries the per-agent
// toggle state for the composer.
export const useCustomConnectors = (enabled: boolean, agentId: string | null | undefined): ConnectorSource[] => {
    const { data } = useQuery({
        queryKey: ['connectors', 'custom', agentId ?? 'none'],
        queryFn: () =>
            mcpServersApi.list({ createdByMe: true, agentId: agentId ?? undefined, size: CUSTOM_CONNECTORS_PAGE_SIZE }),
        enabled: enabled && !!agentId,
        staleTime: 5 * 60 * 1000,
    });

    return useMemo(
        () =>
            (data?.values ?? [])
                .filter((server) => server.globalEnabled === true)
                .map((server) => ({
                    _id: server._id,
                    name: server.name,
                    description: server.description ?? undefined,
                    authType: server.authType,
                    status: server.status,
                    preference: server.preference ?? null,
                    agentEnabled: server.agentEnabled ?? null,
                    connection: server.connection ?? null,
                    serverUrl: server.serverUrl,
                })),
        [data],
    );
};
