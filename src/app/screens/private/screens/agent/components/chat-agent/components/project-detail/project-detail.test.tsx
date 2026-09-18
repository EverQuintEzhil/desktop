import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import type { ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentComposerContext } from '@/components/agent-chat/context/agent-composer-context';
import type { AgentComposerContextValue } from '@/components/agent-chat/types';
import { ChatHostProvider, createFluentMindConversationAdapter } from '@/components/chat-host';
import type { ChatHost } from '@/components/chat-host';
import { appConversationApi } from '@/lib/api/app/conversation';
import { routinesVisibleTenant } from '@/test/fixtures/auth';
import { apiUrl, envelope, failureEnvelope, httpError, pagedEnvelope, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import type { ChatAgentType } from '@/types/admin';

import ProjectDetail from './project-detail';

vi.mock('@/components/agent-chat/view/agent-chat-composer', () => ({
    default: ({ fixedSpaceName }: { fixedSpaceName?: string }) => <div>{`Composer for ${fixedSpaceName}`}</div>,
}));

vi.mock('./chat-tools-panel', () => ({
    default: () => <div>Connectors and skills panel</div>,
}));

vi.mock('@/components/instructions-editor', () => ({
    InstructionsEditor: ({ value, onChange }: { value: string; onChange: (next: string) => void }) => (
        <textarea
            aria-label="Instructions editor"
            value={value}
            onChange={(event) => onChange(event.currentTarget.value)}
        />
    ),
}));

const agent = {
    _id: 'agent-1',
    slug: 'test-agent',
    name: 'Test Agent',
    uiConfig: { componentType: 'chat', spaces: { enabled: true }, home: { search: { files: false } } },
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
    filesState: { onChangeFile: () => {} },
} as unknown as AgentComposerContextValue;

const owner = {
    _id: 'user-1',
    name: { first: 'Test', last: 'User' },
    email: 'test@example.com',
    role: 'owner',
};

const otherUser = {
    _id: 'user-2',
    name: { first: 'Ada', last: 'Lovelace' },
    email: 'ada@example.com',
    role: 'owner',
};

const rawProject = (overrides: Record<string, unknown> = {}) => ({
    _id: 'project-1',
    name: 'Marketing space',
    description: 'Campaign planning',
    instructions: '',
    members: [owner],
    creator: owner,
    createdAt: '2026-03-01T10:00:00.000Z',
    updatedAt: '2026-03-04T10:00:00.000Z',
    pinnedAt: null,
    ...overrides,
});

const rawChat = (overrides: Record<string, unknown> = {}) => ({
    _id: 'chat-1',
    title: 'Naming ideas',
    updated_at: '2026-03-04T09:00:00.000Z',
    favorited: false,
    is_public: false,
    status: 'completed',
    ...overrides,
});

interface DetailStubs {
    project?: Record<string, unknown> | null;
    chats?: Record<string, unknown>[];
    sharedChats?: Record<string, unknown>[];
    activities?: Record<string, unknown>[];
    files?: Record<string, unknown>[];
}

/** Every read `useProject` fans out to, plus the space picker the chat menu opens. */
const stubDetail = ({
    project = rawProject(),
    chats = [],
    sharedChats = [],
    activities = [],
    files = [],
}: DetailStubs = {}) => {
    server.use(
        respond('get', '/projects/project-1', () => envelope(project)),
        respond('get', '/projects/project-1/activities', () => pagedEnvelope(activities)),
        respond('get', '/projects', () => pagedEnvelope([project])),
        respond('get', '/files', () => pagedEnvelope(files)),
        http.get(apiUrl('/conversations'), ({ request }) => {
            const isShared = new URL(request.url).searchParams.get('shared') === 'true';

            return pagedEnvelope(isShared ? sharedChats : chats);
        }),
    );
};

const withProviders = (children: ReactNode) => (
    <ChatHostProvider value={chatHost}>
        <AgentComposerContext.Provider value={composerContext}>
            {children}
            <Toaster />
        </AgentComposerContext.Provider>
    </ChatHostProvider>
);

const renderProjectDetail = (route = '/agent/test-agent/spaces/project-1', detailAgent = agent) =>
    renderWithProviders(
        withProviders(
            <Routes>
                <Route
                    path="/agent/:agentSlug/spaces/:projectId"
                    element={<ProjectDetail agent={detailAgent} onSubmit={() => {}} />}
                />
                <Route path="/agent/:agentSlug/spaces" element={<div>Spaces list screen</div>} />
            </Routes>,
        ),
        { route, preloadedState: { tenant: routinesVisibleTenant } },
    );

const openChatMenu = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole('button', { name: 'Chat options' }));
};

