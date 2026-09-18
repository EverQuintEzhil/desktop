import { waitFor } from '@testing-library/react';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { apiUrl, envelope, failureEnvelope, httpError, rawPaged, respond, server } from '@/test/msw';
import { renderHookWithProviders } from '@/test/test-utils';

import {
    SKILLS_PICKER_KEY,
    useAgentConfigQuery,
    useConversationMessagesQuery,
    useConversationsQuery,
    usePreviewAgentQuery,
    useSkillQuery,
    useUpdateSkillMutation,
} from './use-create-agent-queries';

const CONVERSATIONS_PATH = '/assistant/agent-builder/conversations';

const skill = (overrides: Record<string, unknown> = {}) => ({
    _id: 'skill-1',
    skill_name: 'summarise',
    display_name: 'Summarise',
    short_description: 'Short',
    skill_description: 'Long description',
    instructions: 'Do the thing',
    ...overrides,
});

describe('usePreviewAgentQuery', () => {
    it('sends no request while the preview is closed', async () => {
        let calls = 0;

        server.use(
            http.get(apiUrl('/agents/agent-1'), () => {
                calls += 1;

                return envelope({ _id: 'agent-1', name: 'Support bot' });
            }),
        );

        const { result } = renderHookWithProviders(() => usePreviewAgentQuery('agent-1', false));

        await waitFor(() => {
            expect(result.current.fetchStatus).toBe('idle');
        });
        expect(calls).toBe(0);
        expect(result.current.data).toBeUndefined();
    });

    it('fetches the agent once the preview opens', async () => {
        server.use(respond('get', '/agents/agent-1', () => envelope({ _id: 'agent-1', name: 'Support bot' })));

        const { result } = renderHookWithProviders(() => usePreviewAgentQuery('agent-1', true));

        await waitFor(() => {
            expect(result.current.data?.name).toBe('Support bot');
        });
    });

    it('surfaces a 500 as an error rather than data', async () => {
        server.use(respond('get', '/agents/agent-1', () => httpError(500)));

        const { result } = renderHookWithProviders(() => usePreviewAgentQuery('agent-1', true));

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });
        expect(result.current.data).toBeUndefined();
    });

    it('surfaces a success:false envelope as an error', async () => {
        server.use(respond('get', '/agents/agent-1', () => failureEnvelope('Agent not available')));

        const { result } = renderHookWithProviders(() => usePreviewAgentQuery('agent-1', true));

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });
        expect((result.current.error as Error).message).toBe('Agent not available');
    });
});

describe('useConversationMessagesQuery', () => {
    it('stays idle without a conversation id', async () => {
        const { result } = renderHookWithProviders(() => useConversationMessagesQuery('', 'agent-1'));

        await waitFor(() => {
            expect(result.current.fetchStatus).toBe('idle');
        });
        expect(result.current.data).toBeUndefined();
    });

    it('stays idle while explicitly disabled', async () => {
        const { result } = renderHookWithProviders(() => useConversationMessagesQuery('conv-1', 'agent-1', false));

        await waitFor(() => {
            expect(result.current.fetchStatus).toBe('idle');
        });
    });

    it('requests the conversation messages with the agent id as a query param', async () => {
        let requestUrl = '';

        server.use(
            http.get(apiUrl(`${CONVERSATIONS_PATH}/conv-1/messages`), ({ request }) => {
                requestUrl = request.url;

                return envelope(
                    rawPaged([
                        {
                            _id: 'm1',
                            conversation_id: 'conv-1',
                            role: 'user',
                            content: [{ type: 'text', text: 'Hello' }],
                        },
                    ]),
                );
            }),
        );

        const { result } = renderHookWithProviders(() => useConversationMessagesQuery('conv-1', 'agent-1'));

        await waitFor(() => {
            expect(result.current.data).toHaveLength(1);
        });
        expect(new URL(requestUrl).searchParams.get('agentId')).toBe('agent-1');
        expect(result.current.data?.[0]).toEqual({
            id: 'm1',
            role: 'user',
            parts: [{ type: 'text', text: 'Hello' }],
        });
    });

    it('reports an error when both the detail and the fallback list requests fail', async () => {
        server.use(respond('get', `${CONVERSATIONS_PATH}/conv-1/messages`, () => httpError(500)));
        server.use(respond('get', CONVERSATIONS_PATH, () => httpError(500)));

        const { result } = renderHookWithProviders(() => useConversationMessagesQuery('conv-1', 'agent-1'));

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });
        expect(result.current.data).toBeUndefined();
    });

    it('reports an error when both requests answer with a success:false envelope', async () => {
        server.use(
            respond('get', `${CONVERSATIONS_PATH}/conv-1/messages`, () => failureEnvelope('Messages unavailable')),
        );
        server.use(respond('get', CONVERSATIONS_PATH, () => failureEnvelope('Messages unavailable')));

        const { result } = renderHookWithProviders(() => useConversationMessagesQuery('conv-1', 'agent-1'));

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });
        expect(result.current.data).toBeUndefined();
    });

    it('falls back to the conversations list when the detail request fails', async () => {
        server.use(respond('get', `${CONVERSATIONS_PATH}/conv-1/messages`, () => httpError(500)));
        server.use(
            respond('get', CONVERSATIONS_PATH, () =>
                envelope(
                    rawPaged([
                        {
                            _id: 'm1',
                            conversation_id: 'conv-1',
                            role: 'assistant',
                            content: [{ type: 'text', text: 'Recovered' }],
                        },
                        {
                            _id: 'm2',
                            conversation_id: 'conv-other',
                            role: 'user',
                            content: [{ type: 'text', text: 'Other' }],
                        },
                    ]),
                ),
            ),
        );

        const { result } = renderHookWithProviders(() => useConversationMessagesQuery('conv-1', 'agent-1'));

        await waitFor(() => {
            expect(result.current.data).toHaveLength(1);
        });
        expect(result.current.data?.[0].id).toBe('m1');
    });
});

