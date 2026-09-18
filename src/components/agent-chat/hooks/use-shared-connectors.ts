import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useOptionalChatHost } from '@/components/chat-host';
import { mcpServersApi } from '@/lib/api';

import type { ConnectorSource } from './use-connectors';

const SHARED_CONNECTORS_PAGE_SIZE = 100;

// Shared connectors = connectors the user is entitled to but did not create. The
// list endpoint returns the full entitled set; we keep those created by someone
// else that are enabled at the global (settings) level. `agentEnabled` carries
// the per-agent toggle state for the composer.
export const useSharedConnectors = (
    enabled: boolean,
    agentId: string | null | undefined,
    // Hosts without a ChatHostProvider (the routines dialogs) supply the viewer themselves.
    viewerUserId?: string | null,
): ConnectorSource[] => {
    const host = useOptionalChatHost();
    const currentUserId = viewerUserId ?? host?.session.user?.id ?? null;

    const { data } = useQuery({
        queryKey: ['connectors', 'shared', agentId ?? 'none'],
        queryFn: () => mcpServersApi.list({ agentId: agentId ?? undefined, size: SHARED_CONNECTORS_PAGE_SIZE }),
        enabled: enabled && !!agentId,
        staleTime: 5 * 60 * 1000,
    });

    return useMemo(() => {
        if (!currentUserId) {
            return [];
        }

        return (data?.values ?? [])
            .filter((server) => server.globalEnabled === true && server.creator?._id !== currentUserId)
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
            }));
    }, [data, currentUserId]);
};
