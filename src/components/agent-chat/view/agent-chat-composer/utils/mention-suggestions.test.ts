import { describe, expect, it } from 'vitest';

import type { McpConnection } from '@/lib/api';
import type { ChatAgentType, McpType, SkillType, ToolType } from '@/types/admin';

import type {
    BuildComposerMentionSuggestionsParams,
    MentionConnectorsInput,
    MentionSkillsInput,
} from './mention-suggestions';
import { buildComposerMentionSuggestions } from './mention-suggestions';

// `ChatAgentType`, `SkillType`, `ToolType`, `McpType` and `McpConnection` each carry dozens of
// required fields (creator, timestamps, security groups) that these pure builders never read, so
// every fixture below declares only the fields under test and this one helper does the widening.
const asFixture = <T>(value: Partial<T>): T => value as T;

const makeTool = (fields: Partial<ToolType>) => asFixture<ToolType>(fields);

const makeSkill = (fields: Partial<SkillType>) => asFixture<SkillType>(fields);

const makeMcpServer = (fields: Partial<McpType>) => asFixture<McpType>(fields);

const makeConnection = (mcpServerId: string, mcpServerName: string | null) =>
    asFixture<McpConnection>({ mcpServerId, mcpServerName });

const makeAgent = (fields: Partial<ChatAgentType> = {}) => asFixture<ChatAgentType>(fields);

const emptySkills: MentionSkillsInput = {
    skills: [],
    customIds: [],
    sharedIds: [],
    enabledIds: [],
};

const emptyConnectors: MentionConnectorsInput = {
    connections: [],
    nonOauthConnectors: [],
    disconnectedConnectors: [],
    disabledMap: {},
    connectorDescriptions: {},
    connectorServerUrls: {},
};

const buildParams = (
    overrides: Partial<BuildComposerMentionSuggestionsParams> = {},
): BuildComposerMentionSuggestionsParams => ({
    agent: makeAgent(),
    skills: emptySkills,
    connectors: emptyConnectors,
    customConnectorIds: [],
    sharedConnectorIds: [],
    ...overrides,
});

const build = (overrides: Partial<BuildComposerMentionSuggestionsParams> = {}) =>
    buildComposerMentionSuggestions(buildParams(overrides));

describe('buildComposerMentionSuggestions — tools', () => {
    it('emits one tool per agent tool, preferring refName as the id', () => {
        const result = build({
            agent: makeAgent({
                tools: [
                    makeTool({
                        _id: 'tool-1',
                        refName: 'web_search',
                        name: 'Web Search',
                        description: 'Searches the web',
                    }),
                ],
            }),
        });

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            id: 'web_search',
            label: 'Web Search',
            description: 'Searches the web',
            type: 'tool',
        });
    });

    it('never suggests a tool the viewer has no access to', () => {
        const result = build({
            agent: makeAgent({
                tools: [
                    makeTool({
                        _id: 'tool-1',
                        refName: 'cost_lookup',
                        name: 'Cost lookup',
                        noAccess: true,
                    }),
                    makeTool({ _id: 'tool-2', refName: 'web_search', name: 'Web Search' }),
                ],
            }),
        });

        expect(result.map((suggestion) => suggestion.id)).toEqual(['web_search']);
    });

    it('falls back to the tool _id when there is no refName', () => {
        const result = build({
            agent: makeAgent({ tools: [makeTool({ _id: 'tool-1', name: 'Calculator' })] }),
        });

        expect(result.map((suggestion) => suggestion.id)).toEqual(['tool-1']);
    });

    it('ignores skills and mcpServers carried on the agent payload', () => {
        const result = build({
            agent: makeAgent({
                tools: [makeTool({ _id: 'tool-1', refName: 'web_search', name: 'Web Search' })],
                skills: [makeSkill({ _id: 'skill-1', name: 'Agent Skill' })],
                mcpServers: [makeMcpServer({ _id: 'mcp-1', name: 'Agent Connector' })],
            }),
        });

        expect(result.map((suggestion) => suggestion.label)).toEqual(['Web Search']);
    });

    it('takes a connector from the live connector state rather than the agent payload', () => {
        const result = build({
            agent: makeAgent({
                mcpServers: [makeMcpServer({ _id: 'mcp-1', name: 'Notion', description: 'Agent payload description' })],
            }),
            connectors: {
                ...emptyConnectors,
                connections: [makeConnection('mcp-1', 'Notion')],
                connectorDescriptions: { 'mcp-1': 'Live connector description' },
            },
        });

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ id: 'Notion', type: 'mcp', description: 'Live connector description' });
    });
});

