import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { mcpServersApi } from '@/lib/api';
import type { McpServer, McpServerPreference } from '@/lib/api';
import { invalidateConnectorSurfaces } from '@/lib/api/common/mcp-servers';

import { isConnectorEnabled } from '../utils/is-connector-enabled';

const connectorDetailKey = (serverId: string | undefined) => ['connectors', 'detail', serverId];

export const useConnectorEnablement = (
    serverId: string | undefined,
    _enabled: boolean,
    server?: Pick<McpServer, 'preference' | 'globalEnabled'> | null,
): { isEnabled: boolean; toggle: () => void; isPending: boolean; isEnablementLoading: boolean } => {
    const queryClient = useQueryClient();

    // The detail endpoint returns the global `preference` row, while list-sourced
    // servers (e.g. the builder reconnect modal) only carry the computed
    // `globalEnabled` flag — fall back to it so both surfaces stay accurate.
    const isEnabled = isConnectorEnabled(server);

    const mutation = useMutation({
        mutationFn: (nextDisabled: boolean) => mcpServersApi.putServerPreference(serverId as string, nextDisabled),
        onMutate: async (nextDisabled) => {
            await queryClient.cancelQueries({ queryKey: connectorDetailKey(serverId) });
            const previous = queryClient.getQueryData<McpServer>(connectorDetailKey(serverId));

            queryClient.setQueryData<McpServer>(connectorDetailKey(serverId), (old) =>
                old
                    ? {
                          ...old,
                          preference: {
                              ...(old.preference ?? {}),
                              mcpServerId: serverId as string,
                              disabled: nextDisabled,
                          } as McpServerPreference,
                      }
                    : old,
            );

            return { previous };
        },
        onError: (_error, _nextDisabled, context) => {
            queryClient.setQueryData(connectorDetailKey(serverId), context?.previous);
            toast.error("Couldn't update connector. Please try again.");
        },
        onSettled: () => {
            invalidateConnectorSurfaces(queryClient);
        },
    });

    const toggle = () => mutation.mutate(isEnabled);

    return {
        isEnabled,
        toggle,
        isPending: mutation.isPending,
        isEnablementLoading: false,
    };
};
