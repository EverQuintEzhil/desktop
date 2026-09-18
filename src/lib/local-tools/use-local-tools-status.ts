import { useQuery } from '@tanstack/react-query';

import { isDesktopRuntime, listLocalTools } from './bridge';

export type LocalToolsStatus =
    | { state: 'unsupported' }
    | { state: 'no-folder' }
    | { state: 'loading' }
    | { state: 'error'; message: string }
    | { state: 'active'; count: number; root: string };

/**
 * Attach-state of the local coding tools for the active space. Shares the
 * toolkit's manifest query (same key + options), so it adds zero bridge calls.
 * Exists for one failure mode: the agent's system prompt describes the tools,
 * but they are not attached to this chat — the model then "knows" tools it
 * cannot call and misfires on server-side ones. That state must be visible
 * on screen, not only in devtools.
 */
export const useLocalToolsStatus = (folderPath: string | null | undefined): LocalToolsStatus => {
    const desktop = isDesktopRuntime();
    const trimmedFolder = folderPath?.trim() ?? '';
    const enabled = desktop && trimmedFolder.length > 0;

    const { data, error } = useQuery({
        queryKey: ['local-tools', 'manifest'],
        queryFn: listLocalTools,
        enabled,
        staleTime: Infinity,
        retry: 1,
    });

    if (!desktop) {
        return { state: 'unsupported' };
    }

    if (!trimmedFolder) {
        return { state: 'no-folder' };
    }

    if (error) {
        return { state: 'error', message: error instanceof Error ? error.message : String(error) };
    }

    if (!data) {
        return { state: 'loading' };
    }

    // +1: the `terminal` tool rides alongside the agent-core manifest.
    return { state: 'active', count: data.length + 1, root: trimmedFolder };
};
