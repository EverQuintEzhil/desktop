import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiUrl, envelope, failureEnvelope, httpError, rawPaged, respond, server } from '@/test/msw';
import type { AgentType, CodeType } from '@/types/admin';

import {
    applyModelsToUiConfig,
    buildDefaultUiConfig,
    bumpVersion,
    createDraftAgent,
    listMyAgents,
    loadAgentConfig,
    orderDefaultFirst,
    resolveModelName,
    saveCapabilities,
    saveDescription,
    saveName,
    slugify,
    SYSTEM_PROMPT_TYPE,
    UI_CONFIG_TYPE,
    uniqueIdentifier,
    uniqueSlug,
} from './create-agent-api';

const code = (overrides: Partial<CodeType> & { _id: string }): CodeType => ({
    toolId: '',
    version: '1.0.0',
    type: SYSTEM_PROMPT_TYPE,
    lang: 'markdown',
    code: '',
    updatedById: '',
    creatorId: '',
    isDeleted: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    creator: {} as CodeType['creator'],
    updatedBy: {} as CodeType['updatedBy'],
    ...overrides,
});

const agent = (overrides: Partial<AgentType> = {}): AgentType =>
    ({
        _id: 'agent-1',
        name: 'Support bot',
        ...overrides,
    }) as AgentType;

describe('pure helpers', () => {
    it('bumps the patch segment of a semver string', () => {
        expect(bumpVersion('1.2.3')).toBe('1.2.4');
        expect(bumpVersion('0.0.9')).toBe('0.0.10');
    });

    it('falls back to 1.0.1 for a missing or malformed version', () => {
        expect(bumpVersion(undefined)).toBe('1.0.1');
        expect(bumpVersion('not-a-version')).toBe('1.0.1');
        expect(bumpVersion('1.2')).toBe('1.0.1');
    });

    it('slugifies a name and collapses punctuation', () => {
        expect(slugify('  My Great Agent!! ')).toBe('my-great-agent');
        expect(slugify('---')).toBe('agent');
    });

    it('appends a random suffix to unique slugs and identifiers', () => {
        const slug = uniqueSlug('My Agent');
        const identifier = uniqueIdentifier('My Agent');

        expect(slug).toMatch(/^my-agent-[a-z0-9]+$/);
        expect(identifier).toMatch(/^com\.fluentmind\.my-agent-[a-z0-9]+$/);
    });

    it('builds a default ui config titled after the agent', () => {
        expect(buildDefaultUiConfig('  Helper  ').home?.title).toBe('Helper');
        expect(buildDefaultUiConfig('   ').home?.title).toBe('Your agent');
        expect(buildDefaultUiConfig().componentType).toBe('chat');
    });

    it('sets the first model as the default and removes it when the list empties', () => {
        const base = buildDefaultUiConfig('Helper');
        const withModels = applyModelsToUiConfig(base, [
            { name: 'gpt', modelId: 'm1' },
            { name: 'claude', modelId: 'm2' },
        ]);

        expect(withModels.defaultModel).toEqual({ name: 'gpt', modelId: 'm1' });

        const cleared = applyModelsToUiConfig(withModels, []);

        expect(cleared.defaultModel).toBeUndefined();
        expect(base.defaultModel).toBeUndefined();
    });

    it('moves the default model id to the front only when present', () => {
        expect(orderDefaultFirst(['a', 'b', 'c'], 'c')).toEqual(['c', 'a', 'b']);
        expect(orderDefaultFirst(['a', 'b'], 'z')).toEqual(['a', 'b']);
        expect(orderDefaultFirst(['a', 'b'])).toEqual(['a', 'b']);
    });
});

