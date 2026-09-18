import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { useConnectors } from '@/components/agent-chat/hooks/use-connectors';
import { appAgentApi } from '@/lib/api/app/agent';
import type { AgentType } from '@/types/admin';

import { isChatSurface, isKnownNonChatSurface } from '../routines-visibility';
import { type BlockingConnector, getBlockingConnectors } from '../utils/routine-agent-connectors';

import { useAgentDetail } from './use-agent-detail';

export type RoutinesUnavailableReason = 'not-chat' | 'disabled' | null;

// The picker vets its own options, but that vetting is best-effort: it keeps any agent whose record it
// could not read. This notice is the backstop for the one that slips through, and for a chat agent that
// simply has routines turned off.
const unavailableReason = (
    componentType: string | undefined,
    isEnabled: boolean | undefined,
): RoutinesUnavailableReason => {
    if (isKnownNonChatSurface(componentType)) return 'not-chat';
    if (isEnabled === false) return 'disabled';

    return null;
};

export const useRoutineAgentState = (selectedAgentId: string) => {
    const { data: agent, isPending, isError } = useAgentDetail(selectedAgentId);
    const isResolved = !isPending && !isError;
    const reason = isResolved
        ? unavailableReason(agent?.uiConfig?.componentType, agent?.uiConfig?.routines?.enabled)
        : null;

    // Chat's `['agent', id]` key, not this hook's own `useAgentDetail` record: only the launcher
    // payload resolves per-user connector `connection` state (see `use-routine-mention-items`).
    // `staleTime: 0` because this cache entry is also read elsewhere (chat) for display, not as a
    // save gate: a connector disconnected in another tab moments ago must not save on a stale hit.
    const {
        data: launcherAgent,
        isPending: isLauncherPending,
        isFetching: isLauncherFetching,
    } = useQuery<AgentType>({
        queryKey: ['agent', selectedAgentId],
        queryFn: ({ signal }) => appAgentApi.getAgent<AgentType>(selectedAgentId, { signal }),
        enabled: Boolean(selectedAgentId),
        staleTime: 0,
    });
    const blockingConnectors = useMemo(() => getBlockingConnectors(launcherAgent), [launcherAgent]);

    // Fed the agent-attached list only, matching `getBlockingConnectors` above: a routine has no
    // composer-time custom/shared connector picker whose extras would need merging in.
    const { reconnect, setConnectorEnabled, connectingId, enablingId } = useConnectors({
        agentId: selectedAgentId || null,
        agentMcpServers: launcherAgent?.mcpServers,
    });

    const fixConnector = useCallback(
        (connector: BlockingConnector) =>
            connector.action === 'enable' ? setConnectorEnabled(connector._id, true) : reconnect(connector._id),
        [reconnect, setConnectorEnabled],
    );

    return {
        agent,
        isAgentPending: isPending,
        routinesUnavailableReason: reason,
        areRoutinesDisabled: reason !== null,
        // A routine reaches its connectors unattended, with no composer banner in front of them.
        hasBlockingConnectors: blockingConnectors.length > 0,
        blockingConnectors,
        fixConnector,
        connectingId,
        enablingId,
        // In flight, `hasBlockingConnectors` is `false` for having nothing to block on yet rather
        // than for having checked — `isFetching` is what covers the revalidation a cache hit still
        // triggers under `staleTime: 0`, which `isPending` alone would miss.
        //
        // A failed check is judged on what it failed to confirm: with no record at all nothing
        // blocks, but react-query keeps the last good `data` through a failed refetch, and a
        // connector blocked a moment ago stays blocked rather than the gate dropping on a 500.
        areConnectorsUnresolved: Boolean(selectedAgentId) && (isLauncherPending || isLauncherFetching),
        /**
         * Only the agent's own record proves the surface. An unreadable record, or one naming no surface
         * at all, proves nothing — and the picker keeps such an agent rather than hiding it over a 500,
         * so this is what stops a new routine being attached to an agent that may not be a chat one.
         */
        isSurfaceProven: isResolved && isChatSurface(agent?.uiConfig?.componentType),
        // Saving before the agent record lands would skip the model preselect and create a routine that never runs.
        isAgentUnresolved: Boolean(selectedAgentId) && isPending,
        // Spaces are opt-in per agent, unlike routines, which are on unless turned off.
        areSpacesEnabled: Boolean(agent?.uiConfig?.spaces?.enabled),
    };
};
