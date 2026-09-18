import { useQueryClient } from '@tanstack/react-query';

import { showErrorToast } from '@/utils';

export const useConnectorDetailMutations = (connectorId: string | undefined) => {
    const queryClient = useQueryClient();

    const handleRefreshTools = async () => {
        if (!connectorId) {
            return;
        }

        try {
            await Promise.all([
                queryClient.refetchQueries({ queryKey: ['connectors', 'tools', connectorId] }),
                queryClient.refetchQueries({ queryKey: ['connectors', 'tool-preferences', connectorId] }),
            ]);

            const toolsState = queryClient.getQueryState(['connectors', 'tools', connectorId]);

            if (toolsState?.status === 'error') {
                throw toolsState.error;
            }
        } catch (error: unknown) {
            showErrorToast(error instanceof Error ? error.message : "Couldn't refresh the tools list.");
        }
    };

    const handleRetryLoad = async () => {
        if (!connectorId) {
            return;
        }

        await queryClient.refetchQueries({ queryKey: ['connectors', 'detail', connectorId] });
    };

    return { handleRefreshTools, handleRetryLoad };
};