describe('createDraftAgent', () => {
    const seedHandlers = () => {
        server.use(
            respond('post', '/codes', () => envelope(code({ _id: 'code-ui', type: UI_CONFIG_TYPE, lang: 'json' }))),
        );
        server.use(respond('put', '/agents/agent-1', () => envelope(agent())));
    };

    it('posts a draft agent with a generated identifier and slug, then seeds a ui config', async () => {
        let createBody: Record<string, unknown> = {};
        let codeBody: Record<string, unknown> = {};
        let linkBody: Record<string, unknown> = {};

        server.use(
            http.post(apiUrl('/agents'), async ({ request }) => {
                createBody = (await request.json()) as Record<string, unknown>;

                return envelope(agent());
            }),
        );
        server.use(
            http.post(apiUrl('/codes'), async ({ request }) => {
                codeBody = (await request.json()) as Record<string, unknown>;

                return envelope(
                    code({
                        _id: 'code-ui',
                        type: UI_CONFIG_TYPE,
                        lang: 'json',
                        version: '1.0.0',
                    }),
                );
            }),
        );
        server.use(
            http.put(apiUrl('/agents/agent-1'), async ({ request }) => {
                linkBody = (await request.json()) as Record<string, unknown>;

                return envelope(agent());
            }),
        );

        const created = await createDraftAgent('  Support bot  ');

        expect(created._id).toBe('agent-1');
        expect(createBody.name).toBe('Support bot');
        expect(createBody.type).toBe('chat');
        expect(createBody.version).toBe('v2');
        expect(createBody.dev).toBe(true);
        expect(createBody.slug).toMatch(/^support-bot-/);
        expect(createBody.identifier).toMatch(/^com\.fluentmind\.support-bot-/);
        expect(codeBody.type).toBe(UI_CONFIG_TYPE);
        expect(codeBody.version).toBe('1.0.0');
        expect(linkBody).toEqual({ uiConfigCodeId: 'code-ui' });
    });

    it('names an unnamed agent "Untitled agent"', async () => {
        let createBody: Record<string, unknown> = {};

        server.use(
            http.post(apiUrl('/agents'), async ({ request }) => {
                createBody = (await request.json()) as Record<string, unknown>;

                return envelope(agent());
            }),
        );
        seedHandlers();

        await createDraftAgent('   ');

        expect(createBody.name).toBe('Untitled agent');
    });

    it('forwards the model options when supplied', async () => {
        let createBody: Record<string, unknown> = {};

        server.use(
            http.post(apiUrl('/agents'), async ({ request }) => {
                createBody = (await request.json()) as Record<string, unknown>;

                return envelope(agent());
            }),
        );
        seedHandlers();

        await createDraftAgent('Bot', { defaultModelId: 'm1', modelIds: ['m1', 'm2'] });

        expect(createBody.defaultModelId).toBe('m1');
        expect(createBody.modelIds).toEqual(['m1', 'm2']);
    });

    it('retries once with a fresh slug on a duplicate-key collision', async () => {
        let attempts = 0;

        server.use(
            http.post(apiUrl('/agents'), () => {
                attempts += 1;

                if (attempts === 1) {
                    return failureEnvelope('E11000 duplicate key error collection: agents index: identifier_1');
                }

                return envelope(agent());
            }),
        );
        seedHandlers();

        const created = await createDraftAgent('Bot');

        expect(attempts).toBe(2);
        expect(created._id).toBe('agent-1');
    });

    it('rethrows an error that is not a duplicate-key collision', async () => {
        server.use(respond('post', '/agents', () => httpError(500)));

        await expect(createDraftAgent('Bot')).rejects.toThrow();
    });

    it('still returns the agent when seeding the ui config fails', async () => {
        server.use(respond('post', '/agents', () => envelope(agent())));
        server.use(respond('post', '/codes', () => httpError(500)));

        await expect(createDraftAgent('Bot')).resolves.toMatchObject({ _id: 'agent-1' });
    });
});

