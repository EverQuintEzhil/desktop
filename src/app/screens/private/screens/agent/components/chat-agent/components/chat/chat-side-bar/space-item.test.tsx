import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import type { ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { describe, expect, it, vi } from 'vitest';

import { ChatHostProvider, createFluentMindConversationAdapter } from '@/components/chat-host';
import type { ChatHost } from '@/components/chat-host';
import { appConversationApi } from '@/lib/api/app/conversation';
import { apiUrl, envelope, pagedEnvelope, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import type { ChatAgentType } from '@/types/admin';
import { mapProject, type ProjectType } from '@/types/project';

import SpaceItem from './space-item';

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
    conversations: createFluentMindConversationAdapter(appConversationApi, { agentId: 'agent-1' }),
} as unknown as ChatHost;

const owner = {
    _id: 'user-1',
    name: { first: 'Test', last: 'User' },
    email: 'test@example.com',
    role: 'owner',
};

const project: ProjectType = mapProject({
    _id: 'project-1',
    name: 'Marketing space',
    members: [owner],
    creator: owner,
} as never);

const rawChat = (overrides: Record<string, unknown> = {}) => ({
    _id: 'chat-1',
    title: 'Naming ideas',
    updated_at: '2026-03-04T09:00:00.000Z',
    favorited: false,
    is_public: false,
    ...overrides,
});

interface Handlers {
    chats?: Record<string, unknown>[];
    totalPages?: number;
}

const stubChats = ({ chats = [rawChat()], totalPages = 1 }: Handlers = {}) => {
    const requests: URL[] = [];

    server.use(
        http.get(apiUrl('/conversations'), ({ request }) => {
            requests.push(new URL(request.url));

            return pagedEnvelope(chats, { page: 0, totalPages });
        }),
        respond('get', '/projects', () =>
            pagedEnvelope([
                { _id: 'project-1', name: 'Marketing space', members: [owner] },
                { _id: 'project-2', name: 'Sales space', members: [owner] },
            ]),
        ),
        respond('get', '/projects/project-1', () =>
            envelope({
                _id: 'project-1',
                name: 'Marketing space',
                members: [owner],
            }),
        ),
    );

    return requests;
};

interface RenderOptions {
    isOwner?: boolean;
    canEdit?: boolean;
    isPinned?: boolean;
    route?: string;
}

const renderItem = ({ isOwner = true, canEdit, isPinned = true, route = '/agent/test-agent' }: RenderOptions = {}) => {
    const onTogglePin = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const onShare = vi.fn();
    const onMobileClose = vi.fn();

    const element = (
        <ul>
            <SpaceItem
                project={project}
                agent={agent}
                isOwner={isOwner}
                canEdit={canEdit}
                isPinned={isPinned}
                onMobileClose={onMobileClose}
                onTogglePin={onTogglePin}
                onEdit={onEdit}
                onDelete={onDelete}
                onShare={onShare}
            />
        </ul>
    );

    const wrap = (children: ReactNode) => (
        <ChatHostProvider value={chatHost}>
            {children}
            <Toaster />
        </ChatHostProvider>
    );

    const view = renderWithProviders(
        wrap(
            <Routes>
                <Route path="/agent/:agentSlug/*" element={element} />
            </Routes>,
        ),
        { route },
    );

    return {
        ...view,
        onTogglePin,
        onEdit,
        onDelete,
        onShare,
        onMobileClose,
    };
};

const expand = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: /Marketing space/ }));
};

const chatRow = () => screen.getByRole('link', { name: /Naming ideas/ }).closest('li') as HTMLElement;

