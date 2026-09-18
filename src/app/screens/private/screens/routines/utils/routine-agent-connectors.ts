import { getConnectorAction } from '@/components/agent-chat/view/recommended-capabilities-banner/utils/get-capability-chips';
import type { McpType } from '@/types/admin';

// Mirrors `use-connectors`' `serverEnabledMap`: the per-agent on/off state, folding agent
// preference over global preference over the default of on. There is no per-routine picker to
// carry an override on top of it, unlike the chat composer.
const isConnectorDisabled = (mcp: McpType): boolean => (mcp.effectiveEnabled ?? mcp.agentEnabled ?? true) === false;

export interface BlockingConnector {
    _id: string;
    name: string;
    action: 'connect' | 'reconnect' | 'enable';
}

/**
 * Recommended connectors the agent cannot actually use right now — turned off, never connected,
 * or expired. A routine run reaches these connectors directly with no composer banner in front of
 * it to fix them, so the create/edit form has to block the save instead of producing a routine
 * that is doomed to fail (or silently skip) on its first run.
 *
 * `mcpServers` must come from the launcher payload (`appAgentApi.getAgent`, cache key
 * `['agent', agentId]`) — only that request resolves this viewer's own `connection` state per
 * connector. The routine form's own detail record (`getFullAgent`) does not, and would read
 * every recommended OAuth connector as never connected regardless of the truth.
 */
export const getBlockingConnectors = (agent: { mcpServers?: McpType[] } | undefined): BlockingConnector[] => {
    const mcpServers = agent?.mcpServers ?? [];
    const disabledMap = mcpServers.reduce<Record<string, boolean>>((map, mcp) => {
        map[mcp._id] = isConnectorDisabled(mcp);

        return map;
    }, {});

    return mcpServers.reduce<BlockingConnector[]>((list, mcp) => {
        const action = getConnectorAction(mcp, disabledMap);

        if (!action) return list;

        return [...list, { _id: mcp._id, name: mcp.name, action }];
    }, []);
};