describe('loadAgentConfig', () => {
    const uiConfigJson = JSON.stringify({ componentType: 'chat', type: 'chat', models: [] });

    it('maps the agent and its linked codes into a draft', async () => {
        server.use(
            respond('get', '/agents/agent-1', () =>
                envelope(
                    agent({
                        systemPromptCodeId: 'code-prompt',
                        uiConfigCodeId: 'code-ui',
                        mcpServers: [{ _id: 'mcp-1', name: 'Slack' }],
                        tools: [{ _id: 'tool-1', name: 'Search' }],
                        agents: [{ _id: 'sub-1', name: 'Sub' }],
                        skills: [{ _id: 'skill-1', name: 'Summarise' }],
                        memories: [{ _id: 'mem-1', name: 'Notes' }],
                        dataStores: [{ _id: 'ds-1', name: 'Docs', provider: 's3' }],
                        description: 'Handles billing',
                    } as Partial<AgentType>),
                ),
            ),
        );
        server.use(
            respond('get', '/codes', () =>
                envelope(
                    rawPaged([
                        code({ _id: 'code-prompt', code: '# Purpose\nHelps', version: '2.0.0' }),
                        code({
                            _id: 'code-ui',
                            type: UI_CONFIG_TYPE,
                            lang: 'json',
                            code: uiConfigJson,
                        }),
                    ]),
                ),
            ),
        );

        const result = await loadAgentConfig('agent-1');

        expect(result.draft.name).toBe('Support bot');
        expect(result.draft.instructions).toBe('# Purpose\nHelps');
        expect(result.publishedInstructions).toBe('# Purpose\nHelps');
        expect(result.systemPromptCodeId).toBe('code-prompt');
        expect(result.systemPromptVersion).toBe('2.0.0');
        expect(result.uiConfigCodeId).toBe('code-ui');
        expect(result.draft.mcpServers).toEqual([{ _id: 'mcp-1', name: 'Slack' }]);
        expect(result.draft.files).toEqual([{ _id: 'ds-1', name: 'Docs', provider: 's3' }]);
        expect(result.description).toBe('Handles billing');
        expect(result.pendingCodeId).toBeUndefined();
    });

    it('carries the recommended flag on a loaded skill', async () => {
        server.use(
            respond('get', '/agents/agent-1', () =>
                envelope(
                    agent({
                        uiConfigCodeId: 'code-ui',
                        skills: [
                            { _id: 'skill-1', name: 'Summarise', isRecommended: true },
                            { _id: 'skill-2', name: 'Report', isRecommended: false },
                        ],
                    } as Partial<AgentType>),
                ),
            ),
        );
        server.use(
            respond('get', '/codes', () =>
                envelope(
                    rawPaged([
                        code({
                            _id: 'code-ui',
                            type: UI_CONFIG_TYPE,
                            lang: 'json',
                            code: uiConfigJson,
                        }),
                    ]),
                ),
            ),
        );

        const result = await loadAgentConfig('agent-1');

        expect(result.draft.skills).toEqual([
            { _id: 'skill-1', name: 'Summarise', isRecommended: true },
            { _id: 'skill-2', name: 'Report', isRecommended: false },
        ]);
    });

    it('reports the newest unpublished prompt as the pending draft', async () => {
        server.use(
            respond('get', '/agents/agent-1', () =>
                envelope(
                    agent({
                        systemPromptCodeId: 'code-prompt',
                        uiConfigCodeId: 'code-ui',
                    } as Partial<AgentType>),
                ),
            ),
        );
        server.use(
            respond('get', '/codes', () =>
                envelope(
                    rawPaged([
                        code({ _id: 'code-prompt', code: 'published', createdAt: '2026-01-01T00:00:00.000Z' }),
                        code({
                            _id: 'code-draft',
                            code: 'draft text',
                            version: '1.0.1',
                            createdAt: '2026-02-01T00:00:00.000Z',
                        }),
                        code({
                            _id: 'code-ui',
                            type: UI_CONFIG_TYPE,
                            lang: 'json',
                            code: uiConfigJson,
                        }),
                    ]),
                ),
            ),
        );

        const result = await loadAgentConfig('agent-1');

        expect(result.pendingCodeId).toBe('code-draft');
        expect(result.pendingVersion).toBe('1.0.1');
        expect(result.draft.instructions).toBe('draft text');
        expect(result.publishedInstructions).toBe('published');
    });

    it('reports a newer ui config code as the pending ui config', async () => {
        server.use(
            respond('get', '/agents/agent-1', () =>
                envelope(agent({ uiConfigCodeId: 'code-ui' } as Partial<AgentType>)),
            ),
        );
        server.use(
            respond('get', '/codes', () =>
                envelope(
                    rawPaged([
                        code({
                            _id: 'code-ui',
                            type: UI_CONFIG_TYPE,
                            lang: 'json',
                            code: uiConfigJson,
                            createdAt: '2026-01-01T00:00:00.000Z',
                        }),
                        code({
                            _id: 'code-ui-draft',
                            type: UI_CONFIG_TYPE,
                            lang: 'json',
                            version: '1.0.2',
                            code: JSON.stringify({
                                componentType: 'chat',
                                type: 'chat',
                                models: [],
                                home: { title: 'Draft' },
                            }),
                            createdAt: '2026-03-01T00:00:00.000Z',
                        }),
                    ]),
                ),
            ),
        );

        const result = await loadAgentConfig('agent-1');

        expect(result.pendingUiConfigCodeId).toBe('code-ui-draft');
        expect(result.pendingUiConfigVersion).toBe('1.0.2');
        expect(result.pendingUiConfig?.home?.title).toBe('Draft');
    });

    it('falls back to the default ui config when the stored JSON is unparseable', async () => {
        server.use(
            respond('get', '/agents/agent-1', () =>
                envelope(agent({ uiConfigCodeId: 'code-ui' } as Partial<AgentType>)),
            ),
        );
        server.use(
            respond('get', '/codes', () =>
                envelope(
                    rawPaged([
                        code({
                            _id: 'code-ui',
                            type: UI_CONFIG_TYPE,
                            lang: 'json',
                            code: '{ not json',
                        }),
                    ]),
                ),
            ),
        );

        const result = await loadAgentConfig('agent-1');

        expect(result.uiConfig?.home?.title).toBe('Support bot');
    });

    it('seeds a ui config when the agent has none', async () => {
        let seeded = false;

        server.use(respond('get', '/agents/agent-1', () => envelope(agent())));
        server.use(respond('get', '/codes', () => envelope(rawPaged<CodeType>([]))));
        server.use(
            http.post(apiUrl('/codes'), () => {
                seeded = true;

                return envelope(
                    code({
                        _id: 'code-new',
                        type: UI_CONFIG_TYPE,
                        lang: 'json',
                        version: '1.0.0',
                    }),
                );
            }),
        );
        server.use(respond('put', '/agents/agent-1', () => envelope(agent())));

        const result = await loadAgentConfig('agent-1');

        expect(seeded).toBe(true);
        expect(result.uiConfigCodeId).toBe('code-new');
        expect(result.uiConfig?.home?.title).toBe('Support bot');
    });

    it('keeps a default ui config in memory when seeding fails', async () => {
        server.use(respond('get', '/agents/agent-1', () => envelope(agent())));
        server.use(respond('get', '/codes', () => envelope(rawPaged<CodeType>([]))));
        server.use(respond('post', '/codes', () => httpError(500)));

        const result = await loadAgentConfig('agent-1');

        expect(result.uiConfigCodeId).toBeUndefined();
        expect(result.uiConfig?.componentType).toBe('chat');
    });

    it('links an orphan ui config code back onto the agent', async () => {
        let linkBody: Record<string, unknown> = {};

        server.use(respond('get', '/agents/agent-1', () => envelope(agent())));
        server.use(
            respond('get', '/codes', () =>
                envelope(
                    rawPaged([
                        code({
                            _id: 'code-ui',
                            type: UI_CONFIG_TYPE,
                            lang: 'json',
                            code: uiConfigJson,
                        }),
                    ]),
                ),
            ),
        );
        server.use(
            http.put(apiUrl('/agents/agent-1'), async ({ request }) => {
                linkBody = (await request.json()) as Record<string, unknown>;

                return envelope(agent());
            }),
        );

        await loadAgentConfig('agent-1');

        expect(linkBody).toEqual({ uiConfigCodeId: 'code-ui' });
    });

    it('resolves model names for an agent whose models come from ids only', async () => {
        server.use(
            respond('get', '/agents/agent-1', () =>
                envelope(
                    agent({
                        uiConfigCodeId: 'code-ui',
                        defaultModelId: 'model-1',
                    } as Partial<AgentType>),
                ),
            ),
        );
        server.use(
            respond('get', '/codes', () =>
                envelope(
                    rawPaged([
                        code({
                            _id: 'code-ui',
                            type: UI_CONFIG_TYPE,
                            lang: 'json',
                            code: uiConfigJson,
                        }),
                    ]),
                ),
            ),
        );
        server.use(respond('get', '/models/model-1', () => envelope({ _id: 'model-1', model: 'gpt-5' })));

        const result = await loadAgentConfig('agent-1');

        expect(result.draft.models).toEqual([{ _id: 'model-1', name: 'gpt-5' }]);
        expect(result.uiConfig?.models).toEqual([{ name: 'gpt-5', modelId: 'model-1' }]);
    });

    it('prefers the models already attached to the agent and puts the default first', async () => {
        server.use(
            respond('get', '/agents/agent-1', () =>
                envelope(
                    agent({
                        uiConfigCodeId: 'code-ui',
                        defaultModelId: 'model-2',
                        models: [
                            { _id: 'model-1', model: 'gpt-5', provider: 'openai' },
                            { _id: 'model-2', model: 'claude', provider: 'anthropic' },
                        ],
                    } as unknown as Partial<AgentType>),
                ),
            ),
        );
        server.use(
            respond('get', '/codes', () =>
                envelope(
                    rawPaged([
                        code({
                            _id: 'code-ui',
                            type: UI_CONFIG_TYPE,
                            lang: 'json',
                            code: uiConfigJson,
                        }),
                    ]),
                ),
            ),
        );
        server.use(respond('get', '/models/model-1', () => envelope({ _id: 'model-1', model: 'gpt-5' })));
        server.use(respond('get', '/models/model-2', () => envelope({ _id: 'model-2', model: 'claude' })));

        const result = await loadAgentConfig('agent-1');

        expect(result.draft.models?.map((model) => model._id)).toEqual(['model-2', 'model-1']);
    });

    it('rejects when the agent cannot be fetched', async () => {
        server.use(respond('get', '/agents/agent-1', () => httpError(500)));

        await expect(loadAgentConfig('agent-1')).rejects.toThrow();
    });
});

