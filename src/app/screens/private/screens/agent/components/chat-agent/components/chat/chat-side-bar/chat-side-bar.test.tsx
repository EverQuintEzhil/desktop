import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import type { ReactNode } from 'react';
import { useLayoutEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentComposerContext } from '@/components/agent-chat/context/agent-composer-context';
import type { AgentComposerContextValue } from '@/components/agent-chat/types';
import { ChatHostProvider, createFluentMindConversationAdapter } from '@/components/chat-host';
import type { ChatHost } from '@/components/chat-host';
import { appConversationApi } from '@/lib/api/app/conversation';
import { routinesVisibleTenant, testTenant } from '@/test/fixtures/auth';
import { apiUrl, envelope, httpError, pagedEnvelope, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import type { ChatAgentType } from '@/types/admin';

import SideBar from './chat-side-bar';

vi.mock('@/components', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/components')>()),
    AvatarMenu: () => <div>Avatar menu</div>,
}));

const baseUiConfig = {
    componentType: 'chat',
    library: false,
    home: { search: {} },
    spaces: { enabled: false },
    promptLibrary: { enabled: false },
};

const makeAgent = (uiConfig: Record<string, unknown> = {}) =>
    ({
        _id: 'agent-1',
        slug: 'test-agent',
        name: 'Test Agent',
        uiConfig: { ...baseUiConfig, ...uiConfig },
    }) as unknown as ChatAgentType;

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

const rawHistory = (overrides: Record<string, unknown> = {}) => ({
    _id: 'chat-1',
    title: 'Naming ideas',
    favorited: false,
    updated_at: '2026-03-04T09:00:00.000Z',
    ...overrides,
});

interface Stubs {
    recents?: Record<string, unknown>[];
    favorites?: Record<string, unknown>[];
    pinnedProjects?: Record<string, unknown>[];
    unpinnedProjects?: Record<string, unknown>[];
    recentsTotalPages?: number;
    favoritesTotalPages?: number;
}

const stubSidebar = ({
    recents = [],
    favorites = [],
    pinnedProjects = [],
    unpinnedProjects = [],
    recentsTotalPages = 1,
    favoritesTotalPages = 1,
}: Stubs = {}) => {
    const conversationRequests: URL[] = [];
    const projectRequests: URL[] = [];

    server.use(
        http.get(apiUrl('/conversations'), ({ request }) => {
            const url = new URL(request.url);

            conversationRequests.push(url);

            if (url.searchParams.get('favorite') === 'true') {
                return pagedEnvelope(favorites, {
                    page: Number(url.searchParams.get('page') ?? 0),
                    totalPages: favoritesTotalPages,
                });
            }

            return pagedEnvelope(recents, { page: 0, totalPages: recentsTotalPages });
        }),
        http.get(apiUrl('/projects'), ({ request }) => {
            const url = new URL(request.url);

            projectRequests.push(url);

            // The space picker sends no `pinned` param at all — only the unpinned
            // sidebar list asks for pinned=false.
            const isUnpinnedRequest = url.searchParams.get('pinned') === 'false';

            return pagedEnvelope(isUnpinnedRequest ? unpinnedProjects : pinnedProjects, { page: 0 });
        }),
    );

    return { conversationRequests, projectRequests };
};

const composerContext = (overrides: Record<string, unknown> = {}) =>
    ({
        composer: {
            isIncognitoMode: false,
            toggleIncognitoMode: () => {},
            ...overrides,
        },
        filesState: { onChangeFile: () => {} },
    }) as unknown as AgentComposerContextValue;

interface RenderOptions {
    agent?: ChatAgentType;
    route?: string;
    composer?: AgentComposerContextValue;
    isMobileOpen?: boolean;
    leading?: ReactNode;
}

const renderSideBar = ({
    agent = makeAgent(),
    route = '/agent/test-agent',
    composer = composerContext(),
    isMobileOpen,
    leading,
    tenant = routinesVisibleTenant,
}: RenderOptions & { tenant?: typeof testTenant } = {}) => {
    const onMobileClose = vi.fn();

    const wrap = (children: ReactNode) => (
        <ChatHostProvider value={chatHost}>
            <AgentComposerContext.Provider value={composer}>
                {/* Before the sidebar, so a probe's layout effect fires ahead of the
                    sidebar's own — the mount-timing test is inert if this moves down. */}
                {leading}
                {children}
                <Toaster />
            </AgentComposerContext.Provider>
        </ChatHostProvider>
    );

    const view = renderWithProviders(
        wrap(
            <Routes>
                <Route
                    path="/agent/:agentSlug/*"
                    element={<SideBar agent={agent} isMobileOpen={isMobileOpen} onMobileClose={onMobileClose} />}
                />
            </Routes>,
        ),
        { route, preloadedState: { tenant } },
    );

    return { ...view, onMobileClose };
};

const historyRow = () => screen.getByRole('link', { name: /Naming ideas/ }).closest('li') as HTMLElement;

/**
 * The drawer is a `below('lg')` layout, so the menu reads the same 1023px query.
 * Restores only `matchMedia` — `vi.unstubAllGlobals` would also drop the
 * ResizeObserver and IntersectionObserver that `src/test/setup.ts` stubs.
 */
const stubCompactViewport = () => {
    const original = window.matchMedia;

    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query === '(max-width: 1023px)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;

    restoreMatchMedia = () => {
        window.matchMedia = original;
    };
};

