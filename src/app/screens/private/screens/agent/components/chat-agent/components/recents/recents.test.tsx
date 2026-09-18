import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http } from 'msw';
import type { ReactNode } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AgentComposerContext } from '@/components/agent-chat/context/agent-composer-context';
import type { AgentComposerContextValue } from '@/components/agent-chat/types';
import { ChatHostProvider, createFluentMindConversationAdapter } from '@/components/chat-host';
import type { ChatHost } from '@/components/chat-host';
import { appConversationApi } from '@/lib/api/app/conversation';
import { apiUrl, envelope, failureEnvelope, httpError, pagedEnvelope, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import type { ChatAgentType } from '@/types/admin';
import type { Role } from '@/types/store';
import type { UiUsageConfigType } from '@/types/ui';

import Recents from './recents';

const agent = {
    _id: 'agent-1',
    slug: 'test-agent',
    name: 'Test Agent',
    uiConfig: { home: { search: { isIncognitoEnabled: false } } },
} as unknown as ChatAgentType;

const chatHost = {
    session: { user: { id: 'user-1' }, tenant: { id: 'tenant-1' } },
    transport: {
        endpoint: '/chat',
        baseUrl: 'https://api.localhost',
        filesBaseUrl: 'https://files.localhost',
        fetch: globalThis.fetch,
    },
    navigation: { setConversationId: () => {}, startNewConversation: () => {} },
    conversations: createFluentMindConversationAdapter(appConversationApi, { agentId: 'agent-1' }),
} as unknown as ChatHost;

const composerContext = {
    composer: {
        isIncognitoMode: false,
        toggleIncognitoMode: () => {},
    },
} as unknown as AgentComposerContextValue;

const rawHistory = (overrides: Record<string, unknown> = {}) => ({
    _id: 'chat-1',
    title: 'Naming ideas',
    created_at: '2026-03-04T09:00:00.000Z',
    updated_at: '2026-03-04T09:00:00.000Z',
    favorited: false,
    status: 'ready',
    ...overrides,
});

const withProviders = (children: ReactNode) => (
    <ChatHostProvider value={chatHost}>
        <AgentComposerContext.Provider value={composerContext}>{children}</AgentComposerContext.Provider>
    </ChatHostProvider>
);

const LocationProbe = () => {
    const location = useLocation();

    return <div>{`at ${location.pathname}`}</div>;
};

const costedHistory = () =>
    rawHistory({
        _id: 'chat-2',
        title: 'Costed chat',
        ai_info: { model: 'gpt-4o', token_usage: { input_tokens: 60, output_tokens: 40, total_tokens: 100 } },
    });

const agentWithUsageConfig = (usage: UiUsageConfigType) =>
    ({ ...agent, uiConfig: { ...agent.uiConfig, usage } }) as unknown as ChatAgentType;

interface RenderRecentsOptions {
    route?: string;
    recentsAgent?: ChatAgentType;
    role?: Role;
}

const renderRecents = ({
    route = '/agent/test-agent/search-chat',
    recentsAgent = agent,
    role = 'user',
}: RenderRecentsOptions = {}) =>
    renderWithProviders(
        withProviders(
            <>
                <LocationProbe />
                <Routes>
                    <Route path="/agent/:agentSlug/*" element={<Recents agent={recentsAgent} />} />
                </Routes>
            </>,
        ),
        { route, preloadedState: { user: { role } } },
    );

const openConversationMenu = async (index = 0) => {
    const triggers = await screen.findAllByRole('button', { name: 'Conversation actions' });

    await userEvent.click(triggers[index]);
};

describe('Recents', () => {
    it('prefixes the title with the agent it belongs to', async () => {
        server.use(respond('get', '/conversations', () => pagedEnvelope([])));

        renderRecents();

        expect(await screen.findByRole('heading', { name: 'Search Chats' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Agent: Test Agent' })).toHaveAttribute('href', '/agent/test-agent');
    });

    it('shows skeleton rows while the first page is in flight', async () => {
        server.use(
            respond('get', '/conversations', async () => {
                await delay('infinite');

                return pagedEnvelope([]);
            }),
        );

        const { container } = renderRecents();

        await waitFor(() => {
            expect(container.querySelectorAll('.recents-list-item').length).toBe(3);
        });
        expect(screen.queryByText('No conversations yet')).not.toBeInTheDocument();
    });

    it('shows the empty state when the agent has no conversations', async () => {
        server.use(respond('get', '/conversations', () => pagedEnvelope([])));

        renderRecents();

        expect(await screen.findByRole('heading', { name: 'Search Chats' })).toBeInTheDocument();
        expect(await screen.findByText('No conversations yet')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Clear All/ })).toBeDisabled();
    });

    it('lists conversations linked to the chat route, first page only', async () => {
        const requests: URL[] = [];

        server.use(
            http.get(apiUrl('/conversations'), ({ request }) => {
                requests.push(new URL(request.url));

                return pagedEnvelope(
                    [rawHistory(), rawHistory({ _id: 'chat-2', title: 'Launch copy', favorited: true })],
                    { page: 0, totalPages: 5, totalCount: 250 },
                );
            }),
        );

        renderRecents();

        const link = await screen.findByRole('link', { name: /Naming ideas/ });

        expect(link).toHaveAttribute('href', '/agent/test-agent/chat/chat-1');
        expect(screen.getByText('Launch copy')).toBeInTheDocument();

        expect(requests).toHaveLength(1);
        expect(requests[0].searchParams.get('agentId')).toBe('agent-1');
        expect(requests[0].searchParams.get('page')).toBe('0');
        expect(requests[0].searchParams.get('size')).toBe('50');
        expect(requests[0].searchParams.get('favorite')).toBeNull();
    });

    it('shows the error branch for a 500', async () => {
        server.use(respond('get', '/conversations', () => httpError(500)));

        renderRecents();

        expect(await screen.findByText('Error Occurred')).toBeInTheDocument();
    });

    it('shows the error branch when the API answers success:false', async () => {
        server.use(respond('get', '/conversations', () => failureEnvelope('Conversations unavailable')));

        renderRecents();

        expect(await screen.findByText('Error Occurred')).toBeInTheDocument();
    });

    it('sends the debounced search term and shows the no-results copy', async () => {
        const requests: URL[] = [];

        server.use(
            http.get(apiUrl('/conversations'), ({ request }) => {
                const url = new URL(request.url);

                requests.push(url);

                return pagedEnvelope(url.searchParams.get('search') ? [] : [rawHistory()]);
            }),
        );

        renderRecents();

        await screen.findByText('Naming ideas');
        await userEvent.type(screen.getByPlaceholderText('Search conversations...'), 'launch');

        await waitFor(
            () => {
                expect(requests[requests.length - 1].searchParams.get('search')).toBe('launch');
            },
            { timeout: 3000 },
        );

        expect(await screen.findByText('No conversations found')).toBeInTheDocument();
    });

    it('pins a conversation through the favorite endpoint', async () => {
        let favoriteCalls = 0;

        server.use(
            respond('get', '/conversations', () => pagedEnvelope([rawHistory()])),
            http.put(apiUrl('/conversations/chat-1/favorite'), () => {
                favoriteCalls += 1;

                return envelope({ favorited: true, favoritedAt: 1772000000000 });
            }),
        );

        renderRecents();

        await screen.findByText('Naming ideas');
        await openConversationMenu();
        await userEvent.click(await screen.findByRole('menuitem', { name: 'Pin' }));

        await waitFor(() => {
            expect(favoriteCalls).toBe(1);
        });
    });

    it('offers Unpin for a conversation that is already pinned', async () => {
        server.use(respond('get', '/conversations', () => pagedEnvelope([rawHistory({ favorited: true })])));

        renderRecents();

        await screen.findByText('Naming ideas');
        await openConversationMenu();

        expect(await screen.findByRole('menuitem', { name: 'Unpin' })).toBeInTheDocument();
        expect(screen.queryByRole('menuitem', { name: 'Pin' })).not.toBeInTheDocument();
    });

    it('deletes a conversation after confirmation and drops it from the list', async () => {
        let deletedUrl: URL | null = null;

        server.use(
            respond('get', '/conversations', () =>
                pagedEnvelope([rawHistory(), rawHistory({ _id: 'chat-2', title: 'Launch copy' })]),
            ),
            http.delete(apiUrl('/conversations/chat-1'), ({ request }) => {
                deletedUrl = new URL(request.url);

                return envelope(null);
            }),
        );

        renderRecents();

        await screen.findByText('Naming ideas');
        await openConversationMenu();
        await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));

        const dialog = await screen.findByRole('alertdialog');

        expect(within(dialog).getByText('Delete Confirmation')).toBeInTheDocument();
        await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));

        await waitFor(() => {
            expect(screen.queryByText('Naming ideas')).not.toBeInTheDocument();
        });
        expect(screen.getByText('Launch copy')).toBeInTheDocument();
        expect(deletedUrl!.searchParams.get('agentId')).toBe('agent-1');
    });

    it('clears every chat with force false from the first confirmation', async () => {
        let deleteBody: unknown;

        server.use(
            respond('get', '/conversations', () => pagedEnvelope([rawHistory()])),
            http.delete(apiUrl('/conversations'), async ({ request }) => {
                deleteBody = await request.json();

                return envelope(null);
            }),
        );

        renderRecents();

        await screen.findByText('Naming ideas');
        await userEvent.click(screen.getByRole('button', { name: /Clear All/ }));

        const dialog = await screen.findByRole('alertdialog');

        expect(within(dialog).getByText('Clear All Chats')).toBeInTheDocument();
        await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

        await waitFor(() => {
            expect(deleteBody).toEqual({ force: false });
        });
        expect(await screen.findByText('No conversations yet')).toBeInTheDocument();
    });

    it('escalates to a second confirmation for a permanent clear all', async () => {
        let deleteBody: unknown;

        server.use(
            respond('get', '/conversations', () => pagedEnvelope([rawHistory()])),
            http.delete(apiUrl('/conversations'), async ({ request }) => {
                deleteBody = await request.json();

                return envelope(null);
            }),
        );

        renderRecents();

        await screen.findByText('Naming ideas');
        await userEvent.click(screen.getByRole('button', { name: /Clear All/ }));
        await userEvent.click(await screen.findByRole('button', { name: /Permanently Delete/ }));

        expect(await screen.findByText('Clear All Chats Permanently?')).toBeInTheDocument();

        await userEvent.click(await screen.findByRole('button', { name: /Yes, Delete Permanently/ }));

        await waitFor(() => {
            expect(deleteBody).toEqual({ force: true });
        });
    });

    it('offers the AI usage dialog only when the conversation carries token usage', async () => {
        server.use(
            respond('get', '/conversations', () =>
                pagedEnvelope([
                    rawHistory(),
                    rawHistory({
                        _id: 'chat-2',
                        title: 'Costed chat',
                        ai_info: {
                            model: 'gpt-4o',
                            token_usage: { input_tokens: 60, output_tokens: 40, total_tokens: 100 },
                        },
                    }),
                ]),
            ),
        );

        renderRecents();

        await screen.findByText('Naming ideas');

        await openConversationMenu(0);
        expect(screen.queryByRole('menuitem', { name: 'AI Usage Info' })).not.toBeInTheDocument();
        await userEvent.keyboard('{Escape}');

        await openConversationMenu(1);
        await userEvent.click(await screen.findByRole('menuitem', { name: 'AI Usage Info' }));

        expect(await screen.findByRole('dialog')).toBeInTheDocument();
    });

    it('hides the AI usage item for an agent that hides usage', async () => {
        server.use(respond('get', '/conversations', () => pagedEnvelope([costedHistory()])));

        renderRecents({ recentsAgent: agentWithUsageConfig({ hidden: true }) });

        await screen.findByText('Costed chat');
        await openConversationMenu();

        expect(await screen.findByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
        expect(screen.queryByRole('menuitem', { name: 'AI Usage Info' })).not.toBeInTheDocument();
    });

    it('hides the AI usage item from a role the agent does not list', async () => {
        server.use(respond('get', '/conversations', () => pagedEnvelope([costedHistory()])));

        renderRecents({ recentsAgent: agentWithUsageConfig({ visibleToRoles: ['admin', 'owner'] }), role: 'user' });

        await screen.findByText('Costed chat');
        await openConversationMenu();

        expect(await screen.findByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
        expect(screen.queryByRole('menuitem', { name: 'AI Usage Info' })).not.toBeInTheDocument();
    });

    it('keeps the AI usage item for a role the agent lists', async () => {
        server.use(respond('get', '/conversations', () => pagedEnvelope([costedHistory()])));

        renderRecents({ recentsAgent: agentWithUsageConfig({ visibleToRoles: ['admin', 'owner'] }), role: 'admin' });

        await screen.findByText('Costed chat');
        await openConversationMenu();
        await userEvent.click(await screen.findByRole('menuitem', { name: 'AI Usage Info' }));

        expect(await screen.findByRole('dialog')).toBeInTheDocument();
    });

    it('starts a new chat from the header', async () => {
        server.use(respond('get', '/conversations', () => pagedEnvelope([])));

        renderRecents();

        await screen.findByText('No conversations yet');
        await userEvent.click(screen.getByRole('button', { name: /New Chat/ }));

        expect(await screen.findByText('at /agent/test-agent')).toBeInTheDocument();
    });
});
