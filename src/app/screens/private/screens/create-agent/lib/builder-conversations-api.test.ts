import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { apiUrl, envelope, httpError, rawPaged, respond, server } from '@/test/msw';

import {
    CREATE_AGENT_CONVERSATIONS_PAGE_SIZE,
    deleteCreateAgentConversation,
    getCreateAgentConversationMessages,
    getCreateAgentConversationsPage,
    getSkill,
    renameCreateAgentConversation,
    updateSkill,
} from './builder-conversations-api';

const CONVERSATIONS_PATH = '/assistant/agent-builder/conversations';

interface RawMessage {
    _id: string;
    conversation_id?: string;
    agent_id?: string;
    role?: string;
    title?: string;
    content?: unknown[];
    metadata?: { title?: string } | null;
    created_at?: string;
    updated_at?: string;
}

const textPart = (text: string) => ({ type: 'text', text });

const message = (overrides: Partial<RawMessage> & { _id: string }): RawMessage => ({
    conversation_id: 'conv-1',
    agent_id: 'agent-1',
    role: 'user',
    content: [textPart('Build me a bot')],
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
});

describe('getCreateAgentConversationsPage', () => {
    it('groups messages into one conversation per conversation_id and maps page_info', async () => {
        server.use(
            respond('get', CONVERSATIONS_PATH, () =>
                envelope(
                    rawPaged(
                        [
                            message({ _id: 'm1', conversation_id: 'conv-1' }),
                            message({ _id: 'm2', conversation_id: 'conv-1' }),
                            message({ _id: 'm3', conversation_id: 'conv-2', content: [textPart('Second thread')] }),
                        ],
                        { page: 1, totalPages: 4, totalCount: 42 },
                    ),
                ),
            ),
        );

        const result = await getCreateAgentConversationsPage('agent-1', 1);

        expect(result.conversations.map((conversation) => conversation._id)).toEqual(['conv-1', 'conv-2']);
        expect(result.conversations[1].title).toBe('Second thread');
        expect(result.pageInfo).toEqual({ page: 1, totalPages: 4, totalCount: 42 });
    });

    it('sends agentId, page and the default page size as query params', async () => {
        let requestUrl = '';

        server.use(
            http.get(apiUrl(CONVERSATIONS_PATH), ({ request }) => {
                requestUrl = request.url;

                return envelope(rawPaged<RawMessage>([]));
            }),
        );

        await getCreateAgentConversationsPage('agent-7', 3);

        const params = new URL(requestUrl).searchParams;

        expect(params.get('agentId')).toBe('agent-7');
        expect(params.get('page')).toBe('3');
        expect(params.get('size')).toBe(String(CREATE_AGENT_CONVERSATIONS_PAGE_SIZE));
    });

    it('prefers the user message over an assistant message for the title', async () => {
        server.use(
            respond('get', CONVERSATIONS_PATH, () =>
                envelope(
                    rawPaged([
                        message({
                            _id: 'm1',
                            role: 'assistant',
                            content: [textPart('Sure, here is your agent')],
                            created_at: '2026-01-01T00:00:00.000Z',
                        }),
                        message({
                            _id: 'm2',
                            role: 'user',
                            content: [textPart('Make a support bot')],
                            created_at: '2026-01-02T00:00:00.000Z',
                        }),
                    ]),
                ),
            ),
        );

        const result = await getCreateAgentConversationsPage('agent-1', 0);

        expect(result.conversations[0].title).toBe('Make a support bot');
    });

    it('prefers the earlier message when both candidates share a role', async () => {
        server.use(
            respond('get', CONVERSATIONS_PATH, () =>
                envelope(
                    rawPaged([
                        message({
                            _id: 'm1',
                            content: [textPart('Later ask')],
                            created_at: '2026-02-02T00:00:00.000Z',
                        }),
                        message({
                            _id: 'm2',
                            content: [textPart('Earlier ask')],
                            created_at: '2026-01-01T00:00:00.000Z',
                        }),
                    ]),
                ),
            ),
        );

        const result = await getCreateAgentConversationsPage('agent-1', 0);

        expect(result.conversations[0].title).toBe('Earlier ask');
    });

    it('skips messages belonging to a different agent', async () => {
        server.use(
            respond('get', CONVERSATIONS_PATH, () =>
                envelope(
                    rawPaged([
                        message({ _id: 'm1', conversation_id: 'conv-1', agent_id: 'other-agent' }),
                        message({ _id: 'm2', conversation_id: 'conv-2', content: [textPart('Mine')] }),
                    ]),
                ),
            ),
        );

        const result = await getCreateAgentConversationsPage('agent-1', 0);

        expect(result.conversations).toHaveLength(1);
        expect(result.conversations[0]._id).toBe('conv-2');
    });

    it('falls back through title, metadata.title, part text and finally "New chat"', async () => {
        server.use(
            respond('get', CONVERSATIONS_PATH, () =>
                envelope(
                    rawPaged([
                        message({ _id: 'm1', conversation_id: 'conv-title', title: 'Explicit title' }),
                        message({
                            _id: 'm2',
                            conversation_id: 'conv-meta',
                            content: [],
                            metadata: { title: 'Metadata title' },
                        }),
                        message({
                            _id: 'm3',
                            conversation_id: 'conv-empty',
                            content: [],
                            metadata: null,
                        }),
                    ]),
                ),
            ),
        );

        const result = await getCreateAgentConversationsPage('agent-1', 0);
        const titles = Object.fromEntries(
            result.conversations.map((conversation) => [conversation._id, conversation.title]),
        );

        expect(titles['conv-title']).toBe('Explicit title');
        expect(titles['conv-meta']).toBe('Metadata title');
        expect(titles['conv-empty']).toBe('New chat');
    });

    it('truncates a title longer than 80 characters', async () => {
        const long = 'a'.repeat(120);

        server.use(respond('get', CONVERSATIONS_PATH, () => envelope(rawPaged([message({ _id: 'm1', title: long })]))));

        const result = await getCreateAgentConversationsPage('agent-1', 0);

        expect(result.conversations[0].title).toBe(`${'a'.repeat(77)}...`);
    });

    it('falls back to the message id when conversation_id is absent', async () => {
        server.use(
            respond('get', CONVERSATIONS_PATH, () =>
                envelope(rawPaged([message({ _id: 'orphan', conversation_id: undefined })])),
            ),
        );

        const result = await getCreateAgentConversationsPage('agent-1', 0);

        expect(result.conversations[0]._id).toBe('orphan');
    });

    it('synthesises page info when the response is a bare array', async () => {
        server.use(respond('get', CONVERSATIONS_PATH, () => envelope([message({ _id: 'm1' })])));

        const result = await getCreateAgentConversationsPage('agent-1', 2);

        expect(result.conversations).toHaveLength(1);
        expect(result.pageInfo).toEqual({ page: 2, totalPages: 1, totalCount: 1 });
    });

    it('rejects on HTTP 500 rather than degrading into an empty page', async () => {
        server.use(respond('get', CONVERSATIONS_PATH, () => httpError(500)));

        await expect(getCreateAgentConversationsPage('agent-1', 0)).rejects.toThrow();
    });

    it('rejects when the envelope reports success: false', async () => {
        server.use(
            respond('get', CONVERSATIONS_PATH, () =>
                Response.json({
                    success: false,
                    message: 'Builder unavailable',
                    value: null,
                }),
            ),
        );

        await expect(getCreateAgentConversationsPage('agent-1', 5)).rejects.toThrow('Builder unavailable');
    });
});