describe('resolveModelName', () => {
    it('returns the model name from the API', async () => {
        server.use(respond('get', '/models/m1', () => envelope({ _id: 'm1', model: 'gpt-5' })));

        await expect(resolveModelName('m1')).resolves.toBe('gpt-5');
    });

    it('falls back to the id when the lookup fails', async () => {
        server.use(respond('get', '/models/m1', () => httpError(404)));

        await expect(resolveModelName('m1')).resolves.toBe('m1');
    });

    it('falls back to the id when the model has no name', async () => {
        server.use(respond('get', '/models/m1', () => envelope({ _id: 'm1', model: '' })));

        await expect(resolveModelName('m1')).resolves.toBe('m1');
    });
});

describe('agent mutations', () => {
    it('saves a trimmed name alongside a matching slug', async () => {
        let body: Record<string, unknown> = {};

        server.use(
            http.put(apiUrl('/agents/agent-1'), async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;

                return envelope(agent());
            }),
        );

        await saveName('agent-1', '  Support Bot  ');

        expect(body).toEqual({ name: 'Support Bot', slug: 'support-bot' });
    });

    it('retries a name save with a unique slug on a duplicate-key collision', async () => {
        const slugs: unknown[] = [];

        server.use(
            http.put(apiUrl('/agents/agent-1'), async ({ request }) => {
                const body = (await request.json()) as Record<string, unknown>;

                slugs.push(body.slug);

                if (slugs.length === 1) {
                    return failureEnvelope('E11000 duplicate key error: slug already exists');
                }

                return envelope(agent());
            }),
        );

        await saveName('agent-1', 'Support Bot');

        expect(slugs[0]).toBe('support-bot');
        expect(slugs[1]).toMatch(/^support-bot-.+/);
    });

    it('rethrows a non-duplicate name save failure', async () => {
        server.use(respond('put', '/agents/agent-1', () => httpError(500)));

        await expect(saveName('agent-1', 'Bot')).rejects.toThrow();
    });

    it('sends capability ids straight through', async () => {
        let body: Record<string, unknown> = {};

        server.use(
            http.put(apiUrl('/agents/agent-1'), async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;

                return envelope(agent());
            }),
        );

        await saveCapabilities('agent-1', { toolIds: ['tool-1'], defaultModelId: null });

        expect(body).toEqual({ toolIds: ['tool-1'], defaultModelId: null });
    });

    it('sends the description on its own', async () => {
        let body: Record<string, unknown> = {};

        server.use(
            http.put(apiUrl('/agents/agent-1'), async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;

                return envelope(agent());
            }),
        );

        await saveDescription('agent-1', 'Handles billing');

        expect(body).toEqual({ description: 'Handles billing' });
    });
});