describe('Space detail', () => {
    beforeEach(() => {
        server.use(
            respond('get', '/routines', () => pagedEnvelope([])),
            respond('get', '/routines/runs', () => pagedEnvelope([])),
        );
    });

    it('names the agent the space belongs to and links back to it', async () => {
        stubDetail();

        renderProjectDetail();

        expect(await screen.findByRole('link', { name: 'Agent: Test Agent' })).toHaveAttribute(
            'href',
            '/agent/test-agent',
        );
    });

    it('prefers the launcher name when the agent is reached through one', async () => {
        stubDetail();

        renderProjectDetail('/agent/test-agent/spaces/project-1', {
            ...agent,
            launcher: { name: 'Sales Copilot' },
        } as unknown as ChatAgentType);

        expect(await screen.findByRole('link', { name: 'Agent: Sales Copilot' })).toBeInTheDocument();
    });

    it('offers the scheduled routines card', async () => {
        stubDetail();

        renderProjectDetail();

        expect(await screen.findByRole('button', { name: 'New routine' })).toBeInTheDocument();
    });

    it('hides the scheduled routines card for an agent with routines turned off', async () => {
        stubDetail();

        renderProjectDetail('/agent/test-agent/spaces/project-1', {
            ...agent,
            uiConfig: { ...agent.uiConfig, routines: { enabled: false } },
        } as unknown as ChatAgentType);

        expect(await screen.findByRole('heading', { name: 'Marketing space' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'New routine' })).not.toBeInTheDocument();
    });

    it('renders the space header, description and space-bound composer', async () => {
        stubDetail();

        renderProjectDetail();

        expect(await screen.findByRole('heading', { name: 'Marketing space' })).toBeInTheDocument();
        expect(screen.getByText('Private')).toBeInTheDocument();
        expect(screen.getByText('Created by you')).toBeInTheDocument();
        expect(screen.getByText('Campaign planning')).toBeInTheDocument();
        expect(screen.getByText('Composer for Marketing space')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'All spaces' })).toBeInTheDocument();
    });

    it('shows access denied and links back when the space is not visible', async () => {
        const user = userEvent.setup();

        server.use(
            respond('get', '/projects/project-1', () => httpError(404)),
            respond('get', '/projects/project-1/activities', () => pagedEnvelope([])),
            respond('get', '/files', () => pagedEnvelope([])),
            respond('get', '/conversations', () => pagedEnvelope([])),
        );

        renderProjectDetail();

        expect(await screen.findByRole('heading', { name: 'Access Denied' })).toBeInTheDocument();

        await user.click(screen.getByRole('link', { name: 'Back to spaces' }));

        expect(await screen.findByText('Spaces list screen')).toBeInTheDocument();
    });

    it('treats the backend "no such project" envelope as access denied', async () => {
        server.use(
            respond('get', '/projects/project-1', () => failureEnvelope('There is no such project with id project-1')),
            respond('get', '/projects/project-1/activities', () => pagedEnvelope([])),
            respond('get', '/files', () => pagedEnvelope([])),
            respond('get', '/conversations', () => pagedEnvelope([])),
        );

        renderProjectDetail();

        expect(await screen.findByRole('heading', { name: 'Access Denied' })).toBeInTheDocument();
    });

    it('offers a retry for a non-access load failure', async () => {
        server.use(
            respond('get', '/projects/project-1', () => httpError(500)),
            respond('get', '/projects/project-1/activities', () => pagedEnvelope([])),
            respond('get', '/files', () => pagedEnvelope([])),
            respond('get', '/conversations', () => pagedEnvelope([])),
        );

        renderProjectDetail();

        expect(await screen.findByText("Couldn't load this space")).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    });

    it('shows the chats empty state', async () => {
        stubDetail();

        renderProjectDetail();

        expect(await screen.findByText('No chats in this space yet')).toBeInTheDocument();
    });

    it('lists chats with their status and public marker, first page only', async () => {
        const requests: URL[] = [];

        server.use(
            respond('get', '/projects/project-1', () => envelope(rawProject())),
            respond('get', '/projects/project-1/activities', () => pagedEnvelope([])),
            respond('get', '/files', () => pagedEnvelope([])),
            http.get(apiUrl('/conversations'), ({ request }) => {
                requests.push(new URL(request.url));

                return pagedEnvelope(
                    [
                        rawChat(),
                        rawChat({
                            _id: 'chat-2',
                            title: 'Launch copy',
                            is_public: true,
                            status: 'generating',
                        }),
                    ],
                    { page: 0, totalPages: 4, totalCount: 40 },
                );
            }),
        );

        renderProjectDetail();

        expect(await screen.findByText('Naming ideas')).toBeInTheDocument();
        expect(screen.getByText('Launch copy')).toBeInTheDocument();
        expect(screen.getByLabelText('Shared chat')).toBeInTheDocument();
        expect(screen.queryByLabelText('New response ready')).not.toBeInTheDocument();

        expect(requests).toHaveLength(1);
        expect(requests[0].searchParams.get('projectId')).toBe('project-1');
        expect(requests[0].searchParams.get('page')).toBe('0');
    });

    it('opens a chat from the list', async () => {
        stubDetail({ chats: [rawChat()] });

        renderProjectDetail();

        const link = await screen.findByRole('link', { name: /Naming ideas/ });

        expect(link).toHaveAttribute('href', '/agent/test-agent/chat/chat-1');
    });

    it('loads shared chats with shared=true when the shared tab is opened', async () => {
        const user = userEvent.setup();

        stubDetail({
            sharedChats: [
                rawChat({
                    _id: 'chat-shared',
                    title: 'Team retro',
                    creator: otherUser,
                }),
            ],
        });

        renderProjectDetail();

        await screen.findByText('No chats in this space yet');
        await user.click(screen.getByRole('tab', { name: 'Shared with you' }));

        expect(await screen.findByText('Team retro')).toBeInTheDocument();
        expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    });

    it('renders the activity feed', async () => {
        const user = userEvent.setup();

        stubDetail({
            activities: [
                {
                    _id: 'activity-1',
                    type: 'project_created',
                    actor_name: 'Ada Lovelace',
                    created_at: '2026-03-01T10:00:00.000Z',
                },
                {
                    _id: 'activity-2',
                    type: 'file_added',
                    actor_name: 'Ada Lovelace',
                    data: { name: 'brief.pdf' },
                    created_at: '2026-03-02T10:00:00.000Z',
                },
            ],
        });

        renderProjectDetail();

        await screen.findByText('No chats in this space yet');
        await user.click(screen.getByRole('tab', { name: 'Activity' }));

        expect(await screen.findByText('created this space')).toBeInTheDocument();
        expect(screen.getByText('added knowledge')).toBeInTheDocument();
        expect(screen.getByText('brief.pdf')).toBeInTheDocument();
    });

    it('shows the space files on the knowledge tab', async () => {
        const user = userEvent.setup();

        stubDetail({
            files: [
                {
                    _id: 'file-1',
                    name: 'brief.pdf',
                    extension: 'pdf',
                    size: 2048,
                    url: 'https://files.localhost/download/brief.pdf',
                    embedding_status: 'indexed',
                    created_at: '2026-03-02T10:00:00.000Z',
                },
            ],
        });

        renderProjectDetail();

        await screen.findByText('No chats in this space yet');
        await user.click(screen.getByRole('tab', { name: 'Knowledge' }));

        expect(await screen.findByText('brief.pdf')).toBeInTheDocument();
    });

    it('lists the files that originated in this space on the files tab', async () => {
        const user = userEvent.setup();
        const originRequests: URL[] = [];

        stubDetail();
        server.use(
            http.get(apiUrl('/files'), ({ request }) => {
                const url = new URL(request.url);

                if (!url.searchParams.get('projectChatId')) return pagedEnvelope([]);

                originRequests.push(url);

                return pagedEnvelope([
                    {
                        _id: 'file-9',
                        name: 'generated-chart.png',
                        title: 'generated-chart.png',
                        extension: 'png',
                        url: 'https://files.localhost/download/generated-chart.png',
                        meta: { size: 4096 },
                        created_at: '2026-03-03T10:00:00.000Z',
                        origin: { type: 'chat', project_id: 'project-1' },
                    },
                ]);
            }),
        );

        renderProjectDetail();

        await screen.findByText('No chats in this space yet');
        await user.click(screen.getByRole('tab', { name: 'Files' }));

        expect(await screen.findByText('generated-chart.png')).toBeInTheDocument();
        expect(originRequests[0].searchParams.get('projectChatId')).toBe('project-1');
        expect(originRequests[0].searchParams.get('agentId')).toBe('agent-1');
        expect(originRequests[0].searchParams.getAll('originTypes')).not.toContain('project');
    });

    it('pins a chat through the favorite endpoint', async () => {
        const user = userEvent.setup();
        let favoriteCalls = 0;

        stubDetail({ chats: [rawChat()] });
        server.use(
            http.put(apiUrl('/conversations/chat-1/favorite'), () => {
                favoriteCalls += 1;

                return envelope({ favorited: true, favoritedAt: 1 });
            }),
        );

        renderProjectDetail();

        await user.click(await screen.findByRole('button', { name: 'Pin' }));

        await waitFor(() => {
            expect(favoriteCalls).toBe(1);
        });
    });

    it('renames a chat with the new title in the request body', async () => {
        const user = userEvent.setup();
        let putBody: unknown;

        stubDetail({ chats: [rawChat()] });
        server.use(
            http.put(apiUrl('/conversations/chat-1'), async ({ request }) => {
                putBody = await request.json();

                return envelope(null);
            }),
        );

        renderProjectDetail();

        await screen.findByText('Naming ideas');
        await openChatMenu(user);
        await user.click(await screen.findByRole('menuitem', { name: 'Rename' }));

        const dialog = await screen.findByRole('dialog');
        const input = within(dialog).getByRole('textbox');

        await user.clear(input);
        await user.type(input, 'Better names');
        await user.click(within(dialog).getByRole('button', { name: 'Save' }));

        await waitFor(() => {
            expect(putBody).toEqual({ title: 'Better names' });
        });
    });

    it('makes a chat public through the conversation endpoint', async () => {
        const user = userEvent.setup();
        let putBody: unknown;

        stubDetail({ chats: [rawChat()] });
        server.use(
            http.put(apiUrl('/conversations/chat-1'), async ({ request }) => {
                putBody = await request.json();

                return envelope(null);
            }),
        );

        renderProjectDetail();

        await screen.findByText('Naming ideas');
        await openChatMenu(user);
        await user.click(await screen.findByRole('menuitem', { name: 'Make public' }));

        await waitFor(() => {
            expect(putBody).toEqual({ isPublic: true });
        });
    });

    it('removes a chat from the space by clearing its projectId', async () => {
        const user = userEvent.setup();
        let putBody: unknown;

        stubDetail({ chats: [rawChat()] });
        server.use(
            http.put(apiUrl('/conversations/chat-1'), async ({ request }) => {
                putBody = await request.json();

                return envelope(null);
            }),
        );

        renderProjectDetail();

        await screen.findByText('Naming ideas');
        await openChatMenu(user);
        await user.click(await screen.findByRole('menuitem', { name: 'Remove from space' }));

        const dialog = await screen.findByRole('alertdialog');

        await user.click(within(dialog).getByRole('button', { name: 'Remove' }));

        await waitFor(() => {
            expect(putBody).toEqual({ projectId: null });
        });
    });

    it('deletes a chat after confirmation', async () => {
        const user = userEvent.setup();
        let deleteCalls = 0;

        stubDetail({ chats: [rawChat()] });
        server.use(
            http.delete(apiUrl('/conversations/chat-1'), () => {
                deleteCalls += 1;

                return envelope(null);
            }),
        );

        renderProjectDetail();

        await screen.findByText('Naming ideas');
        await openChatMenu(user);
        await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));

        const dialog = await screen.findByRole('alertdialog');

        await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

        await waitFor(() => {
            expect(deleteCalls).toBe(1);
        });
    });

    it('pins the space from the more-actions menu', async () => {
        const user = userEvent.setup();
        let pinCalls = 0;

        stubDetail();
        server.use(
            http.put(apiUrl('/projects/project-1/pin'), () => {
                pinCalls += 1;

                return envelope(null);
            }),
        );

        renderProjectDetail();

        await user.click(await screen.findByRole('button', { name: 'More actions' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Pin' }));

        await waitFor(() => {
            expect(pinCalls).toBe(1);
        });
    });

    it('saves an edited space name as a partial patch', async () => {
        const user = userEvent.setup();
        let putBody: unknown;

        stubDetail();
        server.use(
            http.put(apiUrl('/projects/project-1'), async ({ request }) => {
                putBody = await request.json();

                return envelope(rawProject({ name: 'Growth space' }));
            }),
        );

        renderProjectDetail();

        await user.click(await screen.findByRole('button', { name: 'More actions' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Edit' }));

        const dialog = await screen.findByRole('dialog');
        const nameInput = within(dialog).getByLabelText(/Name/);

        await user.clear(nameInput);
        await user.type(nameInput, 'Growth space');
        await user.click(within(dialog).getByRole('button', { name: 'Save' }));

        await waitFor(() => {
            expect(putBody).toEqual({ name: 'Growth space' });
        });
    });

    it('deletes the space and returns to the spaces list', async () => {
        const user = userEvent.setup();
        let deleteCalls = 0;

        stubDetail();
        server.use(
            http.delete(apiUrl('/projects/project-1'), () => {
                deleteCalls += 1;

                return envelope(null);
            }),
        );

        renderProjectDetail();

        await user.click(await screen.findByRole('button', { name: 'More actions' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));

        const dialog = await screen.findByRole('alertdialog');

        await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

        expect(await screen.findByText('Spaces list screen')).toBeInTheDocument();
        expect(deleteCalls).toBe(1);
    });

    it('saves space instructions from the side panel', async () => {
        const user = userEvent.setup();
        let putBody: unknown;

        stubDetail();
        server.use(
            http.put(apiUrl('/projects/project-1'), async ({ request }) => {
                putBody = await request.json();

                return envelope(rawProject({ instructions: 'Always cite sources' }));
            }),
        );

        renderProjectDetail();

        await user.click(await screen.findByRole('button', { name: 'Add instructions' }));
        await user.type(await screen.findByLabelText('Instructions editor'), 'Always cite sources');
        await user.click(screen.getByRole('button', { name: 'Save instructions' }));

        await waitFor(() => {
            expect(putBody).toEqual({ instructions: 'Always cite sources' });
        });
    });

    it('hides owner-only actions from a member', async () => {
        const user = userEvent.setup();

        stubDetail({
            project: rawProject({
                creator: otherUser,
                members: [otherUser, { ...owner, role: 'editor' }],
            }),
        });

        renderProjectDetail();

        expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'More actions' }));

        expect(await screen.findByRole('menuitem', { name: 'Pin' })).toBeInTheDocument();
        expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument();
        expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument();
    });

    it('shows read-only instructions to a viewer', async () => {
        stubDetail({
            project: rawProject({
                creator: otherUser,
                members: [otherUser, { ...owner, role: 'viewer' }],
            }),
        });

        renderProjectDetail();

        expect(await screen.findByText('No instructions added for this space')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Add instructions' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument();
    });

    it('opens the tab named in the query string', async () => {
        stubDetail();

        renderProjectDetail('/agent/test-agent/spaces/project-1?tab=activity');

        expect(await screen.findByText('No activity yet')).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Activity' })).toHaveAttribute('data-state', 'active');
    });

    it('falls back to the chats tab for an unknown tab value', async () => {
        stubDetail();

        renderProjectDetail('/agent/test-agent/spaces/project-1?tab=nonsense');

        expect(await screen.findByText('No chats in this space yet')).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Your chats' })).toHaveAttribute('data-state', 'active');
    });

    it('writes the selected tab back to the query string', async () => {
        const user = userEvent.setup();

        stubDetail();

        renderProjectDetail();

        await screen.findByText('No chats in this space yet');
        await user.click(screen.getByRole('tab', { name: 'Files' }));

        await waitFor(() => {
            expect(screen.getByRole('tab', { name: 'Files' })).toHaveAttribute('data-state', 'active');
        });
        expect(screen.queryByText('Your chats are private until shared')).toBeInTheDocument();
    });

    it('shows the shared-chats empty state', async () => {
        const user = userEvent.setup();

        stubDetail();

        renderProjectDetail();

        await screen.findByText('No chats in this space yet');
        await user.click(screen.getByRole('tab', { name: 'Shared with you' }));

        expect(await screen.findByText('No shared chats yet')).toBeInTheDocument();
        expect(screen.queryByText('Your chats are private until shared')).not.toBeInTheDocument();
    });

    it('renders a shared-chat activity with its preview and open link', async () => {
        const user = userEvent.setup();

        stubDetail({
            activities: [
                {
                    _id: 'activity-3',
                    type: 'conversation_shared',
                    actor_name: 'Ada Lovelace',
                    data: {
                        title: 'Pricing debate',
                        conversationId: 'chat-7',
                        messagePreview: '  What should we charge?  ',
                    },
                    created_at: '2026-03-03T10:00:00.000Z',
                },
            ],
        });

        renderProjectDetail();

        await screen.findByText('No chats in this space yet');
        await user.click(screen.getByRole('tab', { name: 'Activity' }));

        expect(await screen.findByText('shared a chat')).toBeInTheDocument();
        expect(screen.getByText('What should we charge?')).toBeInTheDocument();
        expect(screen.getByText('Pricing debate')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Open shared chat' })).toHaveAttribute(
            'href',
            '/agent/test-agent/chat/chat-7',
        );
    });

    it('describes member activity and falls back for an unknown type', async () => {
        const user = userEvent.setup();

        stubDetail({
            activities: [
                {
                    _id: 'a1',
                    type: 'member_added',
                    actor_name: 'Ada',
                    created_at: '2026-03-03T10:00:00.000Z',
                },
                {
                    _id: 'a2',
                    type: 'member_role_changed',
                    actor_name: 'Ada',
                    created_at: '2026-03-03T10:00:00.000Z',
                },
                {
                    _id: 'a3',
                    type: 'member_removed',
                    actor_name: 'Ada',
                    created_at: '2026-03-03T10:00:00.000Z',
                },
                {
                    _id: 'a4',
                    type: 'conversation_unshared',
                    actor_name: 'Ada',
                    created_at: '2026-03-03T10:00:00.000Z',
                },
                {
                    _id: 'a5',
                    type: 'file_removed',
                    actor_name: 'Ada',
                    created_at: '2026-03-03T10:00:00.000Z',
                },
                {
                    _id: 'a6',
                    type: 'something_new',
                    actor_name: 'Ada',
                    created_at: '2026-03-03T10:00:00.000Z',
                },
            ],
        });

        renderProjectDetail();

        await screen.findByText('No chats in this space yet');
        await user.click(screen.getByRole('tab', { name: 'Activity' }));

        expect(await screen.findByText('added a member')).toBeInTheDocument();
        expect(screen.getByText("changed a member's access")).toBeInTheDocument();
        expect(screen.getByText('removed a member')).toBeInTheDocument();
        expect(screen.getByText('unshared a chat')).toBeInTheDocument();
        expect(screen.getByText('removed knowledge')).toBeInTheDocument();
        expect(screen.getByText('updated the space')).toBeInTheDocument();
    });

    it('closes the rename dialog without a request when the title is unchanged', async () => {
        const user = userEvent.setup();
        let putCalls = 0;

        stubDetail({ chats: [rawChat()] });
        server.use(
            http.put(apiUrl('/conversations/chat-1'), () => {
                putCalls += 1;

                return envelope(null);
            }),
        );

        renderProjectDetail();

        await screen.findByText('Naming ideas');
        await openChatMenu(user);
        await user.click(await screen.findByRole('menuitem', { name: 'Rename' }));

        const dialog = await screen.findByRole('dialog');

        await user.click(within(dialog).getByRole('button', { name: 'Save' }));

        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
        expect(putCalls).toBe(0);
    });

    it('keeps Save disabled while the rename box is blank', async () => {
        const user = userEvent.setup();

        stubDetail({ chats: [rawChat()] });

        renderProjectDetail();

        await screen.findByText('Naming ideas');
        await openChatMenu(user);
        await user.click(await screen.findByRole('menuitem', { name: 'Rename' }));

        const dialog = await screen.findByRole('dialog');

        await user.clear(within(dialog).getByRole('textbox'));

        expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();
    });

    it('moves a chat into another space', async () => {
        const user = userEvent.setup();
        let putBody: unknown;

        stubDetail({ chats: [rawChat()] });
        server.use(
            respond('get', '/projects', () =>
                pagedEnvelope([rawProject(), rawProject({ _id: 'project-2', name: 'Sales space' })]),
            ),
            http.put(apiUrl('/conversations/chat-1'), async ({ request }) => {
                putBody = await request.json();

                return envelope(null);
            }),
        );

        renderProjectDetail();

        await screen.findByText('Naming ideas');
        await openChatMenu(user);
        await user.click(await screen.findByRole('menuitem', { name: 'Change space' }));
        // `user.click` does not select an item inside a Radix submenu under jsdom
        // (the pointer sequence never reaches the item), so dispatch the click directly.
        fireEvent.click(await screen.findByRole('menuitem', { name: 'Sales space' }));

        await waitFor(() => {
            expect(putBody).toEqual({ projectId: 'project-2' });
        });
        expect(await screen.findByText('Moved to selected space successfully')).toBeInTheDocument();
    });

    it('reports a failed visibility change', async () => {
        const user = userEvent.setup();

        stubDetail({ chats: [rawChat()] });
        server.use(http.put(apiUrl('/conversations/chat-1'), () => httpError(500)));

        renderProjectDetail();

        await screen.findByText('Naming ideas');
        await openChatMenu(user);
        await user.click(await screen.findByRole('menuitem', { name: 'Make public' }));

        expect(await screen.findByText('Failed to update sharing')).toBeInTheDocument();
    });

    it('reports a failed space pin', async () => {
        const user = userEvent.setup();

        stubDetail();
        server.use(http.put(apiUrl('/projects/project-1/pin'), () => httpError(500)));

        renderProjectDetail();

        await user.click(await screen.findByRole('button', { name: 'More actions' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Pin' }));

        expect(await screen.findByText('Failed to pin space')).toBeInTheDocument();
    });

    it('offers Unpin and reports its failure for an already pinned space', async () => {
        const user = userEvent.setup();

        stubDetail({ project: rawProject({ pinnedAt: '2026-03-04T10:00:00.000Z' }) });
        server.use(http.put(apiUrl('/projects/project-1/pin'), () => httpError(500)));

        renderProjectDetail();

        await user.click(await screen.findByRole('button', { name: 'More actions' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Unpin' }));

        expect(await screen.findByText('Failed to unpin space')).toBeInTheDocument();
    });

    it('keeps the user on the space when the delete fails', async () => {
        const user = userEvent.setup();

        stubDetail();
        server.use(http.delete(apiUrl('/projects/project-1'), () => httpError(500)));

        renderProjectDetail();

        await user.click(await screen.findByRole('button', { name: 'More actions' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));

        const dialog = await screen.findByRole('alertdialog');

        await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

        expect(await screen.findByText('Failed to delete space')).toBeInTheDocument();
        expect(screen.queryByText('Spaces list screen')).not.toBeInTheDocument();
    });

    it('reports a failed chat delete', async () => {
        const user = userEvent.setup();

        stubDetail({ chats: [rawChat()] });
        server.use(http.delete(apiUrl('/conversations/chat-1'), () => httpError(500)));

        renderProjectDetail();

        await screen.findByText('Naming ideas');
        await openChatMenu(user);
        await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));

        const dialog = await screen.findByRole('alertdialog');

        await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

        expect(await screen.findByText('Failed to delete chat')).toBeInTheDocument();
    });

    it('hides the chat search bar until the space has chats to search', async () => {
        stubDetail();

        renderProjectDetail();

        await screen.findByText('No chats in this space yet');

        expect(screen.queryByPlaceholderText('Search chats')).not.toBeInTheDocument();
    });

    it('shows the chat search bar once the space has chats', async () => {
        stubDetail({ chats: [rawChat()] });

        renderProjectDetail();

        await screen.findByText('Naming ideas');

        expect(screen.getByPlaceholderText('Search chats')).toBeInTheDocument();
    });

    it('hides the shared search bar until the space has shared chats', async () => {
        const user = userEvent.setup();

        stubDetail();

        renderProjectDetail();

        await screen.findByText('No chats in this space yet');
        await user.click(screen.getByRole('tab', { name: 'Shared with you' }));

        expect(await screen.findByText('No shared chats yet')).toBeInTheDocument();
        expect(screen.queryByPlaceholderText('Search shared chats')).not.toBeInTheDocument();
    });

    it('sends the typed chat search term to the conversations request', async () => {
        const user = userEvent.setup();
        const requests: URL[] = [];

        server.use(
            respond('get', '/projects/project-1', () => envelope(rawProject())),
            respond('get', '/projects/project-1/activities', () => pagedEnvelope([])),
            respond('get', '/files', () => pagedEnvelope([])),
            http.get(apiUrl('/conversations'), ({ request }) => {
                requests.push(new URL(request.url));

                return pagedEnvelope([rawChat()]);
            }),
        );

        renderProjectDetail();

        await screen.findByText('Naming ideas');
        await user.type(screen.getByPlaceholderText('Search chats'), 'naming');

        await waitFor(
            () => {
                expect(requests.at(-1)?.searchParams.get('search')).toBe('naming');
            },
            { timeout: 3000 },
        );
        expect(requests.at(-1)?.searchParams.get('projectId')).toBe('project-1');
    });

    it('keeps the chat search box and explains the miss when nothing matches', async () => {
        const user = userEvent.setup();

        server.use(
            respond('get', '/projects/project-1', () => envelope(rawProject())),
            respond('get', '/projects/project-1/activities', () => pagedEnvelope([])),
            respond('get', '/files', () => pagedEnvelope([])),
            http.get(apiUrl('/conversations'), ({ request }) => {
                const hasSearch = new URL(request.url).searchParams.get('search');

                return pagedEnvelope(hasSearch ? [] : [rawChat()]);
            }),
        );

        renderProjectDetail();

        await screen.findByText('Naming ideas');
        await user.type(screen.getByPlaceholderText('Search chats'), 'nope');

        expect(await screen.findByText('No matching chats')).toBeInTheDocument();
        expect(screen.getByText('No chats in this space match "nope".')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Search chats')).toBeInTheDocument();
    });

    it('sends the typed search term with shared=true from the shared tab', async () => {
        const user = userEvent.setup();
        const sharedRequests: URL[] = [];

        server.use(
            respond('get', '/projects/project-1', () => envelope(rawProject())),
            respond('get', '/projects/project-1/activities', () => pagedEnvelope([])),
            respond('get', '/files', () => pagedEnvelope([])),
            http.get(apiUrl('/conversations'), ({ request }) => {
                const url = new URL(request.url);

                if (url.searchParams.get('shared') !== 'true') return pagedEnvelope([]);

                sharedRequests.push(url);

                return pagedEnvelope([
                    rawChat({
                        _id: 'chat-shared',
                        title: 'Team retro',
                        creator: otherUser,
                    }),
                ]);
            }),
        );

        renderProjectDetail();

        await screen.findByText('No chats in this space yet');
        await user.click(screen.getByRole('tab', { name: 'Shared with you' }));

        await screen.findByText('Team retro');
        await user.type(screen.getByPlaceholderText('Search shared chats'), 'retro');

        await waitFor(
            () => {
                expect(sharedRequests.at(-1)?.searchParams.get('search')).toBe('retro');
            },
            { timeout: 3000 },
        );
        expect(sharedRequests.at(-1)?.searchParams.get('projectId')).toBe('project-1');
    });

    it('explains the miss when no shared chat matches the search', async () => {
        const user = userEvent.setup();

        server.use(
            respond('get', '/projects/project-1', () => envelope(rawProject())),
            respond('get', '/projects/project-1/activities', () => pagedEnvelope([])),
            respond('get', '/files', () => pagedEnvelope([])),
            http.get(apiUrl('/conversations'), ({ request }) => {
                const url = new URL(request.url);

                if (url.searchParams.get('shared') !== 'true') return pagedEnvelope([]);

                return pagedEnvelope(
                    url.searchParams.get('search')
                        ? []
                        : [rawChat({ _id: 'chat-shared', title: 'Team retro', creator: otherUser })],
                );
            }),
        );

        renderProjectDetail();

        await screen.findByText('No chats in this space yet');
        await user.click(screen.getByRole('tab', { name: 'Shared with you' }));

        await screen.findByText('Team retro');
        await user.type(screen.getByPlaceholderText('Search shared chats'), 'nope');

        expect(await screen.findByText('No matching chats')).toBeInTheDocument();
        expect(screen.getByText('No shared chats in this space match "nope".')).toBeInTheDocument();
    });

    it('pins both chat tab search bars under the tabs bar', async () => {
        const user = userEvent.setup();

        stubDetail({
            chats: [rawChat()],
            sharedChats: [rawChat({ _id: 'chat-shared', title: 'Team retro', creator: otherUser })],
        });

        const { container } = renderProjectDetail();

        await screen.findByText('Naming ideas');

        const chatsSearch = container.querySelector('.chats-list-search');

        expect(chatsSearch).toHaveClass('sticky');
        expect(chatsSearch).toHaveClass('top-[var(--space-tabs-h,0px)]');

        await user.click(screen.getByRole('tab', { name: 'Shared with you' }));

        const sharedSearch = await waitFor(() => {
            const node = container.querySelector('.shared-chats-list-search');

            expect(node).not.toBeNull();

            return node;
        });

        expect(sharedSearch).toHaveClass('sticky');
        expect(sharedSearch).toHaveClass('top-[var(--space-tabs-h,0px)]');
    });

    it('keeps a chat term typed just before a tab switch', async () => {
        const user = userEvent.setup();

        stubDetail({
            chats: [rawChat()],
            sharedChats: [rawChat({ _id: 'chat-shared', title: 'Team retro', creator: otherUser })],
        });

        renderProjectDetail();

        await screen.findByText('Naming ideas');
        // Deliberately no wait for the debounce: leaving the tab must commit the pending term
        // rather than drop it with the unmounting input.
        await user.type(screen.getByPlaceholderText('Search chats'), 'naming');
        await user.click(screen.getByRole('tab', { name: 'Shared with you' }));
        await user.click(screen.getByRole('tab', { name: 'Your chats' }));

        expect(await screen.findByPlaceholderText('Search chats')).toHaveValue('naming');
    });

    it('keeps each chat tab search independent of the other', async () => {
        const user = userEvent.setup();
        const requests: URL[] = [];

        server.use(
            respond('get', '/projects/project-1', () => envelope(rawProject())),
            respond('get', '/projects/project-1/activities', () => pagedEnvelope([])),
            respond('get', '/files', () => pagedEnvelope([])),
            http.get(apiUrl('/conversations'), ({ request }) => {
                const url = new URL(request.url);

                requests.push(url);

                return pagedEnvelope(
                    url.searchParams.get('shared') === 'true'
                        ? [rawChat({ _id: 'chat-shared', title: 'Team retro', creator: otherUser })]
                        : [rawChat()],
                );
            }),
        );

        renderProjectDetail();

        await screen.findByText('Naming ideas');
        await user.type(screen.getByPlaceholderText('Search chats'), 'naming');

        // The term is debounced, so it only reaches the query — and the state the tab switch
        // has to preserve — once the request goes out.
        await waitFor(
            () => {
                expect(requests.at(-1)?.searchParams.get('search')).toBe('naming');
            },
            { timeout: 3000 },
        );

        await user.click(screen.getByRole('tab', { name: 'Shared with you' }));

        const sharedInput = await screen.findByPlaceholderText('Search shared chats');

        expect(sharedInput).toHaveValue('');

        await user.click(screen.getByRole('tab', { name: 'Your chats' }));

        expect(await screen.findByPlaceholderText('Search chats')).toHaveValue('naming');
    });

    it('shows the shared badge and the space creator for a shared space', async () => {
        stubDetail({
            project: rawProject({
                creator: otherUser,
                members: [otherUser, { ...owner, role: 'editor' }],
            }),
        });

        renderProjectDetail();

        expect(await screen.findByText('Shared')).toBeInTheDocument();
        expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    });
});