describe('useAgentConfigQuery', () => {
    it('stays idle without an agent id', async () => {
        const { result } = renderHookWithProviders(() => useAgentConfigQuery(undefined));

        await waitFor(() => {
            expect(result.current.fetchStatus).toBe('idle');
        });
    });

    it('loads the agent draft and its linked prompt code', async () => {
        server.use(
            respond('get', '/agents/agent-1', () =>
                envelope({
                    _id: 'agent-1',
                    name: 'Support bot',
                    systemPromptCodeId: 'code-prompt',
                    uiConfigCodeId: 'code-ui',
                }),
            ),
        );
        server.use(
            respond('get', '/codes', () =>
                envelope(
                    rawPaged([
                        {
                            _id: 'code-prompt',
                            type: 'agent_system_prompt',
                            lang: 'markdown',
                            version: '1.0.0',
                            code: 'Be helpful.',
                        },
                        {
                            _id: 'code-ui',
                            type: 'agent_ui_config',
                            lang: 'json',
                            version: '1.0.0',
                            code: '{"componentType":"chat"}',
                        },
                    ]),
                ),
            ),
        );

        const { result } = renderHookWithProviders(() => useAgentConfigQuery('agent-1'));

        await waitFor(() => {
            expect(result.current.data?.draft.name).toBe('Support bot');
        });
        expect(result.current.data?.draft.instructions).toBe('Be helpful.');
        expect(result.current.data?.systemPromptCodeId).toBe('code-prompt');
    });

    it('reports an error when the agent cannot be fetched', async () => {
        server.use(respond('get', '/agents/agent-1', () => httpError(500)));

        const { result } = renderHookWithProviders(() => useAgentConfigQuery('agent-1'));

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });
    });

    it('reports an error for a success:false envelope', async () => {
        server.use(respond('get', '/agents/agent-1', () => failureEnvelope('No such agent')));

        const { result } = renderHookWithProviders(() => useAgentConfigQuery('agent-1'));

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });
        expect((result.current.error as Error).message).toBe('No such agent');
    });

    it('recovers on a refetch after a failed load', async () => {
        let attempt = 0;

        server.use(
            http.get(apiUrl('/agents/agent-1'), () => {
                attempt += 1;

                return attempt === 1
                    ? httpError(500)
                    : envelope({ _id: 'agent-1', name: 'Recovered bot', systemPromptCodeId: 'code-prompt' });
            }),
        );
        server.use(
            respond('get', '/codes', () =>
                envelope(
                    rawPaged([
                        {
                            _id: 'code-prompt',
                            type: 'agent_system_prompt',
                            lang: 'markdown',
                            version: '1.0.0',
                            code: 'Be helpful.',
                        },
                        {
                            _id: 'code-ui',
                            type: 'agent_ui_config',
                            lang: 'json',
                            version: '1.0.0',
                            code: '{"componentType":"chat"}',
                        },
                    ]),
                ),
            ),
        );
        server.use(respond('put', '/agents/agent-1', () => envelope({ _id: 'agent-1' })));

        const { result } = renderHookWithProviders(() => useAgentConfigQuery('agent-1'));

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        await result.current.refetch();

        await waitFor(() => {
            expect(result.current.data?.draft.name).toBe('Recovered bot');
        });
    });
});

