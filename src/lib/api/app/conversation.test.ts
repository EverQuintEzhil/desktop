import { HttpResponse, http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiUrl, envelope, failureEnvelope, httpError, pagedEnvelope, rawPaged, respond, server } from '@/test/msw';

import { appConversationApi, getConversationExportErrorMessage } from './conversation';

interface Message {
    _id: string;
    text: string;
}

const message: Message = { _id: 'message-1', text: 'Hello' };

describe('appConversationApi.listConversations', () => {
    it('unwraps the envelope and maps page_info to pageInfo', async () => {
        server.use(
            respond('get', '/conversations', () =>
                pagedEnvelope([{ _id: 'chat-1' }], { page: 2, totalPages: 7, totalCount: 340 }),
            ),
        );

        const result = await appConversationApi.listConversations();

        expect(result.values).toEqual([{ _id: 'chat-1' }]);
        expect(result.pageInfo).toEqual({ page: 2, totalPages: 7, totalCount: 340 });
    });

    it('forwards query params to the request', async () => {
        let requestUrl = '';

        server.use(
            http.get(apiUrl('/conversations'), ({ request }) => {
                requestUrl = request.url;

                return pagedEnvelope([]);
            }),
        );

        await appConversationApi.listConversations({
            agentId: 'agent-1',
            page: 0,
            size: 50,
            search: 'launch',
        });

        const params = new URL(requestUrl).searchParams;

        expect(params.get('agentId')).toBe('agent-1');
        expect(params.get('page')).toBe('0');
        expect(params.get('size')).toBe('50');
        expect(params.get('search')).toBe('launch');
    });

    it('throws with the API message when success is false', async () => {
        server.use(respond('get', '/conversations', () => failureEnvelope('Conversations unavailable')));

        await expect(appConversationApi.listConversations()).rejects.toThrow('Conversations unavailable');
    });

    it('rejects on a non-2xx response', async () => {
        server.use(respond('get', '/conversations', () => httpError(503, 'Service unavailable')));

        await expect(appConversationApi.listConversations()).rejects.toThrow();
    });
});

describe('appConversationApi.getConversationMessages', () => {
    it('maps the paged list and carries head_id through as headId', async () => {
        server.use(
            respond('get', '/conversations/chat-1/messages', () =>
                HttpResponse.json({
                    success: true,
                    value: {
                        ...rawPaged([message], { page: 0, totalPages: 3, totalCount: 250 }),
                        head_id: 'message-9',
                    },
                }),
            ),
        );

        const result = await appConversationApi.getConversationMessages<Message>('chat-1');

        expect(result.values).toEqual([message]);
        expect(result.pageInfo).toEqual({ page: 0, totalPages: 3, totalCount: 250 });
        expect(result.headId).toBe('message-9');
    });

    it('preserves an explicit null head_id', async () => {
        server.use(
            respond('get', '/conversations/chat-1/messages', () =>
                HttpResponse.json({
                    success: true,
                    value: { ...rawPaged([message]), head_id: null },
                }),
            ),
        );

        const result = await appConversationApi.getConversationMessages<Message>('chat-1');

        expect(result.headId).toBeNull();
        expect('headId' in result).toBe(true);
    });

    it('omits headId entirely when the API does not send head_id', async () => {
        server.use(respond('get', '/conversations/chat-1/messages', () => envelope(rawPaged([message]))));

        const result = await appConversationApi.getConversationMessages<Message>('chat-1');

        expect('headId' in result).toBe(false);
    });

    it('forwards params to the messages endpoint', async () => {
        let requestUrl = '';

        server.use(
            http.get(apiUrl('/conversations/chat-1/messages'), ({ request }) => {
                requestUrl = request.url;

                return envelope(rawPaged([]));
            }),
        );

        await appConversationApi.getConversationMessages('chat-1', { agentId: 'agent-1', page: 1 });

        const params = new URL(requestUrl).searchParams;

        expect(params.get('agentId')).toBe('agent-1');
        expect(params.get('page')).toBe('1');
    });
});

describe('appConversationApi.listConversationsNew', () => {
    it('posts the search body to the agent search endpoint and maps the page info', async () => {
        let postBody: unknown;

        server.use(
            http.post(apiUrl('/agents/agent-1/conversations/search'), async ({ request }) => {
                postBody = await request.json();

                return pagedEnvelope([{ _id: 'chat-1' }], { page: 1, totalPages: 2, totalCount: 60 });
            }),
        );

        const result = await appConversationApi.listConversationsNew('agent-1', { search: 'launch' });

        expect(postBody).toEqual({ search: 'launch' });
        expect(result.pageInfo).toEqual({ page: 1, totalPages: 2, totalCount: 60 });
    });
});

