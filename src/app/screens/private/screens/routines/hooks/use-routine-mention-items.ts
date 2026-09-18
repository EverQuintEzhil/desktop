import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useSelector } from 'react-redux';

import { useAgentConnectors } from '@/components/agent-chat/hooks/use-agent-connectors';
import { useSkills } from '@/components/agent-chat/hooks/use-skills';
import { buildComposerMentionSuggestions } from '@/components/agent-chat/view/agent-chat-composer/utils/mention-suggestions';
import { appAgentApi } from '@/lib/api/app/agent';
import type { DirectiveSuggestionBase } from '@/lib/chat/directives';
import { selectUser } from '@/store/selectors';
import type { AgentType, McpType, SkillType } from '@/types/admin';
import { resolveAgentAccessFlags } from '@/utils/resolve-agent-access-flags';

const NO_SKILLS: SkillType[] = [];

const NO_SERVERS: McpType[] = [];

const NO_AGENT: Partial<AgentType> = {};

export interface RoutineMentionItemsResult {
    items: DirectiveSuggestionBase[];
    /** True while the agent's capability payload is still on the wire. */
    isPending: boolean;
}

/** Built from the same launcher payload and composer hooks as chat, so a routine
 * prompt only ever offers what a chat message to that agent could. */
export const useRoutineMentionItems = (agentId: string): RoutineMentionItemsResult => {
    // Chat's `['agent', id]` key, not the form's own detail record: only the launcher payload resolves per-user connector `connection` state.
    const { data: agent, isPending: isAgentPending } = useQuery<AgentType>({
        queryKey: ['agent', agentId],
        queryFn: ({ signal }) => appAgentApi.getAgent<AgentType>(agentId, { signal }),
        enabled: Boolean(agentId),
    });

    const { allowCustomSkills, allowSharedSkills } = resolveAgentAccessFlags(agent ?? {});

    const connectorsSource = useMemo(
        () => ({ _id: agent?._id ?? '', mcpServers: agent?.mcpServers ?? NO_SERVERS, settings: agent?.settings }),
        [agent],
    );
    const viewer = useSelector(selectUser);
    const { connectors, customConnectorIds, sharedConnectorIds } = useAgentConnectors(
        connectorsSource,
        viewer?._id ?? null,
    );
    const skills = useSkills({
        agentId: agent?._id ?? null,
        agentSkills: agent?.skills ?? NO_SKILLS,
        allowCustomSkills,
        allowSharedSkills,
    });

    // `useSkills`/`useConnectors` return a fresh object every render, so depend on the fields.
    const { skills: skillList, customIds, sharedIds, enabledIds } = skills;
    const {
        connections,
        nonOauthConnectors,
        disconnectedConnectors,
        disabledMap,
        connectorDescriptions,
        connectorServerUrls,
    } = connectors;

    const items = useMemo(
        () =>
            buildComposerMentionSuggestions({
                agent: agent ?? NO_AGENT,
                skills: { skills: skillList, customIds, sharedIds, enabledIds },
                connectors: {
                    connections,
                    nonOauthConnectors,
                    disconnectedConnectors,
                    disabledMap,
                    connectorDescriptions,
                    connectorServerUrls,
                },
                customConnectorIds,
                sharedConnectorIds,
            }),
        [
            agent,
            skillList,
            customIds,
            sharedIds,
            enabledIds,
            connections,
            nonOauthConnectors,
            disconnectedConnectors,
            disabledMap,
            connectorDescriptions,
            connectorServerUrls,
            customConnectorIds,
            sharedConnectorIds,
        ],
    );

    return { items, isPending: Boolean(agentId) && isAgentPending };
};