let restoreMatchMedia: (() => void) | null = null;

describe('Chat sidebar', () => {
    beforeEach(() => {
        window.localStorage.clear();
        server.use(
            http.get(apiUrl('/routines'), () => pagedEnvelope([])),
            http.get(apiUrl('/routines/runs'), () => pagedEnvelope([])),
        );
    });

    afterEach(() => {
        restoreMatchMedia?.();
        restoreMatchMedia = null;
    });

    it('renders the always-present navigation and the empty recents list', async () => {
        stubSidebar();

        renderSideBar();

        expect(await screen.findByRole('link', { name: 'New Chat' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Search Chats' })).toHaveAttribute(
            'href',
            '/agent/test-agent/search-chat',
        );
        expect(await screen.findByText('Recents')).toBeInTheDocument();
        expect(screen.queryByText('Pinned')).not.toBeInTheDocument();
        expect(screen.getByText('Avatar menu')).toBeInTheDocument();
    });

    it('hides the routines nav row and asks for no routine data when the agent has routines off', async () => {
        stubSidebar();
        const routineRequests: string[] = [];

        server.use(
            http.get(apiUrl('/routines'), ({ request }) => {
                routineRequests.push(request.url);

                return pagedEnvelope([]);
            }),
            http.get(apiUrl('/routines/runs'), ({ request }) => {
                routineRequests.push(request.url);

                return pagedEnvelope([]);
            }),
        );

        renderSideBar({ agent: makeAgent({ routines: { enabled: false } }) });

        expect(await screen.findByRole('link', { name: 'Search Chats' })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Routines' })).not.toBeInTheDocument();
        expect(routineRequests).toEqual([]);
    });

    it('shows the routines nav row when the agent has routines on', async () => {
        stubSidebar();

        renderSideBar({ agent: makeAgent({ routines: { enabled: true } }) });

        expect(await screen.findByRole('link', { name: 'Routines' })).toHaveAttribute(
            'href',
            '/agent/test-agent/routines',
        );
    });

    it('shows the routines nav row when the agent has no routines flag at all', async () => {
        stubSidebar();

        renderSideBar();

        expect(await screen.findByRole('link', { name: 'Routines' })).toHaveAttribute(
            'href',
            '/agent/test-agent/routines',
        );
    });

    it('hides the routines nav row when the tenant hides routines', async () => {
        stubSidebar();

        renderSideBar({ agent: makeAgent({ routines: { enabled: true } }), tenant: testTenant });

        expect(await screen.findByRole('link', { name: 'Search Chats' })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Routines' })).not.toBeInTheDocument();
    });

    const routineRow = (id: string, name: string) => ({
        _id: id,
        agentId: 'agent-1',
        name,
        prompt: 'Summarise',
        cron: '0 9 * * 1',
        timezone: 'UTC',
        runOnce: false,
        status: 'active',
        lastRunAt: null,
        createdAt: '2026-03-01T09:00:00.000Z',
        updatedAt: '2026-03-01T09:00:00.000Z',
    });

    const stubRoutine = (rows = [routineRow('routine-1', 'Weekly digest')]) =>
        server.use(http.get(apiUrl('/routines'), () => pagedEnvelope(rows)));

    it('names Routines exactly once, as a nav row rather than a second accordion group', async () => {
        stubSidebar({ recents: [rawHistory()] });
        stubRoutine();

        renderSideBar();

        expect(await screen.findByRole('link', { name: /Routines/ })).toBeInTheDocument();
        expect(screen.getAllByText('Routines')).toHaveLength(1);

        const recentsTrigger = await screen.findByRole('button', { name: 'Recents' });
        const region = document.querySelector('.chat-sidebar-nav-list') as HTMLElement;
        const accordions = [...region.querySelectorAll('[data-slot="accordion"]')];

        expect(accordions).toHaveLength(1);
        expect(accordions[0]).toContainElement(recentsTrigger);
    });

    it('expands and collapses the routines list from the nav row chevron', async () => {
        const user = userEvent.setup();

        stubSidebar();
        stubRoutine();

        renderSideBar();

        const toggle = await screen.findByRole('button', { name: 'Show routines' });

        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByText('Weekly digest')).not.toBeInTheDocument();

        await user.click(toggle);

        expect(await screen.findByText('Weekly digest')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Routines/ })).not.toHaveClass('active');

        await user.click(screen.getByRole('button', { name: 'Hide routines' }));

        await waitFor(() => {
            expect(screen.queryByText('Weekly digest')).not.toBeInTheDocument();
        });
    });

    it('nests each expanded list inside its own nav row', async () => {
        window.localStorage.setItem('sidebarRoutinesExpanded', 'true');
        window.localStorage.setItem('sidebarSpacesExpanded', 'true');
        stubSidebar({ unpinnedProjects: [{ _id: 'project-9', name: 'Draft space', members: [owner] }] });
        stubRoutine();

        renderSideBar({ agent: makeAgent({ spaces: { enabled: true } }) });

        expect(await screen.findByText('Weekly digest')).toBeInTheDocument();
        expect(await screen.findByText('Draft space')).toBeInTheDocument();

        const routinesRow = screen.getByRole('link', { name: /Routines/ }).closest('li');
        const spacesRow = screen.getByRole('link', { name: /Spaces/ }).closest('li');
        const routinesList = document.getElementById('sidebar-routines');
        const spacesList = document.getElementById('sidebar-unpinned-spaces');

        expect(routinesRow).toContainElement(routinesList);
        expect(spacesRow).toContainElement(spacesList);
        expect(spacesRow).not.toContainElement(routinesList);
        expect(routinesRow).not.toContainElement(spacesList);
        expect(screen.getByRole('button', { name: 'Hide routines' })).toHaveAttribute(
            'aria-controls',
            'sidebar-routines',
        );
        expect(screen.getByRole('button', { name: 'Hide spaces' })).toHaveAttribute(
            'aria-controls',
            'sidebar-unpinned-spaces',
        );
    });

    it('unpins the nav while a list is expanded, so the pinned block cannot cover the history', async () => {
        const user = userEvent.setup();

        stubSidebar({ unpinnedProjects: [{ _id: 'project-9', name: 'Draft space', members: [owner] }] });
        stubRoutine();

        renderSideBar({ agent: makeAgent({ spaces: { enabled: true } }) });

        const nav = (await screen.findByRole('link', { name: 'New Chat' })).closest('ul.main-nav') as HTMLElement;

        expect(nav).toHaveClass('sticky-nav');

        await user.click(await screen.findByRole('button', { name: 'Show spaces' }));

        expect(await screen.findByText('Draft space')).toBeInTheDocument();
        expect(nav).not.toHaveClass('sticky-nav');

        await user.click(screen.getByRole('button', { name: 'Hide spaces' }));

        await waitFor(() => expect(nav).toHaveClass('sticky-nav'));

        await user.click(await screen.findByRole('button', { name: 'Show routines' }));

        expect(await screen.findByText('Weekly digest')).toBeInTheDocument();
        expect(nav).not.toHaveClass('sticky-nav');
    });

    it('keeps the nav row colours when the nav is not pinned', async () => {
        const user = userEvent.setup();

        stubSidebar();
        stubRoutine();

        renderSideBar();

        await user.click(await screen.findByRole('button', { name: 'Show routines' }));

        const nav = (await screen.findByRole('link', { name: 'New Chat' })).closest('ul.main-nav') as HTMLElement;

        expect(nav).toHaveClass('main-nav');
    });

    it('offers a way out of the capped routines list only when it is truncated', async () => {
        const user = userEvent.setup();

        stubSidebar();
        stubRoutine([1, 2, 3, 4, 5, 6].map((n) => routineRow(`routine-${n}`, `Routine ${n}`)));

        renderSideBar();

        await user.click(await screen.findByRole('button', { name: 'Show routines' }));

        expect(await screen.findByText('Routine 1')).toBeInTheDocument();
        expect(screen.queryByText('Routine 6')).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'View all routines' })).toHaveAttribute(
            'href',
            '/agent/test-agent/routines',
        );
    });

    it('leaves the routines list alone when nothing is cut off', async () => {
        const user = userEvent.setup();

        stubSidebar();
        stubRoutine();

        renderSideBar();

        await user.click(await screen.findByRole('button', { name: 'Show routines' }));

        expect(await screen.findByText('Weekly digest')).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'View all routines' })).not.toBeInTheDocument();
    });

    it('orders the nav rows with routines last', async () => {
        stubSidebar();

        renderSideBar({
            agent: makeAgent({ library: true, spaces: { enabled: true }, promptLibrary: { enabled: true } }),
        });

        const nav = (await screen.findByRole('link', { name: 'New Chat' })).closest('ul.main-nav') as HTMLElement;
        const rows = [...nav.querySelectorAll(':scope > li > a')].map((row) => row.textContent?.trim());

        expect(rows).toEqual(['New Chat', 'Search Chats', 'Library', 'Prompt Library', 'Spaces', 'Routines']);
    });

    it('restores the routines toggle from local storage', async () => {
        window.localStorage.setItem('sidebarRoutinesExpanded', 'true');
        stubSidebar();
        stubRoutine();

        renderSideBar();

        expect(await screen.findByText('Weekly digest')).toBeInTheDocument();
    });

    it('renders neither the routines row nor its list when the tenant hides routines', async () => {
        window.localStorage.setItem('sidebarRoutinesExpanded', 'true');
        stubSidebar();
        stubRoutine();

        renderSideBar({ agent: makeAgent({ routines: { enabled: true } }), tenant: testTenant });

        expect(await screen.findByRole('link', { name: 'New Chat' })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /Routines/ })).not.toBeInTheDocument();
        expect(screen.queryByText('Weekly digest')).not.toBeInTheDocument();
    });

    it('mounts the aside with the stored width already inline, before sibling layout effects run', () => {
        stubSidebar();
        window.localStorage.setItem('sidebarWidth', '423');

        // A layout read between DOM insertion and a late variable write gives the
        // aside's width transition a 280px before-change style to animate from —
        // that gap is the mount animation this guards against, so the width must
        // already be on the element when the earliest layout effect looks.
        let widthAtFirstLayout: string | null = null;
        const Probe = () => {
            useLayoutEffect(() => {
                widthAtFirstLayout =
                    document.querySelector('aside')?.style.getPropertyValue('--chat-sidebar-width') ?? null;
            }, []);

            return null;
        };

        renderSideBar({ leading: <Probe /> });

        expect(widthAtFirstLayout).toBe('423px');
    });

    it('requests recents and favorites separately', async () => {
        const { conversationRequests } = stubSidebar();

        renderSideBar();

        await screen.findByText('Recents');

        await waitFor(() => {
            expect(conversationRequests).toHaveLength(2);
        });
        const favorites = conversationRequests.map((url) => url.searchParams.get('favorite')).sort();

        expect(favorites).toEqual(['false', 'true']);
        expect(conversationRequests[0].searchParams.get('page')).toBe('0');
    });

    it('lists recent conversations', async () => {
        stubSidebar({ recents: [rawHistory()] });

        renderSideBar();

        expect(await screen.findByText('Naming ideas')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Naming ideas/ })).toHaveAttribute(
            'href',
            '/agent/test-agent/chat/chat-1',
        );
    });

    it('shows an error state when the history request fails', async () => {
        server.use(
            respond('get', '/conversations', () => httpError(500)),
            respond('get', '/projects', () => pagedEnvelope([])),
        );

        renderSideBar();

        expect(await screen.findByText('Error Occured')).toBeInTheDocument();
    });

    it('groups favorites under Pinned', async () => {
        stubSidebar({ favorites: [rawHistory({ _id: 'chat-2', title: 'Kept chat', favorited: true })] });

        renderSideBar();

        expect(await screen.findByText('Pinned')).toBeInTheDocument();
        expect(screen.getByText('Kept chat')).toBeInTheDocument();
    });

    it('pages the pinned favorites from their own Show more button', async () => {
        const user = userEvent.setup();
        const { conversationRequests } = stubSidebar({
            favorites: [rawHistory({ _id: 'chat-2', title: 'Kept chat', favorited: true })],
            favoritesTotalPages: 3,
        });

        renderSideBar();

        await screen.findByText('Kept chat');
        await user.click(screen.getByRole('button', { name: 'Show more' }));

        await waitFor(() => {
            const favoritePages = conversationRequests
                .filter((url) => url.searchParams.get('favorite') === 'true')
                .map((url) => url.searchParams.get('page'));

            expect(favoritePages).toEqual(['0', '1']);
        });
    });

    it('lists pinned spaces with the pinned query params', async () => {
        const { projectRequests } = stubSidebar({
            pinnedProjects: [{ _id: 'project-1', name: 'Marketing space', members: [owner] }],
        });

        renderSideBar({ agent: makeAgent({ spaces: { enabled: true } }) });

        expect(await screen.findByText('Marketing space')).toBeInTheDocument();
        expect(projectRequests[0].searchParams.get('pinned')).toBe('true');
        expect(projectRequests[0].searchParams.get('sortBy')).toBe('pinnedAt:desc');
        expect(projectRequests[0].searchParams.get('size')).toBe('30');
    });

    it('keeps unpinned spaces hidden until the Spaces toggle is opened', async () => {
        const user = userEvent.setup();
        const { projectRequests } = stubSidebar({
            unpinnedProjects: [{ _id: 'project-9', name: 'Draft space', members: [owner] }],
        });

        renderSideBar({ agent: makeAgent({ spaces: { enabled: true } }) });

        const toggle = await screen.findByRole('button', { name: 'Show spaces' });

        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByText('Draft space')).not.toBeInTheDocument();

        await user.click(toggle);

        expect(await screen.findByText('Draft space')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Hide spaces' })).toHaveAttribute('aria-expanded', 'true');

        const unpinnedRequest = projectRequests.find((url) => url.searchParams.get('pinned') === 'false');

        expect(unpinnedRequest?.searchParams.get('sortBy')).toBe('updatedAt:desc');
        expect(unpinnedRequest?.searchParams.get('size')).toBe('30');
    });

    it('opens the Spaces toggle without navigating to the spaces page', async () => {
        const user = userEvent.setup();

        stubSidebar();

        renderSideBar({ agent: makeAgent({ spaces: { enabled: true } }) });

        await user.click(await screen.findByRole('button', { name: 'Show spaces' }));

        expect(await screen.findByText('No unpinned spaces')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Spaces/ })).not.toHaveClass('active');
    });

    it('restores the Spaces toggle from local storage', async () => {
        window.localStorage.setItem('sidebarSpacesExpanded', 'true');
        stubSidebar({
            unpinnedProjects: [{ _id: 'project-9', name: 'Draft space', members: [owner] }],
        });

        renderSideBar({ agent: makeAgent({ spaces: { enabled: true } }) });

        expect(await screen.findByText('Draft space')).toBeInTheDocument();
    });

    it('pins an unpinned space from its menu', async () => {
        const user = userEvent.setup();
        let pinCalls = 0;

        window.localStorage.setItem('sidebarSpacesExpanded', 'true');
        stubSidebar({
            unpinnedProjects: [{ _id: 'project-9', name: 'Draft space', members: [owner] }],
        });
        server.use(
            http.put(apiUrl('/projects/project-9/pin'), () => {
                pinCalls += 1;

                return envelope({ _id: 'project-9' });
            }),
        );

        renderSideBar({ agent: makeAgent({ spaces: { enabled: true } }) });

        await screen.findByText('Draft space');
        await user.click(screen.getByRole('button', { name: 'More' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Pin' }));

        expect(await screen.findByText('Space pinned')).toBeInTheDocument();
        expect(pinCalls).toBe(1);
    });

    it('does not fetch pinned spaces when the agent has spaces disabled', async () => {
        const { conversationRequests, projectRequests } = stubSidebar();

        renderSideBar();

        await screen.findByText('Recents');
        // The conversation recorder firing is what makes the empty project
        // recorder meaningful — it proves the sidebar finished rendering.
        await waitFor(() => {
            expect(conversationRequests).toHaveLength(2);
        });

        expect(projectRequests).toHaveLength(0);
        expect(screen.queryByRole('link', { name: 'Spaces' })).not.toBeInTheDocument();
    });

    it('shows the library, prompt-library and spaces links when enabled', async () => {
        stubSidebar();

        renderSideBar({
            agent: makeAgent({
                library: true,
                promptLibrary: { enabled: true },
                spaces: { enabled: true },
            }),
        });

        expect(await screen.findByRole('link', { name: 'Library' })).toHaveAttribute(
            'href',
            '/agent/test-agent/library',
        );
        expect(screen.getByRole('link', { name: 'Prompt Library' })).toHaveAttribute(
            'href',
            '/agent/test-agent/prompt-library',
        );
        expect(screen.getByRole('link', { name: 'Spaces' })).toHaveAttribute('href', '/agent/test-agent/spaces');
    });

    it('marks the library link active on the library route', async () => {
        stubSidebar();

        renderSideBar({
            agent: makeAgent({ library: true, home: { startPage: 'library', search: {} } }),
            route: '/agent/test-agent/library',
        });

        expect((await screen.findByRole('link', { name: 'Library' })).className).toContain('active');
    });

    it('persists the collapsed state to localStorage', async () => {
        const user = userEvent.setup();

        stubSidebar();

        const { container } = renderSideBar();

        await screen.findByText('Recents');
        await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));

        expect(window.localStorage.getItem('sidebarCollapsed')).toBe('true');
        expect(container.querySelector('aside')).toHaveClass('collapsed');
        // The name flips with the state, so the control announces what it will do next.
        expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
    });

    it('starts collapsed when localStorage says so', async () => {
        stubSidebar();
        window.localStorage.setItem('sidebarCollapsed', 'true');

        const { container } = renderSideBar();

        await screen.findByText('Recents');

        expect(container.querySelector('aside')).toHaveClass('collapsed');
    });

    it('closes the mobile drawer from the close button', async () => {
        const user = userEvent.setup();

        stubSidebar();

        const { onMobileClose } = renderSideBar({ isMobileOpen: true });

        expect(document.body).toHaveClass('sidebar-mobile-open');

        await user.click(screen.getByRole('button', { name: 'Close sidebar' }));

        expect(onMobileClose).toHaveBeenCalledTimes(1);
    });

    it('toggles temporary chat when the agent enables it', async () => {
        const user = userEvent.setup();
        const toggleIncognitoMode = vi.fn();

        stubSidebar();

        renderSideBar({
            agent: makeAgent({ home: { search: { isIncognitoEnabled: true } } }),
            composer: composerContext({ toggleIncognitoMode }),
        });

        await screen.findByText('Recents');

        const toggle = screen.getByRole('button', { name: 'Turn on temporary chat' });

        expect(toggle).toHaveAttribute('aria-pressed', 'false');

        await user.click(toggle);

        expect(toggleIncognitoMode).toHaveBeenCalledTimes(1);
    });

    it('toggles temporary chat from the keyboard with both Enter and Space', async () => {
        const user = userEvent.setup();
        const toggleIncognitoMode = vi.fn();

        stubSidebar();

        renderSideBar({
            agent: makeAgent({ home: { search: { isIncognitoEnabled: true } } }),
            composer: composerContext({ toggleIncognitoMode }),
        });

        await screen.findByText('Recents');

        const toggle = screen.getByRole('button', { name: 'Turn on temporary chat' });

        toggle.focus();
        await user.keyboard('{Enter}');

        expect(toggleIncognitoMode).toHaveBeenCalledTimes(1);

        await user.keyboard(' ');

        expect(toggleIncognitoMode).toHaveBeenCalledTimes(2);
    });

    it('leaves temporary chat when a past conversation is opened', async () => {
        const user = userEvent.setup();
        const toggleIncognitoMode = vi.fn();

        stubSidebar({ recents: [rawHistory()] });

        renderSideBar({
            composer: composerContext({ isIncognitoMode: true, toggleIncognitoMode }),
        });

        await user.click(await screen.findByRole('link', { name: /Naming ideas/ }));

        expect(toggleIncognitoMode).toHaveBeenCalledTimes(1);
    });

    it('pins a conversation through the favorite endpoint', async () => {
        const user = userEvent.setup();
        let favoriteCalls = 0;

        stubSidebar({ recents: [rawHistory()] });
        server.use(
            http.put(apiUrl('/conversations/chat-1/favorite'), () => {
                favoriteCalls += 1;

                return envelope({ favorited: true, favoritedAt: 1 });
            }),
        );

        renderSideBar();
        await screen.findByText('Naming ideas');

        await user.click(within(historyRow()).getByRole('button', { name: 'Pin' }));

        await waitFor(() => {
            expect(favoriteCalls).toBe(1);
        });
    });

    it('renames a conversation on Enter', async () => {
        const user = userEvent.setup();
        let putBody: unknown;

        stubSidebar({ recents: [rawHistory()] });
        server.use(
            http.put(apiUrl('/conversations/chat-1'), async ({ request }) => {
                putBody = await request.json();

                return envelope(null);
            }),
        );

        renderSideBar();
        await screen.findByText('Naming ideas');

        await user.click(within(historyRow()).getByRole('button', { name: 'More' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Rename' }));

        const input = screen.getByDisplayValue('Naming ideas');

        await user.clear(input);
        await user.type(input, 'Better names{Enter}');

        await waitFor(() => {
            expect(putBody).toEqual({ title: 'Better names' });
        });
    });

    it('discards a rename on Escape without a request', async () => {
        const user = userEvent.setup();
        let putCalls = 0;

        stubSidebar({ recents: [rawHistory()] });
        server.use(
            http.put(apiUrl('/conversations/chat-1'), () => {
                putCalls += 1;

                return envelope(null);
            }),
        );

        renderSideBar();
        await screen.findByText('Naming ideas');

        await user.click(within(historyRow()).getByRole('button', { name: 'More' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Rename' }));

        const input = screen.getByDisplayValue('Naming ideas');

        await user.clear(input);
        await user.type(input, 'Discarded{Escape}');

        await waitFor(() => {
            expect(screen.queryByDisplayValue('Discarded')).not.toBeInTheDocument();
        });
        expect(putCalls).toBe(0);
    });

    it('deletes a conversation after confirmation', async () => {
        const user = userEvent.setup();
        let deleteCalls = 0;

        stubSidebar({ recents: [rawHistory()] });
        server.use(
            http.delete(apiUrl('/conversations/chat-1'), () => {
                deleteCalls += 1;

                return envelope(null);
            }),
        );

        renderSideBar({ route: '/agent/test-agent/chat/chat-1' });
        await screen.findByText('Naming ideas');

        await user.click(within(historyRow()).getByRole('button', { name: 'More' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));

        const dialog = await screen.findByRole('alertdialog');

        await user.click(within(dialog).getByRole('button', { name: 'Confirm' }));

        await waitFor(() => {
            expect(deleteCalls).toBe(1);
        });
    });

    it('adds a conversation to a space from its menu', async () => {
        const user = userEvent.setup();
        let putBody: unknown;

        stubSidebar({
            recents: [rawHistory()],
            pinnedProjects: [{ _id: 'project-2', name: 'Sales space', members: [owner] }],
        });
        server.use(
            http.put(apiUrl('/conversations/chat-1'), async ({ request }) => {
                putBody = await request.json();

                return envelope(null);
            }),
        );

        renderSideBar({ agent: makeAgent({ spaces: { enabled: true } }) });
        await screen.findByText('Naming ideas');

        await user.click(within(historyRow()).getByRole('button', { name: 'More' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Add to space' }));
        // `user.click` does not select an item inside a Radix submenu under jsdom.
        fireEvent.click(await screen.findByRole('menuitem', { name: 'Sales space' }));

        await waitFor(() => {
            expect(putBody).toEqual({ projectId: 'project-2' });
        });
        expect(await screen.findByText('Added to space')).toBeInTheDocument();
    });

    it('refetches the sidebar lists after a space change', async () => {
        const user = userEvent.setup();
        const { conversationRequests } = stubSidebar({
            recents: [rawHistory()],
            pinnedProjects: [{ _id: 'project-2', name: 'Sales space', members: [owner] }],
        });

        server.use(respond('put', '/conversations/chat-1', () => envelope(null)));

        renderSideBar({ agent: makeAgent({ spaces: { enabled: true } }) });
        await screen.findByText('Naming ideas');
        await waitFor(() => {
            expect(conversationRequests).toHaveLength(2);
        });

        await user.click(within(historyRow()).getByRole('button', { name: 'More' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Add to space' }));
        fireEvent.click(await screen.findByRole('menuitem', { name: 'Sales space' }));

        // The server decides which conversations belong in the sidebar, so the local
        // cache patch is not enough — both lists have to be requested again.
        await waitFor(() => {
            expect(conversationRequests.length).toBeGreaterThan(2);
        });
        const refetched = conversationRequests
            .slice(2)
            .map((url) => url.searchParams.get('favorite'))
            .sort();

        expect(refetched).toEqual(['false', 'true']);
    });

    it('dulls the moved conversation until the refreshed list arrives', async () => {
        const user = userEvent.setup();
        const releaseRefetch: Array<() => void> = [];

        const { conversationRequests } = stubSidebar({
            recents: [rawHistory()],
            pinnedProjects: [{ _id: 'project-2', name: 'Sales space', members: [owner] }],
        });

        server.use(respond('put', '/conversations/chat-1', () => envelope(null)));

        renderSideBar({ agent: makeAgent({ spaces: { enabled: true } }) });
        await screen.findByText('Naming ideas');
        await waitFor(() => {
            expect(conversationRequests).toHaveLength(2);
        });

        expect(historyRow()).not.toHaveAttribute('aria-busy');

        // Hold the refetch open, not the PUT: the point is that the row stays dulled
        // past the write, until the list the server returns has actually landed.
        server.use(
            http.get(apiUrl('/conversations'), async ({ request }) => {
                await new Promise<void>((resolve) => {
                    releaseRefetch.push(resolve);
                });
                const isFavorites = new URL(request.url).searchParams.get('favorite') === 'true';

                return pagedEnvelope(isFavorites ? [] : [rawHistory()], { page: 0, totalPages: 1 });
            }),
        );

        await user.click(within(historyRow()).getByRole('button', { name: 'More' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Add to space' }));
        fireEvent.click(await screen.findByRole('menuitem', { name: 'Sales space' }));

        await waitFor(() => {
            expect(releaseRefetch).toHaveLength(2);
        });
        expect(historyRow()).toHaveAttribute('aria-busy', 'true');
        expect(historyRow()).toHaveClass('pointer-events-none');

        releaseRefetch.forEach((release) => release());

        await waitFor(() => {
            expect(historyRow()).not.toHaveAttribute('aria-busy');
        });
    });

    it('offers Remove from space only for a conversation already in one', async () => {
        const user = userEvent.setup();
        let putBody: unknown;

        stubSidebar({ recents: [rawHistory({ chat_project_id: 'project-2' })] });
        server.use(
            respond('get', '/projects/project-2', () =>
                envelope({
                    _id: 'project-2',
                    name: 'Sales space',
                    members: [owner],
                }),
            ),
        );
        server.use(
            http.put(apiUrl('/conversations/chat-1'), async ({ request }) => {
                putBody = await request.json();

                return envelope(null);
            }),
        );

        renderSideBar({ agent: makeAgent({ spaces: { enabled: true } }) });
        await screen.findByText('Naming ideas');

        await user.click(within(historyRow()).getByRole('button', { name: 'More' }));

        expect(await screen.findByRole('menuitem', { name: 'Change space' })).toBeInTheDocument();

        await user.click(screen.getByRole('menuitem', { name: 'Remove from space' }));

        await waitFor(() => {
            expect(putBody).toEqual({ projectId: null });
        });
        expect(await screen.findByText('Removed from space')).toBeInTheDocument();
    });

    it('opens the space picker without closing the mobile drawer', async () => {
        const user = userEvent.setup();

        stubSidebar({
            recents: [rawHistory()],
            pinnedProjects: [{ _id: 'project-1', name: 'Marketing space', members: [owner] }],
        });

        const { onMobileClose } = renderSideBar({
            agent: makeAgent({ spaces: { enabled: true } }),
            isMobileOpen: true,
        });

        await screen.findByText('Naming ideas');

        await user.click(within(historyRow()).getByRole('button', { name: 'More' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Add to space' }));

        expect(await screen.findByPlaceholderText('Search spaces')).toBeInTheDocument();
        // The flyout keeps the parent items on screen; the compact drill-down removes them.
        expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeInTheDocument();
        expect(onMobileClose).not.toHaveBeenCalled();
    });

    it('keeps the mobile drawer open when picker chrome is tapped', async () => {
        const user = userEvent.setup();

        stubCompactViewport();
        stubSidebar({ recents: [rawHistory()] });

        const { onMobileClose } = renderSideBar({
            agent: makeAgent({ spaces: { enabled: true } }),
            isMobileOpen: true,
        });

        await screen.findByText('Naming ideas');

        await user.click(within(historyRow()).getByRole('button', { name: 'More' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Add to space' }));

        await user.click(await screen.findByText('No spaces'));
        await user.click(screen.getByPlaceholderText('Search spaces').parentElement!);

        expect(screen.getByPlaceholderText('Search spaces')).toBeInTheDocument();
        expect(onMobileClose).not.toHaveBeenCalled();
    });

    it('drills into the space picker in place on a narrow screen', async () => {
        const user = userEvent.setup();

        stubCompactViewport();
        stubSidebar({
            recents: [rawHistory()],
            pinnedProjects: [{ _id: 'project-1', name: 'Marketing space', members: [owner] }],
        });

        const { onMobileClose } = renderSideBar({
            agent: makeAgent({ spaces: { enabled: true } }),
            isMobileOpen: true,
        });

        await screen.findByText('Naming ideas');

        await user.click(within(historyRow()).getByRole('button', { name: 'More' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Add to space' }));

        expect(await screen.findByPlaceholderText('Search spaces')).toBeInTheDocument();
        expect(screen.queryByRole('menuitem', { name: 'Rename' })).not.toBeInTheDocument();
        expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument();
        expect(onMobileClose).not.toHaveBeenCalled();

        await user.click(screen.getByRole('menuitem', { name: 'Add to space' }));

        expect(await screen.findByRole('menuitem', { name: 'Rename' })).toBeInTheDocument();
        expect(screen.queryByPlaceholderText('Search spaces')).not.toBeInTheDocument();
    });

    it('hides the space actions when the agent has spaces disabled', async () => {
        const user = userEvent.setup();

        stubSidebar({ recents: [rawHistory()] });

        renderSideBar();
        await screen.findByText('Naming ideas');

        await user.click(within(historyRow()).getByRole('button', { name: 'More' }));

        expect(await screen.findByRole('menuitem', { name: 'Rename' })).toBeInTheDocument();
        expect(screen.queryByRole('menuitem', { name: 'Add to space' })).not.toBeInTheDocument();
    });

    it('never shows an AI Usage menu item, regardless of recorded tokens', async () => {
        const user = userEvent.setup();

        stubSidebar({
            recents: [
                rawHistory({
                    ai_info: {
                        model: 'gpt-test',
                        token_usage: { total_tokens: 120, input_tokens: 100, output_tokens: 20 },
                    },
                }),
            ],
        });

        renderSideBar();
        await screen.findByText('Naming ideas');

        await user.click(within(historyRow()).getByRole('button', { name: 'More' }));

        expect(await screen.findByRole('menuitem', { name: 'Rename' })).toBeInTheDocument();
        expect(screen.queryByRole('menuitem', { name: 'AI Usage' })).not.toBeInTheDocument();
    });

    it('unpins a pinned space from its menu', async () => {
        const user = userEvent.setup();
        let pinToggleCalls = 0;

        stubSidebar({
            pinnedProjects: [
                {
                    _id: 'project-1',
                    name: 'Marketing space',
                    members: [owner],
                    creator: owner,
                },
            ],
        });
        server.use(
            http.put(apiUrl('/projects/project-1/pin'), () => {
                pinToggleCalls += 1;

                return envelope(null);
            }),
        );

        renderSideBar({ agent: makeAgent({ spaces: { enabled: true } }) });
        await screen.findByText('Marketing space');

        await user.click(screen.getAllByRole('button', { name: 'More' })[0]);
        await user.click(await screen.findByRole('menuitem', { name: 'Unpin' }));

        expect(await screen.findByText('Space unpinned')).toBeInTheDocument();
        expect(pinToggleCalls).toBe(1);
    });

    it('deletes a pinned space after confirmation', async () => {
        const user = userEvent.setup();
        let deleteCalls = 0;

        stubSidebar({
            pinnedProjects: [
                {
                    _id: 'project-1',
                    name: 'Marketing space',
                    members: [owner],
                    creator: owner,
                },
            ],
        });
        server.use(
            http.delete(apiUrl('/projects/project-1'), () => {
                deleteCalls += 1;

                return envelope(null);
            }),
        );

        renderSideBar({ agent: makeAgent({ spaces: { enabled: true } }) });
        await screen.findByText('Marketing space');

        await user.click(screen.getAllByRole('button', { name: 'More' })[0]);
        await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));

        const dialog = await screen.findByRole('alertdialog');

        expect(within(dialog).getByText(/"Marketing space" and its chats will be removed/)).toBeInTheDocument();

        await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

        await waitFor(() => {
            expect(deleteCalls).toBe(1);
        });
    });

    it('refreshes the share member list after removing a member', async () => {
        const user = userEvent.setup();
        const teammate = {
            _id: 'user-2',
            name: { first: 'Team', last: 'Mate' },
            email: 'mate@example.com',
            role: 'viewer',
        };
        const space = {
            _id: 'project-1',
            name: 'Marketing space',
            members: [owner, teammate],
            creator: owner,
        };

        stubSidebar({ pinnedProjects: [space] });
        server.use(
            http.delete(apiUrl('/projects/project-1/members/user-2'), () => {
                // The refetched list is the only source of members the modal has.
                space.members = [owner];

                return envelope(null);
            }),
        );

        renderSideBar({ agent: makeAgent({ spaces: { enabled: true } }) });
        await screen.findByText('Marketing space');

        await user.click(screen.getAllByRole('button', { name: 'More' })[0]);
        await user.click(await screen.findByRole('menuitem', { name: 'Share space' }));

        const dialog = await screen.findByRole('dialog');

        expect(within(dialog).getByText('Team Mate')).toBeInTheDocument();

        await user.click(within(dialog).getByRole('button', { name: /Can view/ }));
        await user.click(await screen.findByRole('menuitem', { name: 'Remove access' }));

        await waitFor(() => {
            expect(screen.queryByText('Team Mate')).not.toBeInTheDocument();
        });
    });

    it('opens the edit dialog for a pinned space', async () => {
        const user = userEvent.setup();

        stubSidebar({
            pinnedProjects: [
                {
                    _id: 'project-1',
                    name: 'Marketing space',
                    description: 'Campaign planning',
                    members: [owner],
                    creator: owner,
                },
            ],
        });

        renderSideBar({ agent: makeAgent({ spaces: { enabled: true } }) });
        await screen.findByText('Marketing space');

        await user.click(screen.getAllByRole('button', { name: 'More' })[0]);
        await user.click(await screen.findByRole('menuitem', { name: 'Edit' }));

        const dialog = await screen.findByRole('dialog');

        expect(within(dialog).getByDisplayValue('Marketing space')).toBeInTheDocument();
    });

    it('offers a Show more spaces button when another page exists', async () => {
        const user = userEvent.setup();
        let projectPages = 0;

        server.use(
            respond('get', '/conversations', () => pagedEnvelope([])),
            http.get(apiUrl('/projects'), ({ request }) => {
                projectPages += 1;

                return pagedEnvelope(
                    [
                        {
                            _id: `project-${new URL(request.url).searchParams.get('page')}`,
                            name: 'Marketing space',
                            members: [owner],
                        },
                    ],
                    { page: Number(new URL(request.url).searchParams.get('page')), totalPages: 3 },
                );
            }),
        );

        renderSideBar({ agent: makeAgent({ spaces: { enabled: true } }) });

        await user.click(await screen.findByRole('button', { name: 'Show more spaces' }));

        await waitFor(() => {
            expect(projectPages).toBe(2);
        });
    });
});
