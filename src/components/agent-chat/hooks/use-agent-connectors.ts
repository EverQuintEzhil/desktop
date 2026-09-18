import { useMemo } from 'react';

import type { ChatAgentType } from '@/types/admin';
import { resolveAgentAccessFlags, type AgentAccessFlagsSource } from '@/utils/resolve-agent-access-flags';

import type { UseConnectorsResult } from '../types';

import { useConnectors } from './use-connectors';
import { useCustomConnectors } from './use-custom-connectors';
import { useSharedConnectors } from './use-shared-connectors';

/** The structural slice this hook actually reads, so non-chat hosts (routines) can pass a leaner record. */
export type AgentConnectorsSource = Pick<ChatAgentType, '_id' | 'mcpServers'> & AgentAccessFlagsSource;

export interface UseAgentConnectorsResult {
    connectors: UseConnectorsResult;
    /** Ids of the user's own connectors merged in that are not attached to the agent. */
    customConnectorIds: string[];
    /** Ids of connectors shared with the user merged in that are not attached or custom. */
    sharedConnectorIds: string[];
}

// Merges the agent's attached connectors with the user's own custom ones (when the
// agent allows it), de-duped by id. Own this once per chat surface (via
// `useAgentComposerOptions` / `AgentComposerContext`) so composer and tools-panel
// toggles share the same optimistic overrides.
export const useAgentConnectors = (
    agent: AgentConnectorsSource,
    viewerUserId?: string | null,
): UseAgentConnectorsResult => {
    const { allowCustomConnectors, allowSharedConnectors } = resolveAgentAccessFlags(agent);
    // The agent payload now carries connectors the viewer cannot access instead of omitting
    // them, so they are dropped here — before the composer list, the toggles, the "@" mention
    // rows and the /chat `mcpServers` whitelist are derived from it.
    const agentMcpServers = useMemo(
        () => (agent.mcpServers ?? []).filter((server) => server.noAccess !== true),
        [agent.mcpServers],
    );
    const customConnectors = useCustomConnectors(allowCustomConnectors, agent._id);
    const sharedConnectors = useSharedConnectors(allowSharedConnectors, agent._id, viewerUserId);

    const extraConnectors = useMemo(() => {
        if (!allowCustomConnectors || customConnectors.length === 0) {
            return [];
        }

        const agentServerIds = new Set(agentMcpServers.map((server) => server._id));

        return customConnectors.filter((server) => !agentServerIds.has(server._id));
    }, [allowCustomConnectors, customConnectors, agentMcpServers]);

    const extraSharedConnectors = useMemo(() => {
        if (!allowSharedConnectors || sharedConnectors.length === 0) {
            return [];
        }

        const agentServerIds = new Set(agentMcpServers.map((server) => server._id));
        const customServerIds = new Set(extraConnectors.map((server) => server._id));

        return sharedConnectors.filter((server) => !agentServerIds.has(server._id) && !customServerIds.has(server._id));
    }, [allowSharedConnectors, sharedConnectors, agentMcpServers, extraConnectors]);

    const mergedMcpServers = useMemo(() => {
        if (extraConnectors.length === 0 && extraSharedConnectors.length === 0) {
            return agentMcpServers;
        }

        return [...agentMcpServers, ...extraConnectors, ...extraSharedConnectors];
    }, [agentMcpServers, extraConnectors, extraSharedConnectors]);

    const connectors = useConnectors({ agentId: agent._id, agentMcpServers: mergedMcpServers });
    const customConnectorIds = useMemo(() => extraConnectors.map((server) => server._id), [extraConnectors]);
    const sharedConnectorIds = useMemo(
        () => extraSharedConnectors.map((server) => server._id),
        [extraSharedConnectors],
    );

    return { connectors, customConnectorIds, sharedConnectorIds };
};