describe('getCreateAgentConversationMessages', () => {
    const messagesPath = `${CONVERSATIONS_PATH}/conv-1/messages`;

    it('keeps only user and assistant messages and maps content to parts', async () => {
        server.use(
            respond('get', messagesPath, () =>
                envelope(
                    rawPaged([
                        message({ _id: 'm1', role: 'user', content: [textPart('Hello')] }),
                        message({ _id: 'm2', role: 'assistant', content: [textPart('Hi')] }),
                        message({ _id: 'm3', role: 'system', content: [textPart('ignored')] }),
                    ]),
                ),
            ),
        );

        const result = await getCreateAgentConversationMessages('conv-1');

        expect(result).toEqual([
            { id: 'm1', role: 'user', parts: [textPart('Hello')] },
            { id: 'm2', role: 'assistant', parts: [textPart('Hi')] },
        ]);
    });

    it('drops messages belonging to another conversation', async () => {
        server.use(
            respond('get', messagesPath, () =>
                envelope(
                    rawPaged([
                        message({ _id: 'm1', conversation_id: 'conv-1' }),
                        message({ _id: 'm2', conversation_id: 'conv-9' }),
                    ]),
                ),
            ),
        );

        const result = await getCreateAgentConversationMessages('conv-1');

        expect(result.map((entry) => entry.id)).toEqual(['m1']);
    });

    it('passes agentId through when supplied', async () => {
        let requestUrl = '';

        server.use(
            http.get(apiUrl(messagesPath), ({ request }) => {
                requestUrl = request.url;

                return envelope(rawPaged<RawMessage>([]));
            }),
        );

        await getCreateAgentConversationMessages('conv-1', 'agent-3');

        expect(new URL(requestUrl).searchParams.get('agentId')).toBe('agent-3');
    });

    it('settles unfinished tool parts to output-available when the conversation ended ready', async () => {
        server.use(
            respond('get', messagesPath, () =>
                envelope(
                    rawPaged([
                        message({
                            _id: 'm1',
                            role: 'assistant',
                            content: [
                                { type: 'data-conversation', data: { status: 'ready' } },
                                { type: 'tool-create_agent', state: 'input-available', toolName: 'create_agent' },
                            ],
                        }),
                    ]),
                ),
            ),
        );

        const [restored] = await getCreateAgentConversationMessages('conv-1');
        const toolPart = restored.parts[1] as { state: string; output: unknown };

        expect(toolPart.state).toBe('output-available');
        expect(toolPart.output).toEqual({ success: true });
    });

    it('settles unfinished tool parts to output-error when the conversation ended failed', async () => {
        server.use(
            respond('get', messagesPath, () =>
                envelope(
                    rawPaged([
                        message({
                            _id: 'm1',
                            role: 'assistant',
                            content: [
                                { type: 'data-conversation', data: { status: 'failed' } },
                                { type: 'dynamic-tool', state: 'input-streaming', toolName: 'update_agent' },
                            ],
                        }),
                    ]),
                ),
            ),
        );

        const [restored] = await getCreateAgentConversationMessages('conv-1');
        const toolPart = restored.parts[1] as { state: string; errorText: string };

        expect(toolPart.state).toBe('output-error');
        expect(toolPart.errorText).toBe('Tool did not complete before the conversation ended.');
    });

    it('leaves the ask_user human-input tool untouched', async () => {
        server.use(
            respond('get', messagesPath, () =>
                envelope(
                    rawPaged([
                        message({
                            _id: 'm1',
                            role: 'assistant',
                            content: [
                                { type: 'data-conversation', data: { status: 'ready' } },
                                { type: 'tool-ask_user', state: 'input-available' },
                            ],
                        }),
                    ]),
                ),
            ),
        );

        const [restored] = await getCreateAgentConversationMessages('conv-1');

        expect((restored.parts[1] as { state: string }).state).toBe('input-available');
    });

    it('leaves every human-input tool untouched, not just ask_user', async () => {
        server.use(
            respond('get', messagesPath, () =>
                envelope(
                    rawPaged([
                        message({
                            _id: 'm1',
                            role: 'assistant',
                            content: [
                                { type: 'data-conversation', data: { status: 'ready' } },
                                { type: 'tool-request_input', state: 'input-available' },
                                { type: 'tool-confirm_action', state: 'input-available' },
                                { type: 'tool-collect_data_store_credentials', state: 'input-streaming' },
                            ],
                        }),
                    ]),
                ),
            ),
        );

        const [restored] = await getCreateAgentConversationMessages('conv-1');
        const states = restored.parts.slice(1).map((part) => (part as { state: string }).state);

        expect(states).toEqual(['input-available', 'input-available', 'input-streaming']);
    });

    it('leaves tool parts alone when the conversation never reached a terminal status', async () => {
        server.use(
            respond('get', messagesPath, () =>
                envelope(
                    rawPaged([
                        message({
                            _id: 'm1',
                            role: 'assistant',
                            content: [
                                { type: 'data-conversation', data: { status: 'generating' } },
                                { type: 'tool-create_agent', state: 'input-available' },
                            ],
                        }),
                    ]),
                ),
            ),
        );

        const [restored] = await getCreateAgentConversationMessages('conv-1');

        expect((restored.parts[1] as { state: string }).state).toBe('input-available');
    });

    it('accepts a bare array response', async () => {
        server.use(respond('get', messagesPath, () => envelope([message({ _id: 'm1', role: 'user' })])));

        const result = await getCreateAgentConversationMessages('conv-1');

        expect(result).toHaveLength(1);
    });

    it('falls back to the paged conversations endpoint when the messages endpoint fails', async () => {
        server.use(respond('get', messagesPath, () => httpError(500)));
        server.use(
            respond('get', CONVERSATIONS_PATH, () =>
                envelope(
                    rawPaged([
                        message({
                            _id: 'm1',
                            conversation_id: 'conv-1',
                            role: 'user',
                            content: [textPart('From fallback')],
                        }),
                        message({ _id: 'm2', conversation_id: 'conv-2', role: 'user' }),
                    ]),
                ),
            ),
        );

        const result = await getCreateAgentConversationMessages('conv-1');

        expect(result).toEqual([{ id: 'm1', role: 'user', parts: [textPart('From fallback')] }]);
    });

    it('walks every page of the fallback endpoint', async () => {
        const requestedPages: string[] = [];

        server.use(respond('get', messagesPath, () => httpError(500)));
        server.use(
            http.get(apiUrl(CONVERSATIONS_PATH), ({ request }) => {
                const page = new URL(request.url).searchParams.get('page') ?? '';

                requestedPages.push(page);

                return envelope(
                    rawPaged([message({ _id: `m-${page}`, conversation_id: 'conv-1', role: 'user' })], {
                        totalPages: 3,
                    }),
                );
            }),
        );

        const result = await getCreateAgentConversationMessages('conv-1');

        expect(requestedPages.sort()).toEqual(['0', '1', '2']);
        expect(result.map((entry) => entry.id).sort()).toEqual(['m-0', 'm-1', 'm-2']);
    });

    it('rejects when both the messages and the fallback endpoint fail', async () => {
        server.use(respond('get', messagesPath, () => httpError(500)));
        server.use(respond('get', CONVERSATIONS_PATH, () => httpError(500)));

        await expect(getCreateAgentConversationMessages('conv-1')).rejects.toThrow();
    });
});