describe('useConversationsQuery', () => {
    it('stays idle without an agent id', async () => {
        const { result } = renderHookWithProviders(() => useConversationsQuery(undefined));

        await waitFor(() => {
            expect(result.current.fetchStatus).toBe('idle');
        });
    });

    it('requests page 0 with the create-agent page size and groups the messages into conversations', async () => {
        let requestUrl = '';

        server.use(
            http.get(apiUrl(CONVERSATIONS_PATH), ({ request }) => {
                requestUrl = request.url;

                return envelope(
                    rawPaged(
                        [
                            {
                                _id: 'm1',
                                conversation_id: 'conv-1',
                                agent_id: 'agent-1',
                                role: 'user',
                                content: [{ type: 'text', text: 'Build me a bot' }],
                            },
                        ],
                        { page: 0, totalPages: 1 },
                    ),
                );
            }),
        );

        const { result } = renderHookWithProviders(() => useConversationsQuery('agent-1'));

        await waitFor(() => {
            expect(result.current.data?.pages[0].conversations).toHaveLength(1);
        });

        const params = new URL(requestUrl).searchParams;

        expect(params.get('agentId')).toBe('agent-1');
        expect(params.get('page')).toBe('0');
        expect(params.get('size')).toBe('30');
        expect(result.current.data?.pages[0].conversations[0].title).toBe('Build me a bot');
    });

    it('offers a next page while more pages remain', async () => {
        server.use(
            respond('get', CONVERSATIONS_PATH, () =>
                envelope(
                    rawPaged(
                        [
                            {
                                _id: 'm1',
                                conversation_id: 'conv-1',
                                role: 'user',
                                content: [{ type: 'text', text: 'First' }],
                            },
                        ],
                        { page: 0, totalPages: 3 },
                    ),
                ),
            ),
        );

        const { result } = renderHookWithProviders(() => useConversationsQuery('agent-1'));

        await waitFor(() => {
            expect(result.current.hasNextPage).toBe(true);
        });
    });

    it('reports no next page on the last page', async () => {
        server.use(respond('get', CONVERSATIONS_PATH, () => envelope(rawPaged([], { page: 0, totalPages: 1 }))));

        const { result } = renderHookWithProviders(() => useConversationsQuery('agent-1'));

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });
        expect(result.current.hasNextPage).toBe(false);
        expect(result.current.data?.pages[0].conversations).toEqual([]);
    });

    it('asks for the next page number when fetchNextPage is called', async () => {
        const pages: string[] = [];

        server.use(
            http.get(apiUrl(CONVERSATIONS_PATH), ({ request }) => {
                const page = new URL(request.url).searchParams.get('page') ?? '';

                pages.push(page);

                return envelope(
                    rawPaged(
                        [
                            {
                                _id: `m-${page}`,
                                conversation_id: `conv-${page}`,
                                role: 'user',
                                content: [{ type: 'text', text: `Page ${page}` }],
                            },
                        ],
                        { page: Number(page), totalPages: 2 },
                    ),
                );
            }),
        );

        const { result } = renderHookWithProviders(() => useConversationsQuery('agent-1'));

        await waitFor(() => {
            expect(result.current.hasNextPage).toBe(true);
        });

        await result.current.fetchNextPage();

        await waitFor(() => {
            expect(result.current.data?.pages).toHaveLength(2);
        });
        expect(pages).toEqual(['0', '1']);
        expect(result.current.data?.pages[1].conversations[0].title).toBe('Page 1');
    });

    it('surfaces a 500 as an error rather than an empty page', async () => {
        server.use(respond('get', CONVERSATIONS_PATH, () => httpError(500)));

        const { result } = renderHookWithProviders(() => useConversationsQuery('agent-1'));

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });
        expect(result.current.data).toBeUndefined();
        expect(result.current.hasNextPage).toBe(false);
    });

    it('surfaces a success:false envelope as an error', async () => {
        server.use(respond('get', CONVERSATIONS_PATH, () => failureEnvelope('Nope')));

        const { result } = renderHookWithProviders(() => useConversationsQuery('agent-1'));

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });
        expect((result.current.error as Error).message).toBe('Nope');
    });

    it('recovers on a refetch after a failed first page', async () => {
        let attempt = 0;

        server.use(
            http.get(apiUrl(CONVERSATIONS_PATH), () => {
                attempt += 1;

                return attempt === 1
                    ? httpError(500)
                    : envelope(
                          rawPaged(
                              [
                                  {
                                      _id: 'm1',
                                      conversation_id: 'conv-1',
                                      role: 'user',
                                      content: [{ type: 'text', text: 'Recovered thread' }],
                                  },
                              ],
                              { page: 0, totalPages: 1 },
                          ),
                      );
            }),
        );

        const { result } = renderHookWithProviders(() => useConversationsQuery('agent-1'));

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        await result.current.refetch();

        await waitFor(() => {
            expect(result.current.data?.pages[0].conversations[0].title).toBe('Recovered thread');
        });
        expect(result.current.isError).toBe(false);
    });

    // A load-more failure must never wipe the pages already on screen: the rejected page never
    // lands in `data.pages`, which is also why `hasNextPage` stays true and the panel has to latch
    // the failure itself rather than rely on the query to stop offering more.
    it('keeps the already-loaded pages when a load-more fails', async () => {
        let attempt = 0;

        server.use(
            http.get(apiUrl(CONVERSATIONS_PATH), () => {
                attempt += 1;

                return attempt === 1
                    ? envelope(
                          rawPaged(
                              [
                                  {
                                      _id: 'm1',
                                      conversation_id: 'conv-1',
                                      role: 'user',
                                      content: [{ type: 'text', text: 'First' }],
                                  },
                              ],
                              { page: 0, totalPages: 2 },
                          ),
                      )
                    : httpError(500);
            }),
        );

        const { result } = renderHookWithProviders(() => useConversationsQuery('agent-1'));

        await waitFor(() => {
            expect(result.current.hasNextPage).toBe(true);
        });

        const outcome = await result.current.fetchNextPage();

        expect(outcome.error).toBeInstanceOf(Error);
        expect(result.current.data?.pages).toHaveLength(1);
        expect(result.current.data?.pages[0].conversations[0].title).toBe('First');
        expect(result.current.hasNextPage).toBe(true);
    });
});

