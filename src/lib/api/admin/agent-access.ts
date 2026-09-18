import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { apiClient } from '../client';

import type { CapabilityKind } from './agent-access-check';

/**
 * The verdict the runtime itself reaches for one capability, so the sheet can list every
 * capability an agent uses rather than only the ones that fall short. `excluded` is a per-user
 * exclusion on that capability -- the write that fixes it is removing the exclusion, not adding
 * an include -- which is why it is not merged with `not-included`.
 */
const itemStateSchema = z.enum(['covered', 'excluded', 'not-included']);

const capabilityKindSchema = z.enum(['skill', 'connector', 'dataStore', 'tool']);

const rosterItemSchema = z.looseObject({
    id: z.string(),
    name: z.string(),
    kind: capabilityKindSchema,
    state: itemStateSchema,
    canGrant: z
        .unknown()
        .optional()
        .transform((value) => (typeof value === 'boolean' ? value : undefined)),
    /** Whether writing this person into *this* item's excluded list would take effect. False for
     *  people who administer the item itself, whose exclusion the runtime never reads. */
    excludable: z
        .unknown()
        .optional()
        .transform((value) => (typeof value === 'boolean' ? value : undefined)),
});

const rosterUserSchema = z.looseObject({
    id: z.string(),
    name: z.string(),
    email: z.string().optional(),
    avatar: z.string().optional(),
    /** How this person reaches the agent at all: named on it, via a group, by role, or unrestricted. */
    path: z.string().optional(),
    /** A role that bypasses every capability ACL, so any exclusion of them is stored and ignored. */
    isPlatformAdmin: z.boolean().optional(),
    /** Named on the agent itself. Capability ACLs still apply, so item-level writes do work. */
    isAgentAdmin: z.boolean().optional(),
    /** The single flag both of the above replaced. Kept so a tenant still on the old api reads as
     *  it did before: one undifferentiated admin. */
    isAdmin: z.boolean().optional(),
    viaGroups: z.array(z.looseObject({ id: z.string(), name: z.string() })).optional(),
    items: z.array(z.unknown()),
});

export type AgentAccessItemState = z.infer<typeof itemStateSchema>;

export interface AgentAccessRosterItem {
    id: string;
    name: string;
    kind: CapabilityKind;
    state: AgentAccessItemState;
    canGrant?: boolean;
    excludable?: boolean;
}

export interface AgentAccessRosterGroup {
    id: string;
    name: string;
}

export interface AgentAccessRosterUser {
    id: string;
    name: string;
    email?: string;
    avatar?: string;
    path?: string;
    isPlatformAdmin?: boolean;
    isAgentAdmin?: boolean;
    /** The included groups this person is reached through, ids kept so a group can list its members. */
    viaGroups: AgentAccessRosterGroup[];
    items: AgentAccessRosterItem[];
}

export interface AgentAccessRoster {
    users: AgentAccessRosterUser[];
    /** Elements we could not read, so a caller can admit its list is partial rather than short. */
    droppedCount: number;
}

/**
 * Same tolerance as the gap check: one unreadable element costs its own row and nothing else.
 * A screen that lists what an agent uses must not blank because a single capability arrived in a
 * shape we did not expect.
 */
const parseUser = (raw: unknown): { user: AgentAccessRosterUser | null; droppedCount: number } => {
    const parsed = rosterUserSchema.safeParse(raw);

    if (!parsed.success) return { user: null, droppedCount: 1 };

    let droppedCount = 0;

    const items = parsed.data.items.flatMap((rawItem) => {
        const item = rosterItemSchema.safeParse(rawItem);

        if (item.success) return [item.data as AgentAccessRosterItem];

        droppedCount += 1;

        return [];
    });

    return {
        user: {
            id: parsed.data.id,
            name: parsed.data.name,
            email: parsed.data.email,
            avatar: parsed.data.avatar,
            path: parsed.data.path,
            // An api that still sends the old flag cannot say which kind of admin it means, so both
            // read true and the ui stays as cautious as it was before the split.
            isPlatformAdmin: parsed.data.isPlatformAdmin ?? parsed.data.isAdmin,
            isAgentAdmin: parsed.data.isAgentAdmin ?? parsed.data.isAdmin,
            viaGroups: (parsed.data.viaGroups ?? []).map((group) => ({ id: group.id, name: group.name })),
            items,
        },
        droppedCount,
    };
};

const agentAccessRosterSchema = z
    .looseObject({
        users: z.array(z.unknown()),
    })
    .transform((raw): AgentAccessRoster => {
        const users: AgentAccessRosterUser[] = [];
        let droppedCount = 0;

        raw.users.forEach((rawUser) => {
            const parsed = parseUser(rawUser);

            droppedCount += parsed.droppedCount;

            if (parsed.user) users.push(parsed.user);
        });

        return { users, droppedCount };
    });

export const adminAgentAccessApi = {
    async roster(agentId: string): Promise<AgentAccessRoster> {
        const raw = await apiClient.get<unknown>(`/agents/${agentId}/access`);

        return agentAccessRosterSchema.parse(raw);
    },
};

export const AGENT_ACCESS_ROSTER_QUERY_KEY = ['admin', 'agent-access-roster'] as const;

export function useAgentAccessRosterQuery(params: {
    agentId: string;
    /**
     * The agent's own principal lists. The roster is derived from them server-side, so leaving
     * them out of the key serves a cached roster from before the last include-list edit — the
     * two reads then describe different ACLs, and a just-added user is invisible here.
     */
    principalSignature: string;
    capabilitySignature: string;
    enabled: boolean;
}) {
    const { agentId, principalSignature, capabilitySignature, enabled } = params;

    return useQuery({
        queryKey: [...AGENT_ACCESS_ROSTER_QUERY_KEY, agentId, principalSignature, capabilitySignature],
        queryFn: () => adminAgentAccessApi.roster(agentId),
        enabled,
        // Not deployed everywhere yet. A missing route must fail once and stay silent rather than
        // burn three backoff rounds on every visit to the Info tab.
        retry: false,
    });
}
