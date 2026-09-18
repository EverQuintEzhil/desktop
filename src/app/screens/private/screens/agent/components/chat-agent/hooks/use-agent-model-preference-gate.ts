import { useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import {
    agentModelPreferenceQueryOptions,
    useAgentModelPreferenceSettled,
} from '@/components/agent-chat/hooks/use-agent-model-preference';

/**
 * Holds the screen on its loading skeleton until the per-user model preference
 * the composer reads has settled, so the composer's first paint already carries
 * the stored model instead of flipping off the agent default.
 *
 * The warm-up is fired during render, not in an effect: the composer paints in
 * the same commit as this screen, so the render phase is the earliest the
 * request can leave. `prefetchQuery` never rejects, so a failure here costs
 * nothing; the composer's own query still owns error handling. Both this and
 * the composer share `agentModelPreferenceQueryOptions`, whose `staleTime`
 * keeps the pair to a single request.
 */
export const useAgentModelPreferenceGate = (agentId: string): boolean => {
    const queryClient = useQueryClient();
    const prefetchedAgentIdRef = useRef<string | null>(null);

    if (prefetchedAgentIdRef.current !== agentId) {
        prefetchedAgentIdRef.current = agentId;
        if (agentId) void queryClient.prefetchQuery(agentModelPreferenceQueryOptions(agentId));
    }

    return useAgentModelPreferenceSettled(agentId);
};
