import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http } from 'msw';
import type { ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import Projects from '@/components/agent-chat/projects';
import { ChatHostProvider, createUnsupportedConversationAdapter } from '@/components/chat-host';
import type { ChatHost } from '@/components/chat-host';
import { apiUrl, envelope, failureEnvelope, httpError, pagedEnvelope, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import type { ChatAgentType } from '@/types/admin';

const agent = {
    _id: 'agent-1',
    slug: 'test-agent',
    name: 'Test Agent',
    uiConfig: { componentType: 'chat', spaces: { enabled: true } },
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
    conversations: createUnsupportedConversationAdapter(),
} as unknown as ChatHost;

const rawProject = (overrides: Record<string, unknown> = {}) => ({
    _id: 'project-1',
    name: 'Marketing space',
    description: 'Campaign planning',
    instructions: '',
    members: [],
    creator: { _id: 'user-1', name: { first: 'Test', last: 'User' }, email: 'test@example.com' },
    createdAt: '2026-03-01T10:00:00.000Z',
    updatedAt: '2026-03-04T10:00:00.000Z',
    pinnedAt: null,
    ...overrides,
});

const withHost = (children: ReactNode) => <ChatHostProvider value={chatHost}>{children}</ChatHostProvider>;

const renderProjects = () =>
    renderWithProviders(
        withHost(
            <Routes>
                <Route path="/agent/:agentSlug/spaces" element={<Projects agent={agent} />} />
                <Route path="/agent/:agentSlug/spaces/:projectId" element={<div>Space detail screen</div>} />
            </Routes>,
        ),
        { route: '/agent/test-agent/spaces' },
    );

describe('Spaces list', () => {
    it('shows a skeleton grid while the first page is in flight', () => {
        server.use(
            respond('get', '/projects', async () => {
                await delay('infinite');

                return pagedEnvelope([]);
            }),
        );

        const { container } = renderProjects();

        expect(screen.getByRole('heading', { name: 'Spaces' })).toBeInTheDocument();
        expect(container.querySelectorAll('.spaces-card').length).toBe(6);
    });

    it('names the agent the spaces belong to and links back to it', async () => {
        server.use(respond('get', '/projects', () => pagedEnvelope([rawProject()])));

        renderProjects();

        expect(await screen.findByRole('link', { name: 'Agent: Test Agent' })).toHaveAttribute(
            'href',
            '/agent/test-agent',
        );
    });

    it('renders the empty state for an owner with no spaces', async () => {
        server.use(respond('get', '/projects', () => pagedEnvelope([])));

        renderProjects();

        expect(await screen.findByText('No spaces yet')).toBeInTheDocument();
        expect(screen.getByText('Create a space to group chats, instructions, and files.')).toBeInTheDocument();
    });

    it('renders a card per space and asks for the first page only', async () => {
        const requests: URL[] = [];

        server.use(
            http.get(apiUrl('/projects'), ({ request }) => {
                requests.push(new URL(request.url));

                return pagedEnvelope(
                    [rawProject(), rawProject({ _id: 'project-2', name: 'Research space', description: '' })],
                    { totalCount: 2 },
                );
            }),
        );

        renderProjects();

        expect(await screen.findByText('Marketing space')).toBeInTheDocument();
        expect(screen.getByText('Research space')).toBeInTheDocument();
        expect(screen.getByText('Campaign planning')).toBeInTheDocument();
        expect(screen.getByText('No description')).toBeInTheDocument();

        expect(requests).toHaveLength(1);
        expect(requests[0].searchParams.get('agentId')).toBe('agent-1');
        expect(requests[0].searchParams.get('mineOnly')).toBe('true');
        expect(requests[0].searchParams.get('sortBy')).toBe('updatedAt:desc');
        expect(requests[0].searchParams.get('page')).toBe('0');
    });

    it('labels an already pinned space with the unpin action', async () => {
        server.use(
            respond('get', '/projects', () => pagedEnvelope([rawProject({ pinnedAt: '2026-03-05T10:00:00.000Z' })])),
        );

        renderProjects();

        await screen.findByText('Marketing space');
        expect(screen.getByRole('button', { name: 'Unpin space' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Pin space' })).not.toBeInTheDocument();
    });

    it('credits the creator on cards in the shared tab', async () => {
        const user = userEvent.setup();

        server.use(
            http.get(apiUrl('/projects'), ({ request }) => {
                const mineOnly = new URL(request.url).searchParams.get('mineOnly');

                if (mineOnly === 'false') {
                    return pagedEnvelope([
                        rawProject({
                            _id: 'project-shared',
                            name: 'Team space',
                            creator: {
                                _id: 'user-2',
                                name: { first: 'Other', last: 'Person' },
                                email: 'other@example.com',
                            },
                        }),
                    ]);
                }

                return pagedEnvelope([]);
            }),
        );

        renderProjects();

        await user.click(screen.getByRole('tab', { name: 'Shared with you' }));

        expect(await screen.findByText('Team space')).toBeInTheDocument();
        expect(screen.getByText('Other Person')).toBeInTheDocument();
    });

    it('shows the failure message when the list request errors', async () => {
        server.use(respond('get', '/projects', () => httpError(500)));

        renderProjects();

        expect(await screen.findByText('Failed to load spaces')).toBeInTheDocument();
    });

    it('shows the failure message when the API answers success:false', async () => {
        server.use(respond('get', '/projects', () => failureEnvelope('Nope')));

        renderProjects();

        expect(await screen.findByText('Failed to load spaces')).toBeInTheDocument();
    });

    it('refetches with mineOnly=false when switching to the shared tab', async () => {
        const user = userEvent.setup();
        const scopes: (string | null)[] = [];

        server.use(
            http.get(apiUrl('/projects'), ({ request }) => {
                const mineOnly = new URL(request.url).searchParams.get('mineOnly');

                scopes.push(mineOnly);

                if (mineOnly === 'false') return pagedEnvelope([]);

                return pagedEnvelope([rawProject()]);
            }),
        );

        renderProjects();

        await screen.findByText('Marketing space');

        await user.click(screen.getByRole('tab', { name: 'Shared with you' }));

        expect(await screen.findByText('Nothing shared with you yet')).toBeInTheDocument();
        expect(scopes).toContain('false');
    });

    it('refetches with the chosen sort order', async () => {
        const user = userEvent.setup();
        const sorts: (string | null)[] = [];

        server.use(
            http.get(apiUrl('/projects'), ({ request }) => {
                sorts.push(new URL(request.url).searchParams.get('sortBy'));

                return pagedEnvelope([rawProject()]);
            }),
        );

        renderProjects();

        await screen.findByText('Marketing space');

        await user.click(screen.getByRole('button', { name: /Last updated/ }));
        await user.click(await screen.findByRole('menuitem', { name: 'Name' }));

        await waitFor(() => {
            expect(sorts).toContain('name:asc');
        });
    });

    it('searches on Enter and offers to clear an empty search', async () => {
        const user = userEvent.setup();
        const searches: (string | null)[] = [];

        server.use(
            http.get(apiUrl('/projects'), ({ request }) => {
                const search = new URL(request.url).searchParams.get('search');

                searches.push(search);

                if (search) return pagedEnvelope([]);

                return pagedEnvelope([rawProject()]);
            }),
        );

        renderProjects();

        await screen.findByText('Marketing space');

        await user.type(screen.getByPlaceholderText('Search spaces...'), 'nothing{Enter}');

        expect(await screen.findByText('No spaces found')).toBeInTheDocument();
        expect(searches).toContain('nothing');

        await user.click(screen.getByRole('button', { name: 'Clear search' }));

        expect(await screen.findByText('Marketing space')).toBeInTheDocument();
    });

    it('pins a space through the pin endpoint', async () => {
        const user = userEvent.setup();
        let pinCalls = 0;

        server.use(
            respond('get', '/projects', () => pagedEnvelope([rawProject()])),
            http.put(apiUrl('/projects/project-1/pin'), () => {
                pinCalls += 1;

                return envelope(null);
            }),
        );

        renderProjects();

        await user.click(await screen.findByRole('button', { name: 'Pin space' }));

        await waitFor(() => {
            expect(pinCalls).toBe(1);
        });
    });

    it('creates a space and navigates to its detail page', async () => {
        const user = userEvent.setup();
        let postBody: unknown;

        server.use(
            respond('get', '/projects', () => pagedEnvelope([])),
            http.post(apiUrl('/projects'), async ({ request }) => {
                postBody = await request.json();

                return envelope(rawProject({ _id: 'project-new', name: 'Launch plan' }));
            }),
        );

        renderProjects();

        await user.click(screen.getByRole('button', { name: 'New space' }));

        const dialog = await screen.findByRole('dialog');

        await user.type(within(dialog).getByPlaceholderText('Space name'), 'Launch plan');
        await user.type(within(dialog).getByPlaceholderText('What is this space about?'), 'Q3 launch');
        await user.click(within(dialog).getByRole('button', { name: 'Create space' }));

        expect(await screen.findByText('Space detail screen')).toBeInTheDocument();
        expect(postBody).toEqual({
            name: 'Launch plan',
            agentId: 'agent-1',
            description: 'Q3 launch',
            instructions: '',
        });
    });

    it('opens a space when its card is clicked', async () => {
        const user = userEvent.setup();

        server.use(respond('get', '/projects', () => pagedEnvelope([rawProject()])));

        renderProjects();

        await user.click(await screen.findByRole('link', { name: /Marketing space/ }));

        expect(await screen.findByText('Space detail screen')).toBeInTheDocument();
    });
});
