import { useMemo } from 'react';

import type { DirectiveSuggestionBase } from '@/lib/chat/directives';
import type { ChatAgentType } from '@/types/admin';

import { useAgentComposerContext } from '../context/agent-composer-context';
import { buildComposerMentionSuggestions } from '../view/agent-chat-composer/utils/mention-suggestions';

// Resolves the same broad "@" mention set the composer offers (agent + personal + shared
// connectors/skills) so mentions rendered outside the composer still resolve to a favicon and
// hover card. Callers must render inside AgentComposerProvider.
export const useMentionSuggestions = (agent: ChatAgentType | null | undefined): DirectiveSuggestionBase[] => {
    const { composer } = useAgentComposerContext();
    const { connectors, skills, customConnectorIds, sharedConnectorIds } = composer;
    const {
        connections,
        nonOauthConnectors,
        disconnectedConnectors,
        disabledMap,
        connectorDescriptions,
        connectorServerUrls,
    } = connectors;
    const {
        skills: skillList,
        customIds: customSkillIds,
        sharedIds: sharedSkillIds,
        enabledIds: enabledSkillIds,
    } = skills;

    return useMemo(() => {
        if (!agent) return [];

        return buildComposerMentionSuggestions({
            agent,
            skills: {
                skills: skillList,
                customIds: customSkillIds,
                sharedIds: sharedSkillIds,
                enabledIds: enabledSkillIds,
            },
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
        });
    }, [
        agent,
        skillList,
        customSkillIds,
        sharedSkillIds,
        enabledSkillIds,
        connections,
        nonOauthConnectors,
        disconnectedConnectors,
        disabledMap,
        connectorDescriptions,
        connectorServerUrls,
        customConnectorIds,
        sharedConnectorIds,
    ]);
};

export default useMentionSuggestions;