describe('buildComposerMentionSuggestions — skills', () => {
    const skills = [
        makeSkill({ _id: 'skill-1', name: 'Personal Skill' }),
        makeSkill({ _id: 'skill-2', name: 'Shared Skill' }),
        makeSkill({ _id: 'skill-3', name: 'Agent Skill' }),
    ];

    it('emits only skills listed in enabledIds, keyed by _id', () => {
        const result = build({
            skills: {
                skills,
                customIds: [],
                sharedIds: [],
                enabledIds: ['skill-1', 'skill-3'],
            },
        });

        expect(result.map((suggestion) => suggestion.id)).toEqual(['skill-1', 'skill-3']);
        expect(result.every((suggestion) => suggestion.type === 'skill')).toBe(true);
    });

    it('prefers the skill own description over the origin hint', () => {
        const result = build({
            skills: {
                skills: [makeSkill({ _id: 'skill-1', name: 'Personal Skill', description: 'Writes release notes' })],
                customIds: ['skill-1'],
                sharedIds: [],
                enabledIds: ['skill-1'],
            },
        });

        expect(result[0].description).toBe('Writes release notes');
    });

    it('labels a custom skill Custom and a shared skill Enterprise, and leaves a plain agent skill without a hint', () => {
        const result = build({
            skills: {
                skills,
                customIds: ['skill-1'],
                sharedIds: ['skill-2'],
                enabledIds: ['skill-1', 'skill-2', 'skill-3'],
            },
        });

        expect(result.map((suggestion) => suggestion.description)).toEqual(['Custom', 'Enterprise', undefined]);
    });

    it('falls back to the origin hint when the description is whitespace only', () => {
        const result = build({
            skills: {
                skills: [
                    makeSkill({ _id: 'skill-1', name: 'Personal Skill', description: '   ' }),
                    makeSkill({ _id: 'skill-3', name: 'Agent Skill', description: '  \n ' }),
                ],
                customIds: ['skill-1'],
                sharedIds: [],
                enabledIds: ['skill-1', 'skill-3'],
            },
        });

        expect(result.map((suggestion) => suggestion.description)).toEqual(['Custom', undefined]);
    });
});

