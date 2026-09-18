import type { AgentType } from '@/types/admin';

import type { NoAccessCapability, NoAccessKind } from '../types';

/** The agent payload fields that can carry `noAccess` items, all optional so a partial agent is accepted. */
export type CapabilitySources = Partial<Pick<AgentType, 'skills' | 'tools' | 'dataStores' | 'mcpServers' | 'agents'>>;

interface RestrictedItem {
    readonly _id: string;
    name: string;
    noAccess?: boolean;
}

interface CapabilityCollection {
    kind: NoAccessKind;
    select: (sources: CapabilitySources) => RestrictedItem[] | undefined;
}

const COLLECTIONS: CapabilityCollection[] = [
    { kind: 'connector', select: (sources) => sources.mcpServers },
    { kind: 'skill', select: (sources) => sources.skills },
    { kind: 'data-store', select: (sources) => sources.dataStores },
    { kind: 'tool', select: (sources) => sources.tools },
    { kind: 'agent', select: (sources) => sources.agents },
];

export const getNoAccessCapabilities = (sources: CapabilitySources): NoAccessCapability[] =>
    COLLECTIONS.flatMap(({ kind, select }) =>
        (select(sources) ?? [])
            .filter((item) => item.noAccess === true)
            .map<NoAccessCapability>((item) => ({
                key: `${kind}:${item._id}`,
                _id: item._id,
                name: item.name,
                kind,
            })),
    );
