import type { AgentAccessRosterItem, AgentAccessRosterUser } from '@/lib/api/admin/agent-access';
import type { CapabilityKind } from '@/lib/api/admin/agent-access-check';

/** Local names for the shared roster shapes, so this folder reads in its own vocabulary. */
export type AccessItem = AgentAccessRosterItem;
export type AccessUser = AgentAccessRosterUser;
export type AccessItemKind = CapabilityKind;

/** The four capability kinds this tab reports on. Apps are deliberately absent: there is no api
 *  type to grant one against, so a gap on an app would render a Grant button that cannot work. */
export const ACCESS_ITEM_KINDS = [
    'tool',
    'skill',
    'connector',
    'dataStore',
] as const satisfies readonly AccessItemKind[];

/** How a person reaches the agent. `everyone` is an agent that names no include list, so it is open
 *  to the whole tenant — those people are not admins. */
export const ACCESS_PATHS = ['direct', 'group', 'admin', 'everyone'] as const;

export type AccessPath = (typeof ACCESS_PATHS)[number];

/** The roster types `path` as a plain string, so an unknown value falls back rather than throwing. */
export const accessPathOf = (user: AccessUser): AccessPath =>
    (ACCESS_PATHS as readonly string[]).includes(user.path ?? '') ? (user.path as AccessPath) : 'direct';

export const ACCESS_ITEM_KIND_LABEL: Record<AccessItemKind, string> = {
    tool: 'Tool',
    skill: 'Skill',
    connector: 'Connector',
    dataStore: 'Data store',
};

export const ACCESS_ITEM_KIND_PLURAL: Record<AccessItemKind, string> = {
    tool: 'Tools',
    skill: 'Skills',
    connector: 'Connectors',
    dataStore: 'Data stores',
};

/** The shared spelling for a dismissed capability+principal pair. */
export const ignoreKey = (capabilityId: string, principalId: string): string => `${capabilityId}:${principalId}`;
