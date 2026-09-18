import { BlocksIcon, ZapIcon } from 'lucide-react';

import { buildDirectiveSuggestions } from '@/lib/chat/directives';
import type { AgentWithDirectives, DirectiveSuggestionBase } from '@/lib/chat/directives';

import type { UseConnectorsResult, UseSkillsResult } from '../../../types';

export type MentionSkillsInput = Pick<UseSkillsResult, 'skills' | 'customIds' | 'sharedIds' | 'enabledIds'>;

export type MentionConnectorsInput = Pick<
    UseConnectorsResult,
    | 'connections'
    | 'nonOauthConnectors'
    | 'disconnectedConnectors'
    | 'disabledMap'
    | 'connectorDescriptions'
    | 'connectorServerUrls'
>;

export interface BuildComposerMentionSuggestionsParams {
    agent: AgentWithDirectives;
    skills: MentionSkillsInput;
    connectors: MentionConnectorsInput;
    /** Connector ids (`_id`) merged in from the user's own connectors rather than the agent payload. */
    customConnectorIds: string[];
    /** Connector ids (`_id`) merged in from connectors shared with the user. */
    sharedConnectorIds: string[];
}

const CUSTOM_ORIGIN_HINT = 'Custom';
const ENTERPRISE_ORIGIN_HINT = 'Enterprise';
const NOT_CONNECTED_HINT = 'Not connected';

const getOriginHint = (id: string, customIds: Set<string>, sharedIds: Set<string>): string | undefined => {
    if (customIds.has(id)) {
        return CUSTOM_ORIGIN_HINT;
    }

    if (sharedIds.has(id)) {
        return ENTERPRISE_ORIGIN_HINT;
    }

    return undefined;
};

const resolveDescription = (ownDescription: string | undefined, originHint: string | undefined): string | undefined => {
    const trimmed = ownDescription?.trim();

    return trimmed ? trimmed : originHint;
};

const dedupeByTypeAndId = (suggestions: DirectiveSuggestionBase[]): DirectiveSuggestionBase[] => {
    const seen = new Set<string>();

    return suggestions.filter((suggestion) => {
        const key = `${suggestion.type}:${suggestion.id}`;

        if (seen.has(key)) {
            return false;
        }

        seen.add(key);

        return true;
    });
};

const buildSkillSuggestions = (skills: MentionSkillsInput): DirectiveSuggestionBase[] => {
    const enabledIds = new Set(skills.enabledIds);
    const customIds = new Set(skills.customIds);
    const sharedIds = new Set(skills.sharedIds);

    return skills.skills
        .filter((skill) => enabledIds.has(skill._id))
        .map((skill) => ({
            id: skill._id,
            label: skill.name,
            description: resolveDescription(skill.description, getOriginHint(skill._id, customIds, sharedIds)),
            type: 'skill',
            icon: ZapIcon,
        }));
};

const buildConnectorSuggestions = (
    connectors: MentionConnectorsInput,
    customConnectorIds: string[],
    sharedConnectorIds: string[],
): DirectiveSuggestionBase[] => {
    // Enablement is the per-user `disabledMap` read, matching the connectors submenu toggle —
    // not `enabledIds`, which additionally requires a live OAuth connection and so would hide
    // every connector the user has not connected yet.
    const { disabledMap, connectorDescriptions, connectorServerUrls } = connectors;
    const customIds = new Set(customConnectorIds);
    const sharedIds = new Set(sharedConnectorIds);
    const entries = [
        ...connectors.connections.map((connection) => ({
            id: connection.mcpServerId,
            name: connection.mcpServerName ?? '',
            isConnected: true,
        })),
        ...connectors.nonOauthConnectors.map((connector) => ({
            id: connector._id,
            name: connector.name,
            isConnected: true,
        })),
        // Listed even though `useConnectors` keeps these out of the /chat `mcpServers` whitelist:
        // the user wants every connector visible under "@", so the row reports the state instead.
        ...connectors.disconnectedConnectors.map((connector) => ({
            id: connector._id,
            name: connector.name,
            isConnected: false,
        })),
    ];

    return entries
        .filter((entry) => Boolean(entry.name) && !disabledMap[entry.id])
        .map((entry) => ({
            // The directive token carries the server name, not its `_id` — see `formatDirectiveText`.
            id: entry.name,
            label: entry.name,
            description: entry.isConnected
                ? resolveDescription(connectorDescriptions[entry.id], getOriginHint(entry.id, customIds, sharedIds))
                : NOT_CONNECTED_HINT,
            type: 'mcp',
            icon: BlocksIcon,
            serverUrl: connectorServerUrls[entry.id],
        }));
};

/**
 * Builds the "@" mention list from the live composer state rather than the agent payload, so
 * the user's custom (personal) and enterprise (shared) skills and connectors appear alongside
 * the agent's own, and per-user disabled entries drop out. Tools still come straight from
 * `buildDirectiveSuggestions` so the agent payload stays their single source of truth.
 */
export const buildComposerMentionSuggestions = ({
    agent,
    skills,
    connectors,
    customConnectorIds,
    sharedConnectorIds,
}: BuildComposerMentionSuggestionsParams): DirectiveSuggestionBase[] => {
    const toolSuggestions = buildDirectiveSuggestions(agent).filter((suggestion) => suggestion.type === 'tool');

    return dedupeByTypeAndId([
        ...toolSuggestions,
        ...buildSkillSuggestions(skills),
        ...buildConnectorSuggestions(connectors, customConnectorIds, sharedConnectorIds),
    ]);
};

export default buildComposerMentionSuggestions;