describe('SpaceItem', () => {
    it('renders collapsed without fetching, and only fetches once expanded', async () => {
        const user = userEvent.setup();
        const requests = stubChats();

        renderItem();

        expect(screen.getByText('Marketing space')).toBeInTheDocument();
        expect(requests).toHaveLength(0);

        // The zero above only means something if the same recorder can reach one.
        await expand(user);
        await screen.findByText('Naming ideas');

        expect(requests).toHaveLength(1);
    });

    it('loads the space chats on first expand', async () => {
        const user = userEvent.setup();
        const requests = stubChats();

        renderItem();
        await expand(user);

        expect(await screen.findByText('Naming ideas')).toBeInTheDocument();
        expect(requests).toHaveLength(1);
        expect(requests[0].searchParams.get('projectId')).toBe('project-1');
        expect(requests[0].searchParams.get('size')).toBe('25');
        expect(screen.getByRole('link', { name: /Naming ideas/ })).toHaveAttribute(
            'href',
            '/agent/test-agent/chat/chat-1',
        );
    });

    it('shows an empty state when the space has no chats', async () => {
        const user = userEvent.setup();

        stubChats({ chats: [] });

        renderItem();
        await expand(user);

        expect(await screen.findByText('No chats yet')).toBeInTheDocument();
    });

    it('collapses again on a second click', async () => {
        const user = userEvent.setup();

        stubChats();

        renderItem();
        await expand(user);
        await screen.findByText('Naming ideas');
        await expand(user);

        expect(screen.queryByText('Naming ideas')).not.toBeInTheDocument();
    });

    it('expands from the keyboard', async () => {
        const user = userEvent.setup();

        stubChats();

        renderItem();
        screen.getByRole('button', { name: /Marketing space/ }).focus();
        await user.keyboard('{Enter}');

        expect(await screen.findByText('Naming ideas')).toBeInTheDocument();
    });

    it('offers a Show more button only when another page exists', async () => {
        const user = userEvent.setup();
        const requests = stubChats({ totalPages: 3 });

        renderItem();
        await expand(user);

        await screen.findByText('Naming ideas');
        await user.click(screen.getByRole('button', { name: 'Show more' }));

        await waitFor(() => {
            expect(requests).toHaveLength(2);
        });
        expect(requests[1].searchParams.get('page')).toBe('1');
    });

    it('navigates to the space from the new-chat button', async () => {
        const user = userEvent.setup();

        stubChats();

        const { onMobileClose } = renderItem();

        await user.click(screen.getByRole('button', { name: 'New chat in space' }));

        expect(onMobileClose).toHaveBeenCalledTimes(1);
    });

    it('navigates to the space from Open space', async () => {
        const user = userEvent.setup();

        stubChats();

        const { onMobileClose } = renderItem();

        await user.click(screen.getByRole('button', { name: 'More' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Open space' }));

        expect(onMobileClose).toHaveBeenCalledTimes(1);
    });

    it('marks the space active when the route points at it', () => {
        stubChats();

        const { container } = renderItem({ route: '/agent/test-agent/spaces/project-1' });

        expect(container.querySelector('li.nav-list-item.active')).toBeInTheDocument();
    });

    it('gives an owner share, edit and delete actions', async () => {
        const user = userEvent.setup();

        stubChats();

        const { onShare, onEdit, onDelete, onTogglePin } = renderItem();

        await user.click(screen.getByRole('button', { name: 'More' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Share space' }));

        expect(onShare).toHaveBeenCalledWith(project);

        await user.click(screen.getByRole('button', { name: 'More' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Edit' }));

        expect(onEdit).toHaveBeenCalledWith(project);

        await user.click(screen.getByRole('button', { name: 'More' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));

        expect(onDelete).toHaveBeenCalledWith(project);

        await user.click(screen.getByRole('button', { name: 'More' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Unpin' }));

        expect(onTogglePin).toHaveBeenCalledWith(project);
    });

    it('offers Pin instead of Unpin for an unpinned space', async () => {
        const user = userEvent.setup();

        stubChats();

        const { onTogglePin } = renderItem({ isPinned: false });

        await user.click(screen.getByRole('button', { name: 'More' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Pin' }));

        expect(onTogglePin).toHaveBeenCalledWith(project);
    });

    it('leaves a non-owner open and unpin actions', async () => {
        const user = userEvent.setup();

        stubChats();

        renderItem({ isOwner: false });

        await user.click(screen.getByRole('button', { name: 'More' }));

        expect(await screen.findByRole('menuitem', { name: 'Open space' })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: 'Unpin' })).toBeInTheDocument();
        expect(screen.queryByRole('menuitem', { name: 'Share space' })).not.toBeInTheDocument();
        expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument();
        expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument();
    });

    it('shows Share for a non-owner with edit access', async () => {
        const user = userEvent.setup();

        stubChats();

        renderItem({ isOwner: false, canEdit: true });

        await user.click(screen.getByRole('button', { name: 'More' }));

        expect(await screen.findByRole('menuitem', { name: 'Open space' })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: 'Share space' })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: 'Unpin' })).toBeInTheDocument();
        expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument();
        expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument();
    });

    it('pins a chat from its row button', async () => {
        const user = userEvent.setup();
        let favoriteCalls = 0;

        stubChats();
        server.use(
            http.put(apiUrl('/conversations/chat-1/favorite'), () => {
                favoriteCalls += 1;

                return envelope({ favorited: true, favoritedAt: 1 });
            }),
        );

        renderItem();
        await expand(user);
        await screen.findByText('Naming ideas');

        await user.click(within(chatRow()).getByRole('button', { name: 'Pin' }));

        await waitFor(() => {
            expect(favoriteCalls).toBe(1);
        });
    });

    it('reports a failed pin', async () => {
        const user = userEvent.setup();

        stubChats();
        server.use(http.put(apiUrl('/conversations/chat-1/favorite'), () => new Response(null, { status: 500 })));

        renderItem();
        await expand(user);
        await screen.findByText('Naming ideas');

        await user.click(within(chatRow()).getByRole('button', { name: 'Pin' }));

        expect(await screen.findByText('Failed to update pin')).toBeInTheDocument();
    });

    it('labels an already pinned chat as unpin', async () => {
        const user = userEvent.setup();

        stubChats({ chats: [rawChat({ favorited: true })] });

        renderItem();
        await expand(user);
        await screen.findByText('Naming ideas');

        expect(within(chatRow()).getByRole('button', { name: 'Unpin' })).toBeInTheDocument();
    });

    it('renames a chat on Enter', async () => {
        const user = userEvent.setup();
        let putBody: unknown;

        stubChats();
        server.use(
            http.put(apiUrl('/conversations/chat-1'), async ({ request }) => {
                putBody = await request.json();

                return envelope(null);
            }),
        );

        renderItem();
        await expand(user);
        await screen.findByText('Naming ideas');

        await user.click(within(chatRow()).getByRole('button', { name: 'More' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Rename' }));

        const input = screen.getByDisplayValue('Naming ideas');

        await user.clear(input);
        await user.type(input, '  Better names  {Enter}');

        await waitFor(() => {
            expect(putBody).toEqual({ title: 'Better names' });
        });
    });

    it('discards an inline rename on Escape without a request', async () => {
        const user = userEvent.setup();
        let putCalls = 0;

        stubChats();
        server.use(
            http.put(apiUrl('/conversations/chat-1'), () => {
                putCalls += 1;

                return envelope(null);
            }),
        );

        renderItem();
        await expand(user);
        await screen.findByText('Naming ideas');

        await user.click(within(chatRow()).getByRole('button', { name: 'More' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Rename' }));

        const input = screen.getByDisplayValue('Naming ideas');

        await user.clear(input);
        await user.type(input, 'Discarded{Escape}');

        await waitFor(() => {
            expect(screen.queryByDisplayValue('Discarded')).not.toBeInTheDocument();
        });
        expect(putCalls).toBe(0);
    });

    it('cancels an inline rename that was emptied', async () => {
        const user = userEvent.setup();
        let putCalls = 0;

        stubChats();
        server.use(
            http.put(apiUrl('/conversations/chat-1'), () => {
                putCalls += 1;

                return envelope(null);
            }),
        );

        renderItem();
        await expand(user);
        await screen.findByText('Naming ideas');

        await user.click(within(chatRow()).getByRole('button', { name: 'More' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Rename' }));

        const input = screen.getByDisplayValue('Naming ideas');

        await user.clear(input);
        fireEvent.blur(input);

        await waitFor(() => {
            expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        });
        expect(putCalls).toBe(0);
    });

    it('moves a chat to another space', async () => {
        const user = userEvent.setup();
        let putBody: unknown;

        stubChats();
        server.use(
            http.put(apiUrl('/conversations/chat-1'), async ({ request }) => {
                putBody = await request.json();

                return envelope(null);
            }),
        );

        renderItem();
        await expand(user);
        await screen.findByText('Naming ideas');

        await user.click(within(chatRow()).getByRole('button', { name: 'More' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Change space' }));
        // `user.click` does not select an item inside a Radix submenu under jsdom.
        fireEvent.click(await screen.findByRole('menuitem', { name: 'Sales space' }));

        await waitFor(() => {
            expect(putBody).toEqual({ projectId: 'project-2' });
        });
        expect(await screen.findByText('Moved to selected space')).toBeInTheDocument();
    });

    it('treats re-selecting the current space as a no-op', async () => {
        const user = userEvent.setup();
        let putCalls = 0;

        stubChats();
        server.use(
            http.put(apiUrl('/conversations/chat-1'), () => {
                putCalls += 1;

                return envelope(null);
            }),
        );

        renderItem();
        await expand(user);
        await screen.findByText('Naming ideas');

        await user.click(within(chatRow()).getByRole('button', { name: 'More' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Change space' }));
        fireEvent.click(await screen.findByRole('menuitem', { name: 'Marketing space' }));

        await waitFor(() => {
            expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        });
        expect(putCalls).toBe(0);
    });

    it('removes a chat from the space by clearing its project', async () => {
        const user = userEvent.setup();
        let putBody: unknown;

        stubChats();
        server.use(
            http.put(apiUrl('/conversations/chat-1'), async ({ request }) => {
                putBody = await request.json();

                return envelope(null);
            }),
        );

        renderItem();
        await expand(user);
        await screen.findByText('Naming ideas');

        await user.click(within(chatRow()).getByRole('button', { name: 'More' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Remove from space' }));

        await waitFor(() => {
            expect(putBody).toEqual({ projectId: null });
        });
        expect(await screen.findByText('Removed from space')).toBeInTheDocument();
    });

    it('deletes a chat after confirmation', async () => {
        const user = userEvent.setup();
        let deleteCalls = 0;

        stubChats();
        server.use(
            http.delete(apiUrl('/conversations/chat-1'), () => {
                deleteCalls += 1;

                return envelope(null);
            }),
        );

        renderItem();
        await expand(user);
        await screen.findByText('Naming ideas');

        await user.click(within(chatRow()).getByRole('button', { name: 'More' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));

        const dialog = await screen.findByRole('alertdialog');

        await user.click(within(dialog).getByRole('button', { name: 'Confirm' }));

        await waitFor(() => {
            expect(deleteCalls).toBe(1);
        });
    });

    it('reports a failed chat delete and keeps the dialog open', async () => {
        const user = userEvent.setup();

        stubChats();
        server.use(http.delete(apiUrl('/conversations/chat-1'), () => new Response(null, { status: 500 })));

        renderItem();
        await expand(user);
        await screen.findByText('Naming ideas');

        await user.click(within(chatRow()).getByRole('button', { name: 'More' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));

        const dialog = await screen.findByRole('alertdialog');

        await user.click(within(dialog).getByRole('button', { name: 'Confirm' }));

        expect(await screen.findByText('Failed to delete chat')).toBeInTheDocument();
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });
});