describe('listMyAgents', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("requests only the caller's agents and maps them to launcher shape", async () => {
        let requestUrl = '';

        server.use(
            http.get(apiUrl('/agents'), ({ request }) => {
                requestUrl = request.url;

                return envelope(
                    rawPaged([
                        {
                            _id: 'a1',
                            name: 'Alpha',
                            slug: 'alpha',
                            description: 'First',
                        },
                        {
                            _id: 'a2',
                            name: 'Beta',
                            detailedDescription: 'Long form',
                        },
                    ]),
                );
            }),
        );

        const result = await listMyAgents('user-1', 2, 'alp');
        const params = new URL(requestUrl).searchParams;

        expect(params.get('mineOnly')).toBe('true');
        expect(params.get('page')).toBe('2');
        expect(params.get('size')).toBe('20');
        expect(params.get('search')).toBe('alp');
        expect(params.has('sortBy')).toBe(false);
        expect(result.values[0]).toMatchObject({ _id: 'a1', urlOrSlug: 'alpha', description: 'First' });
        expect(result.values[1]).toMatchObject({ urlOrSlug: 'a2', description: 'Long form' });
    });

    it('carries the agent timestamps onto the launcher tile', async () => {
        server.use(
            http.get(apiUrl('/agents'), () =>
                envelope(
                    rawPaged([
                        {
                            _id: 'a1',
                            name: 'Alpha',
                            slug: 'alpha',
                            createdAt: '2026-01-01T00:00:00.000Z',
                            updatedAt: '2026-02-02T00:00:00.000Z',
                            lastInteractedAt: '2026-03-03T00:00:00.000Z',
                        },
                    ]),
                ),
            ),
        );

        const result = await listMyAgents('user-1');

        expect(result.values[0]).toMatchObject({
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-02-02T00:00:00.000Z',
            lastInteractedAt: '2026-03-03T00:00:00.000Z',
        });
    });

    it('passes the sort through to the agents endpoint', async () => {
        let requestUrl = '';

        server.use(
            http.get(apiUrl('/agents'), ({ request }) => {
                requestUrl = request.url;

                return envelope(rawPaged([{ _id: 'a1', name: 'Alpha', slug: 'alpha' }]));
            }),
        );

        await listMyAgents('user-1', 0, '', 'lastInteractedAt:desc');

        expect(new URL(requestUrl).searchParams.get('sortBy')).toBe('lastInteractedAt:desc');
    });

    it('reports a never-used agent as null rather than dropping the field', async () => {
        server.use(
            http.get(apiUrl('/agents'), () => envelope(rawPaged([{ _id: 'a1', name: 'Alpha', slug: 'alpha' }]))),
        );

        const result = await listMyAgents('user-1');

        expect(result.values[0].lastInteractedAt).toBeNull();
    });

    it('omits an empty search term', async () => {
        let requestUrl = '';

        server.use(
            http.get(apiUrl('/agents'), ({ request }) => {
                requestUrl = request.url;

                return envelope(rawPaged([]));
            }),
        );

        await listMyAgents('user-1');

        expect(new URL(requestUrl).searchParams.has('search')).toBe(false);
    });

    it('rejects when the list request fails', async () => {
        server.use(respond('get', '/agents', () => httpError(500)));

        await expect(listMyAgents('user-1')).rejects.toThrow();
    });
});
