import type { QueryClient } from '@tanstack/react-query';

import type { AgentType } from '@/types/admin';

export const ADMIN_AGENT_DETAIL_KEY = ['admin', 'agents', 'detail'] as const;
// The agent builder's preview chat holds its own copy of the agent payload. It lives
// here rather than beside the query so the cache helpers below can reach it without
// the api layer importing from a screen.
export const PREVIEW_AGENT_DETAIL_KEY = ['create-agent-preview-agent'] as const;

export const setEnabledById = <T extends { _id: string }>(items: T[], id: string, enabled: boolean): T[] =>
    items.map((item) => (item._id === id ? { ...item, effectiveEnabled: enabled, agentEnabled: enabled } : item));

// Every cache holding a whole agent payload, as `[...prefix, agentIdOrSlug]`.
const AGENT_DETAIL_KEY_PREFIXES: readonly (readonly unknown[])[] = [
    ['agent'],
    ADMIN_AGENT_DETAIL_KEY,
    PREVIEW_AGENT_DETAIL_KEY,
];

// The last key segment is whatever the route supplied — a slug on the chat page, an id in
// the builder — so these caches can only be found by prefix and then matched on `_id`.
// Keying by `agentId` would miss the chat page entirely. The length check keeps nested
// caches such as `['agent', id, 'memories']` out: only `.memories` is read off that one,
// so patching enablement flags into it would be work no reader ever sees.
const isAgentDetailQuery = (queryKey: readonly unknown[]): boolean =>
    AGENT_DETAIL_KEY_PREFIXES.some(
        (prefix) => queryKey.length === prefix.length + 1 && prefix.every((part, index) => queryKey[index] === part),
    );

export const patchAgentCaches = (
    queryClient: QueryClient,
    agentId: string,
    update: (agent: AgentType) => AgentType,
): void => {
    queryClient.setQueriesData<AgentType>({ predicate: (query) => isAgentDetailQuery(query.queryKey) }, (agent) =>
        agent && agent._id === agentId ? update(agent) : agent,
    );
};

// Cancel in-flight fetches of every agent-payload cache so a slow GET cannot land
// after an optimistic patch and clobber it. Must cover the admin and preview keys too:
// they are patched by patchAgentCaches but never refetched on settle, so an
// un-cancelled in-flight fetch would silently overwrite the optimistic write.
// Only a cache already holding this agent is cancelled: a cancelled first fetch reverts
// to pending-with-no-data and nothing re-issues it, so cancelling another agent's initial
// load would strand that screen on its spinner.
export const cancelAgentCaches = (queryClient: QueryClient, agentId: string): Promise<void> =>
    queryClient.cancelQueries({
        predicate: (query) =>
            isAgentDetailQuery(query.queryKey) && (query.state.data as AgentType | undefined)?._id === agentId,
    });
