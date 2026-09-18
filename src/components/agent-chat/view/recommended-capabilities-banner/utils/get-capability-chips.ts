import { isTokenExpired } from '@/hooks';
import type { McpType } from '@/types/admin';

import type { DisabledAgentSkill } from '../../../types';
import type { CapabilityChip, ConnectorAction } from '../types';

/**
 * Why a recommended connector is not usable right now, which is also what clicking it
 * has to fix. `mcp.status` is the admin switch on the server itself — nothing a user
 * does can clear it, so those are hidden everywhere rather than offered here (the
 * connector lists in `use-connectors` drop them too). `disabledMap` is this chat's
 * on/off state; per-user connection state is read from `mcp.connection`, the status
 * the backend resolves onto the agent payload. A `noAccess` connector is an
 * entitlement no click can clear, so it belongs to the no-access row alone and must
 * never reach this list.
 */
export const getConnectorAction = (mcp: McpType, disabledMap: Record<string, boolean>): ConnectorAction | null => {
    if (!mcp.isRecommended || mcp.status === 'inactive' || mcp.noAccess === true) return null;
    if (disabledMap[mcp._id]) return 'enable';

    // Every other auth type is ready to use as soon as it is switched on.
    if (mcp.authType !== 'oauth') return null;

    if (mcp.connection?.status !== 'connected') {
        return 'connect';
    }

    return isTokenExpired(mcp.connection.tokenExpiry) ? 'reconnect' : null;
};

export const getCapabilityChips = (
    mcpServers: McpType[],
    disabledMap: Record<string, boolean>,
    disabledSkills: DisabledAgentSkill[],
): CapabilityChip[] => {
    const connectorChips = mcpServers.reduce<CapabilityChip[]>((list, mcp) => {
        const action = getConnectorAction(mcp, disabledMap);

        if (!action) return list;

        return [
            ...list,
            {
                key: `connector:${mcp._id}`,
                _id: mcp._id,
                name: mcp.name,
                kind: 'connector',
                action,
            },
        ];
    }, []);

    // Same rule as `getConnectorAction`: only a recommended capability earns a chip, and an
    // older payload without the flag counts as not recommended.
    const skillChips = disabledSkills
        .filter((skill) => skill.isRecommended === true)
        .map<CapabilityChip>((skill) => ({
            key: `skill:${skill._id}`,
            _id: skill._id,
            name: skill.name,
            kind: 'skill',
            action: 'enable',
        }));

    return [...connectorChips, ...skillChips];
};
