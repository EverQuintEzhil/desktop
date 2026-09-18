import { useMemo } from 'react';

import type { DirectiveSuggestionBase } from '@/lib/chat/directives';
import type { ChatAgentType } from '@/types/admin';

import type { UseConnectorsResult, UseSkillsResult } from '../../../types';
import { buildComposerMentionSuggestions } from '../utils/mention-suggestions';

interface UseComposerTriggerSuggestionsParams {
    agent: ChatAgentType;
    skills: UseSkillsResult;
    connectors: UseConnectorsResult;
    customConnectorIds: string[];
    sharedConnectorIds: string[];
}

export interface UseComposerTriggerSuggestionsResult {
    mentionSuggestionBases: DirectiveSuggestionBase[];
}

const useComposerTriggerSuggestions = ({
    agent,
    skills,
    connectors,
    customConnectorIds,
    sharedConnectorIds,
}: UseComposerTriggerSuggestionsParams): UseComposerTriggerSuggestionsResult => {
    // `useSkills` and `useConnectors` return a fresh object literal on every render, so the memo
    // below keys on the individual fields instead — those are each memoised by the owning hook.
    const {
        skills: skillList,
        customIds: customSkillIds,
        sharedIds: sharedSkillIds,
        enabledIds: enabledSkillIds,
    } = skills;
    const {
        connections,
        nonOauthConnectors,
        disconnectedConnectors,
        disabledMap: connectorDisabledMap,
        connectorDescriptions,
        connectorServerUrls,
    } = connectors;

    const mentionSuggestionBases = useMemo<DirectiveSuggestionBase[]>(
        () =>
            buildComposerMentionSuggestions({
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
                    disabledMap: connectorDisabledMap,
                    connectorDescriptions,
                    connectorServerUrls,
                },
                customConnectorIds,
                sharedConnectorIds,
            }),
        [
            agent,
            skillList,
            customSkillIds,
            sharedSkillIds,
            enabledSkillIds,
            connections,
            nonOauthConnectors,
            disconnectedConnectors,
            connectorDisabledMap,
            connectorDescriptions,
            connectorServerUrls,
            customConnectorIds,
            sharedConnectorIds,
        ],
    );

    return { mentionSuggestionBases };
};

export default useComposerTriggerSuggestions;
