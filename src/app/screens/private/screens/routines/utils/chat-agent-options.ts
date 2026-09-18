import type { QueryClient } from '@tanstack/react-query';

import { appAgentApi } from '@/lib/api/app/agent';
import { appAgentsApi } from '@/lib/api/app/agents';

import type { AgentDetail } from '../hooks/use-agent-detail';
import { isChatSurface } from '../routines-visibility';

interface AgentListRow {
    _id: string;
    name: string;
    /** `'chat' | 'api'` on the record, which is not the same thing as the ui surface. */
    type?: string;
}

export interface ChatAgentOption {
    _id: string;
    name: string;
}

const AGENT_OPTIONS_PAGE_SIZE = 50;

export const AGENT_OPTIONS_STALE_MS = 5 * 60_000;

/** Shared with `useAgentDetail`, so picking an agent reuses the record fetched to vet it. */
export const agentDetailQueryKey = (agentId: string) => ['agent', 'detail', agentId] as const;

const agentsPageQueryKey = (search: string) => ['agents', 'options-page', search] as const;

/**
 * Warms the raw page only. Vetting is deliberately left to the moment the menu opens: it costs one
 * request per agent, which is not something a header should spend on mount.
 */
export const agentsPageQuery = (search: string) => ({
    queryKey: agentsPageQueryKey(search),
    queryFn: () =>
        appAgentsApi.listAgents<AgentListRow>({
            ...(search ? { search } : {}),
            size: AGENT_OPTIONS_PAGE_SIZE,
            sortBy: 'name:asc',
        }),
    staleTime: AGENT_OPTIONS_STALE_MS,
});

const isChatRecord = (agent: AgentListRow): boolean => agent.type === undefined || agent.type === 'chat';

/**
 * Routines are chat-only, and neither `GET /agents` nor `GET /launchers` returns a ui config — only
 * the single-agent record carries `componentType`. So the page is vetted one agent at a time and the
 * results are cached under the key `useAgentDetail` reads, which is what keeps this to one round per
 * agent per session rather than one per keystroke.
 *
 * The picker offers only an agent whose own record proves routines are available on it: a chat surface
 * with routines not turned off. Anything unproven — no ui config, or a record that could not be read —
 * is left out rather than offered and then refused.
 */
export const loadChatAgentOptions = async (queryClient: QueryClient, search: string): Promise<ChatAgentOption[]> => {
    const { values } = await queryClient.fetchQuery(agentsPageQuery(search));

    const vetted = await Promise.all(
        values.filter(isChatRecord).map(async (agent) => {
            try {
                const detail = await queryClient.fetchQuery({
                    queryKey: agentDetailQueryKey(agent._id),
                    queryFn: () => appAgentApi.getFullAgent<AgentDetail>(agent._id),
                    staleTime: AGENT_OPTIONS_STALE_MS,
                });

                const uiConfig = detail?.uiConfig;
                const isAvailable = isChatSurface(uiConfig?.componentType) && uiConfig?.routines?.enabled !== false;

                return isAvailable ? agent : null;
            } catch {
                return null;
            }
        }),
    );

    return vetted.filter((agent): agent is AgentListRow => agent !== null).map(({ _id, name }) => ({ _id, name }));
};