describe('buildComposerMentionSuggestions — connectors', () => {
    it('emits the union of connections, non-OAuth and disconnected connectors keyed by name', () => {
        const result = build({
            connectors: {
                ...emptyConnectors,
                connections: [makeConnection('mcp-1', 'Slack')],
                nonOauthConnectors: [{ _id: 'mcp-2', name: 'Postgres' }],
                disconnectedConnectors: [{ _id: 'mcp-3', name: 'Notion' }],
            },
        });

        expect(result.map((suggestion) => suggestion.id)).toEqual(['Slack', 'Postgres', 'Notion']);
        expect(result.map((suggestion) => suggestion.label)).toEqual(['Slack', 'Postgres', 'Notion']);
        expect(result.every((suggestion) => suggestion.type === 'mcp')).toBe(true);
    });

    it('drops a connector disabled in disabledMap even when it is connected', () => {
        const result = build({
            connectors: {
                ...emptyConnectors,
                connections: [makeConnection('mcp-1', 'Slack')],
                nonOauthConnectors: [{ _id: 'mcp-2', name: 'Postgres' }],
                disconnectedConnectors: [{ _id: 'mcp-3', name: 'Notion' }],
                disabledMap: { 'mcp-1': true, 'mcp-3': true },
            },
        });

        expect(result.map((suggestion) => suggestion.label)).toEqual(['Postgres']);
    });

    it('keeps a connector whose disabledMap entry is false', () => {
        const result = build({
            connectors: {
                ...emptyConnectors,
                connections: [makeConnection('mcp-1', 'Slack')],
                disabledMap: { 'mcp-1': false },
            },
        });

        expect(result.map((suggestion) => suggestion.label)).toEqual(['Slack']);
    });

    it('drops an entry with an empty name', () => {
        const result = build({
            connectors: {
                ...emptyConnectors,
                connections: [makeConnection('mcp-1', null), makeConnection('mcp-2', 'Slack')],
                nonOauthConnectors: [{ _id: 'mcp-3', name: '' }],
            },
        });

        expect(result.map((suggestion) => suggestion.label)).toEqual(['Slack']);
    });

    it('uses connectorDescriptions for a connected connector', () => {
        const result = build({
            connectors: {
                ...emptyConnectors,
                connections: [makeConnection('mcp-1', 'Slack')],
                connectorDescriptions: { 'mcp-1': 'Team chat' },
            },
            customConnectorIds: ['mcp-1'],
        });

        expect(result[0].description).toBe('Team chat');
    });

    it('falls back to the origin hint for a connected connector with no description', () => {
        const result = build({
            connectors: {
                ...emptyConnectors,
                connections: [makeConnection('mcp-1', 'Slack')],
                nonOauthConnectors: [{ _id: 'mcp-2', name: 'Postgres' }],
                disconnectedConnectors: [],
            },
            customConnectorIds: ['mcp-1'],
            sharedConnectorIds: ['mcp-2'],
        });

        expect(result.map((suggestion) => suggestion.description)).toEqual(['Custom', 'Enterprise']);
    });

    it('reports Not connected for a disconnected connector, overriding its description and origin hint', () => {
        const result = build({
            connectors: {
                ...emptyConnectors,
                disconnectedConnectors: [{ _id: 'mcp-3', name: 'Notion' }],
                connectorDescriptions: { 'mcp-3': 'Notes and docs' },
            },
            customConnectorIds: ['mcp-3'],
        });

        expect(result.map((suggestion) => suggestion.description)).toEqual(['Not connected']);
    });
});

describe('buildComposerMentionSuggestions — de-dupe and order', () => {
    it('keeps only the first entry when the same type and id appear twice', () => {
        const result = build({
            connectors: {
                ...emptyConnectors,
                connections: [makeConnection('mcp-1', 'Slack')],
                disconnectedConnectors: [{ _id: 'mcp-9', name: 'Slack' }],
                connectorDescriptions: { 'mcp-1': 'Team chat' },
            },
        });

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ id: 'Slack', description: 'Team chat' });
    });

    it('does not de-dupe across types when the ids collide', () => {
        const result = build({
            agent: makeAgent({ tools: [makeTool({ _id: 'shared-id', refName: 'Slack', name: 'Slack Tool' })] }),
            connectors: {
                ...emptyConnectors,
                connections: [makeConnection('mcp-1', 'Slack')],
            },
        });

        expect(result.map((suggestion) => `${suggestion.type}:${suggestion.id}`)).toEqual(['tool:Slack', 'mcp:Slack']);
    });

    it('orders tools first, then skills, then connectors', () => {
        const result = build({
            agent: makeAgent({ tools: [makeTool({ _id: 'tool-1', refName: 'web_search', name: 'Web Search' })] }),
            skills: {
                skills: [makeSkill({ _id: 'skill-1', name: 'Release Notes' })],
                customIds: [],
                sharedIds: [],
                enabledIds: ['skill-1'],
            },
            connectors: {
                ...emptyConnectors,
                connections: [makeConnection('mcp-1', 'Slack')],
            },
        });

        expect(result.map((suggestion) => suggestion.type)).toEqual(['tool', 'skill', 'mcp']);
        expect(result.map((suggestion) => suggestion.label)).toEqual(['Web Search', 'Release Notes', 'Slack']);
    });
});