describe('useSkillQuery', () => {
    it('stays idle without a skill id', async () => {
        const { result } = renderHookWithProviders(() => useSkillQuery(''));

        await waitFor(() => {
            expect(result.current.fetchStatus).toBe('idle');
        });
    });

    it('loads the skill detail', async () => {
        server.use(respond('get', '/skills/skill-1', () => envelope(skill())));

        const { result } = renderHookWithProviders(() => useSkillQuery('skill-1'));

        await waitFor(() => {
            expect(result.current.data?.display_name).toBe('Summarise');
        });
    });

    it('reports a 500 as an error', async () => {
        server.use(respond('get', '/skills/skill-1', () => httpError(500)));

        const { result } = renderHookWithProviders(() => useSkillQuery('skill-1'));

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });
    });
});

describe('useUpdateSkillMutation', () => {
    it('patches only the changed fields and writes the result into the skill cache', async () => {
        let body: Record<string, unknown> = {};

        server.use(respond('get', '/skills/skill-1', () => envelope(skill())));
        server.use(
            http.patch(apiUrl('/skills/skill-1'), async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;

                return envelope(skill({ display_name: 'Condense' }));
            }),
        );

        const { result } = renderHookWithProviders(() => ({
            detail: useSkillQuery('skill-1'),
            update: useUpdateSkillMutation('skill-1'),
        }));

        await waitFor(() => {
            expect(result.current.detail.data?.display_name).toBe('Summarise');
        });

        await result.current.update.mutateAsync({ display_name: 'Condense' });

        expect(body).toEqual({ display_name: 'Condense' });
        await waitFor(() => {
            expect(result.current.detail.data?.display_name).toBe('Condense');
        });
    });

    it('invalidates the skills picker list on success', async () => {
        server.use(respond('patch', '/skills/skill-1', () => envelope(skill())));

        const { result, queryClient } = renderHookWithProviders(() => useUpdateSkillMutation('skill-1'));

        queryClient.setQueryData(SKILLS_PICKER_KEY, { pages: [] });

        await result.current.mutateAsync({ short_description: 'Shorter' });

        await waitFor(() => {
            expect(queryClient.getQueryState(SKILLS_PICKER_KEY)?.isInvalidated).toBe(true);
        });
    });

    it('rejects and leaves the cached skill untouched when the patch fails', async () => {
        server.use(respond('get', '/skills/skill-1', () => envelope(skill())));
        server.use(respond('patch', '/skills/skill-1', () => httpError(500)));

        const { result } = renderHookWithProviders(() => ({
            detail: useSkillQuery('skill-1'),
            update: useUpdateSkillMutation('skill-1'),
        }));

        await waitFor(() => {
            expect(result.current.detail.data?.display_name).toBe('Summarise');
        });

        await expect(result.current.update.mutateAsync({ display_name: 'Condense' })).rejects.toThrow();

        expect(result.current.detail.data?.display_name).toBe('Summarise');
    });
});