describe('appConversationApi mutations', () => {
    it('sends the update body and query params for updateConversation', async () => {
        let putBody: unknown;
        let requestUrl = '';

        server.use(
            http.put(apiUrl('/conversations/chat-1'), async ({ request }) => {
                putBody = await request.json();
                requestUrl = request.url;

                return envelope({ _id: 'chat-1', title: 'Better name' });
            }),
        );

        const result = await appConversationApi.updateConversation<{ title: string }>(
            'chat-1',
            { title: 'Better name' },
            { agentId: 'agent-1' },
        );

        expect(putBody).toEqual({ title: 'Better name' });
        expect(new URL(requestUrl).searchParams.get('agentId')).toBe('agent-1');
        expect(result.title).toBe('Better name');
    });

    it('sends the force flag as a body on the delete-all endpoint', async () => {
        let deleteBody: unknown;

        server.use(
            http.delete(apiUrl('/conversations'), async ({ request }) => {
                deleteBody = await request.json();

                return envelope(null);
            }),
        );

        await appConversationApi.deleteAllConversations({ force: true }, { agentId: 'agent-1' });

        expect(deleteBody).toEqual({ force: true });
    });

    it('unwraps the favorite toggle response', async () => {
        server.use(
            respond('put', '/conversations/chat-1/favorite', () =>
                envelope({ favorited: true, favoritedAt: 1772000000000 }),
            ),
        );

        const result = await appConversationApi.toggleConversationFavorite<{ favorited: boolean }>('chat-1');

        expect(result).toEqual({ favorited: true, favoritedAt: 1772000000000 });
    });

    it('surfaces the API message when a mutation reports success:false', async () => {
        server.use(respond('put', '/conversations/chat-1', () => failureEnvelope('Conversation is read-only')));

        await expect(appConversationApi.updateConversation('chat-1', { title: 'x' })).rejects.toThrow(
            'Conversation is read-only',
        );
    });
});

describe('appConversationApi.exportConversation', () => {
    let clickSpy: ReturnType<typeof vi.spyOn>;
    let downloads: { href: string; download: string }[];

    beforeEach(() => {
        downloads = [];
        clickSpy = vi
            .spyOn(HTMLAnchorElement.prototype, 'click')
            .mockImplementation(function click(this: HTMLAnchorElement) {
                downloads.push({ href: this.href, download: this.download });
            });
        Object.defineProperty(window.URL, 'createObjectURL', {
            configurable: true,
            writable: true,
            value: () => 'blob:mock',
        });
        Object.defineProperty(window.URL, 'revokeObjectURL', {
            configurable: true,
            writable: true,
            value: () => {},
        });
    });

    afterEach(() => {
        clickSpy.mockRestore();
    });

    it('sends the format and agent, and saves the file the server names', async () => {
        let requestUrl = '';

        server.use(
            http.get(apiUrl('/conversations/chat-1/export'), ({ request }) => {
                requestUrl = request.url;

                return HttpResponse.text('# Launch plan', {
                    headers: {
                        'Content-Type': 'text/markdown',
                        'Content-Disposition': 'attachment; filename="launch-plan.md"',
                    },
                });
            }),
        );

        await appConversationApi.exportConversation({
            conversationId: 'chat-1',
            agentId: 'agent-1',
            format: 'markdown',
            title: 'Launch plan',
        });

        const params = new URL(requestUrl).searchParams;

        expect(params.get('format')).toBe('markdown');
        expect(params.get('agentId')).toBe('agent-1');
        expect(downloads).toEqual([{ href: 'blob:mock', download: 'launch-plan.md' }]);
    });

    it('names the file from the conversation title when the server does not', async () => {
        server.use(http.get(apiUrl('/conversations/chat-1/export'), () => HttpResponse.json({ messages: [] })));

        await appConversationApi.exportConversation({
            conversationId: 'chat-1',
            agentId: 'agent-1',
            format: 'json',
            title: 'Q3 / Launch plan',
        });

        expect(downloads).toEqual([{ href: 'blob:mock', download: 'q3-launch-plan.json' }]);
    });

    it('throws the API message instead of downloading a failure envelope', async () => {
        server.use(
            http.get(apiUrl('/conversations/chat-1/export'), () =>
                HttpResponse.json({ success: false, message: 'Conversation is no longer available', value: null }),
            ),
        );

        await expect(
            appConversationApi.exportConversation({
                conversationId: 'chat-1',
                agentId: 'agent-1',
                format: 'json',
            }),
        ).rejects.toThrow('Conversation is no longer available');

        expect(downloads).toHaveLength(0);
    });

    it('reads the API message out of a blob error response', async () => {
        server.use(
            http.get(apiUrl('/conversations/chat-1/export'), () =>
                HttpResponse.json(
                    { success: false, message: 'You cannot export this chat', value: null },
                    { status: 403 },
                ),
            ),
        );

        const error = await appConversationApi
            .exportConversation({
                conversationId: 'chat-1',
                agentId: 'agent-1',
                format: 'markdown',
            })
            .catch((caught: unknown) => caught);

        await expect(getConversationExportErrorMessage(error)).resolves.toBe('You cannot export this chat');
        expect(downloads).toHaveLength(0);
    });
});