describe('conversation mutations', () => {
    it('sends the new title in the PATCH body and the agentId as a param', async () => {
        let body: unknown;
        let requestUrl = '';

        server.use(
            http.patch(apiUrl(`${CONVERSATIONS_PATH}/conv-1`), async ({ request }) => {
                body = await request.json();
                requestUrl = request.url;

                return envelope(null);
            }),
        );

        await renameCreateAgentConversation('conv-1', 'Renamed thread', 'agent-2');

        expect(body).toEqual({ title: 'Renamed thread' });
        expect(new URL(requestUrl).searchParams.get('agentId')).toBe('agent-2');
    });

    it('omits the agentId param when no agent is supplied', async () => {
        let requestUrl = '';

        server.use(
            http.delete(apiUrl(`${CONVERSATIONS_PATH}/conv-1`), ({ request }) => {
                requestUrl = request.url;

                return envelope(null);
            }),
        );

        await deleteCreateAgentConversation('conv-1');

        expect(new URL(requestUrl).searchParams.has('agentId')).toBe(false);
    });

    it('rejects when the delete fails', async () => {
        server.use(respond('delete', `${CONVERSATIONS_PATH}/conv-1`, () => httpError(500)));

        await expect(deleteCreateAgentConversation('conv-1')).rejects.toThrow();
    });
});

describe('skill endpoints', () => {
    const skill = {
        _id: 'skill-1',
        skill_name: 'summarise',
        display_name: 'Summarise',
        short_description: 'Short',
        skill_description: 'Long',
        instructions: 'Do the thing',
    };

    it('unwraps the envelope for a single skill', async () => {
        server.use(respond('get', '/skills/skill-1', () => envelope(skill)));

        await expect(getSkill('skill-1')).resolves.toEqual(skill);
    });

    it('patches only the supplied fields', async () => {
        let body: unknown;

        server.use(
            http.patch(apiUrl('/skills/skill-1'), async ({ request }) => {
                body = await request.json();

                return envelope({ ...skill, display_name: 'Renamed' });
            }),
        );

        const result = await updateSkill('skill-1', { display_name: 'Renamed' });

        expect(body).toEqual({ display_name: 'Renamed' });
        expect(result.display_name).toBe('Renamed');
    });

    it('throws the API message when the skill fetch reports success: false', async () => {
        server.use(
            respond('get', '/skills/skill-1', () =>
                Response.json({
                    success: false,
                    message: 'Skill not found',
                    value: null,
                }),
            ),
        );

        await expect(getSkill('skill-1')).rejects.toThrow('Skill not found');
    });
});
