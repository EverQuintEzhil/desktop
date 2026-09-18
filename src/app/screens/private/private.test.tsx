import { act, screen, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setTenant } from '@/store/reducers/tenant';
import { authenticatedUser, testTenant } from '@/test/fixtures/auth';
import { apiUrl, pagedEnvelope, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';

import Private from './private';

/**
 * The other half of the session-expiry contract: `handleSessionExpired` writes
 * `deep_link` into sessionStorage before bouncing to `/accounts`, and this is
 * where a freshly signed-in user is supposed to be sent back to it.
 * `handle-session-expired.test.ts` covers the write side.
 */
// Defined inside the factory: `vi.mock` is hoisted above module-scope consts.
vi.mock('./screens', async () => {
    const { Outlet } = await import('react-router-dom');
    const stubScreen = (label: string) => () => <div>{label}</div>;

    return {
        Agents: stubScreen('agents-screen'),
        Agent: stubScreen('agent-screen'),
        ArtifactPage: stubScreen('artifact-page-screen'),
        // Blogs is a layout route now, so the stub has to pass its children through.
        Blogs: () => (
            <div>
                blogs-screen
                <Outlet />
            </div>
        ),
        Blog: stubScreen('blog-screen'),
        BlogAllPosts: stubScreen('blog-all-posts-screen'),
        BlogCollections: stubScreen('blog-collections-screen'),
        BlogCollectionDetail: stubScreen('blog-collection-detail-screen'),
        CreateAgent: stubScreen('create-agent-screen'),
        CreateAgentEditor: stubScreen('create-agent-editor-screen'),
        Connectors: stubScreen('connectors-screen'),
        SettingsLayout: () => (
            <div>
                settings-screen
                <Outlet />
            </div>
        ),
        Skills: stubScreen('skills-screen'),
        LibraryPage: stubScreen('library-screen'),
        GlobalLibrary: stubScreen('global-library-screen'),
        Memories: stubScreen('memories-screen'),
        Routines: stubScreen('routines-screen'),
        RoutineDetail: stubScreen('routine-detail-screen'),
    };
});

vi.mock('@/app/screens/private/screens/sample-designs/sample-designs', () => ({
    default: () => <div>sample-designs-screen</div>,
}));

vi.mock('@/app/components/announcements-modal', () => ({ default: () => null }));

/**
 * `useAnnouncements` is under test here — the announcements effect is wired through it — so it runs
 * for real against MSW rather than being stubbed out.
 */
const announcementRequests: string[] = [];

beforeEach(() => {
    sessionStorage.clear();
    announcementRequests.length = 0;
    server.use(
        http.get(apiUrl('/blogposts'), ({ request }) => {
            announcementRequests.push(request.url);

            return pagedEnvelope([], { page: 0 });
        }),
    );
});

/** Lets every queued fetch and re-render land, so an assertion can prove one did *not* happen. */
const settle = async () => {
    await act(async () => {
        await new Promise((resolve) => {
            setTimeout(resolve, 50);
        });
    });
};

afterEach(() => {
    sessionStorage.clear();
});

describe('Private — returning to where the user left off', () => {
    it('consumes a stored deep link and navigates there', async () => {
        sessionStorage.setItem('deep_link', 'http://localhost:3000/announcements');

        renderWithProviders(<Private />, { route: '/' });

        expect(await screen.findByText('blogs-screen')).toBeInTheDocument();
    });

    it('clears the deep link so a later reload does not bounce again', async () => {
        sessionStorage.setItem('deep_link', 'http://localhost:3000/announcements');

        renderWithProviders(<Private />, { route: '/' });

        await waitFor(() => {
            expect(sessionStorage.getItem('deep_link')).toBeNull();
        });
    });

    it('restores a deep-linked conversation URL', async () => {
        sessionStorage.setItem('deep_link', 'http://localhost:3000/agent/agent-1/chat/conv-42');

        renderWithProviders(<Private />, { route: '/' });

        expect(await screen.findByText('agent-screen')).toBeInTheDocument();
    });

    it('ignores an off-origin deep link rather than following it', async () => {
        sessionStorage.setItem('deep_link', 'https://evil.test/steal');

        renderWithProviders(<Private />, { route: '/' });

        expect(await screen.findByText('agents-screen')).toBeInTheDocument();
    });

    it('lands on the agents home when there is no deep link', async () => {
        renderWithProviders(<Private />, { route: '/' });

        expect(await screen.findByText('agents-screen')).toBeInTheDocument();
    });

    it('honours a redirect_uri query param when no deep link is stored', async () => {
        renderWithProviders(<Private />, { route: '/?redirect_uri=/announcements' });

        expect(await screen.findByText('blogs-screen')).toBeInTheDocument();
    });
});

describe('Private — What’s New routes', () => {
    it('renders the announcements page by default', async () => {
        renderWithProviders(<Private />, { route: '/announcements' });

        expect(await screen.findByText('blogs-screen')).toBeInTheDocument();
    });

    it('sends /announcements home when the tenant hides What’s New', async () => {
        renderWithProviders(<Private />, {
            route: '/announcements',
            preloadedState: { tenant: { ...testTenant, hideWhatsNew: true } },
        });

        expect(await screen.findByText('agents-screen')).toBeInTheDocument();
    });

    it('sends a blog post URL home when the tenant hides What’s New', async () => {
        renderWithProviders(<Private />, {
            route: '/announcements/post-1',
            preloadedState: { tenant: { ...testTenant, hideWhatsNew: true } },
        });

        expect(await screen.findByText('agents-screen')).toBeInTheDocument();
    });

    it('mounts the all-posts feed at /announcements', async () => {
        renderWithProviders(<Private />, { route: '/announcements' });

        expect(await screen.findByText('blog-all-posts-screen')).toBeInTheDocument();
    });

    // /help-center/collections/:id must win over /help-center/:blogPostId — React Router ranks a static
    // segment above a dynamic one, and the whole collections flow rests on that.
    it('mounts the collections grid at /help-center, not the post screen', async () => {
        renderWithProviders(<Private />, { route: '/help-center' });

        expect(await screen.findByText('blog-collections-screen')).toBeInTheDocument();
        expect(screen.queryByText('blog-screen')).not.toBeInTheDocument();
    });

    it('mounts the collection detail at /help-center/collections/:categoryId', async () => {
        renderWithProviders(<Private />, { route: '/help-center/collections/tag-1' });

        expect(await screen.findByText('blog-collection-detail-screen')).toBeInTheDocument();
    });

    it('mounts the post screen for a slug under /announcements', async () => {
        renderWithProviders(<Private />, { route: '/announcements/announcing-fluent-mind-v2' });

        expect(await screen.findByText('blog-screen')).toBeInTheDocument();
    });

    it('keeps the What’s New gate on every child route', async () => {
        renderWithProviders(<Private />, {
            route: '/help-center/collections/tag-1',
            preloadedState: { tenant: { ...testTenant, hideWhatsNew: true } },
        });

        expect(await screen.findByText('agents-screen')).toBeInTheDocument();
    });
});

describe('Private — agent builder routes', () => {
    it('opens the builder for a new agent by default', async () => {
        renderWithProviders(<Private />, { route: '/agent-builder' });

        expect(await screen.findByText('create-agent-screen')).toBeInTheDocument();
    });

    it('sends the new-agent builder home when the tenant hides Create Agent', async () => {
        renderWithProviders(<Private />, {
            route: '/agent-builder',
            preloadedState: { tenant: { ...testTenant, hideCreateAgent: true } },
        });

        expect(await screen.findByText('agents-screen')).toBeInTheDocument();
    });

    it('still opens the builder for an existing agent when the tenant hides Create Agent', async () => {
        renderWithProviders(<Private />, {
            route: '/agent-builder/agent-1',
            preloadedState: { tenant: { ...testTenant, hideCreateAgent: true } },
        });

        expect(await screen.findByText('create-agent-editor-screen')).toBeInTheDocument();
    });
});

describe('Private — per-role launcher settings', () => {
    it('does NOT lock an admin out of the agent builder when Create Agent is hidden from users only', async () => {
        renderWithProviders(<Private />, {
            route: '/agent-builder',
            preloadedState: {
                tenant: { ...testTenant, hideCreateAgent: { visibleToRoles: ['admin'] } },
                user: { ...authenticatedUser, role: 'admin' },
            },
        });

        expect(await screen.findByText('create-agent-screen')).toBeInTheDocument();
    });

    it('still sends a plain user home when Create Agent is hidden from users only', async () => {
        renderWithProviders(<Private />, {
            route: '/agent-builder',
            preloadedState: {
                tenant: { ...testTenant, hideCreateAgent: { visibleToRoles: ['admin'] } },
                user: { ...authenticatedUser, role: 'user' },
            },
        });

        expect(await screen.findByText('agents-screen')).toBeInTheDocument();
    });

    it('sends an admin home when the master hide is on', async () => {
        renderWithProviders(<Private />, {
            route: '/agent-builder',
            preloadedState: {
                tenant: { ...testTenant, hideCreateAgent: { hidden: true, visibleToRoles: ['admin'] } },
                user: { ...authenticatedUser, role: 'admin' },
            },
        });

        expect(await screen.findByText('agents-screen')).toBeInTheDocument();
    });

    it('keeps the blogs page for a listed role and blocks it for an unlisted one', async () => {
        const tenant = { ...testTenant, hideWhatsNew: { visibleToRoles: ['owner' as const] } };

        const admin = renderWithProviders(<Private />, {
            route: '/announcements',
            preloadedState: { tenant, user: { ...authenticatedUser, role: 'owner' } },
        });

        expect(await screen.findByText('blogs-screen')).toBeInTheDocument();
        admin.unmount();

        renderWithProviders(<Private />, {
            route: '/announcements',
            preloadedState: { tenant, user: { ...authenticatedUser, role: 'developer' } },
        });

        expect(await screen.findByText('agents-screen')).toBeInTheDocument();
    });
});

describe('Private — announcements follow a late tenant refresh', () => {
    it('fetches announcements once the background tenant refresh clears hideWhatsNew', async () => {
        const { store } = renderWithProviders(<Private />, {
            route: '/',
            preloadedState: { tenant: { ...testTenant, hideWhatsNew: true } },
        });

        expect(await screen.findByText('agents-screen')).toBeInTheDocument();
        await settle();

        expect(announcementRequests).toHaveLength(0);

        act(() => {
            store.dispatch(setTenant({ ...testTenant, hideWhatsNew: false }));
        });

        await waitFor(() => {
            expect(announcementRequests).toHaveLength(1);
        });
    });

    it('does not fetch on a route that cannot show the modal', async () => {
        renderWithProviders(<Private />, { route: '/help-center/collections/tag-1' });

        expect(await screen.findByText('blog-collection-detail-screen')).toBeInTheDocument();
        await settle();

        expect(announcementRequests).toHaveLength(0);
    });

    it('fetches once and does not refetch when a late refresh turns hideWhatsNew on', async () => {
        const { store } = renderWithProviders(<Private />, { route: '/' });

        expect(await screen.findByText('agents-screen')).toBeInTheDocument();

        await waitFor(() => {
            expect(announcementRequests).toHaveLength(1);
        });

        act(() => {
            store.dispatch(setTenant({ ...testTenant, hideWhatsNew: true }));
        });

        await settle();

        expect(announcementRequests).toHaveLength(1);
    });
});

describe('Private — settings routines route', () => {
    it('sends /settings/routines home when the tenant has never enabled Routines', async () => {
        renderWithProviders(<Private />, { route: '/settings/routines' });

        expect(await screen.findByText('agents-screen')).toBeInTheDocument();
        expect(screen.queryByText('routines-screen')).not.toBeInTheDocument();
    });

    it('opens /settings/routines once the tenant makes Routines visible', async () => {
        renderWithProviders(<Private />, {
            route: '/settings/routines',
            preloadedState: { tenant: { ...testTenant, hideRoutines: false } },
        });

        expect(await screen.findByText('routines-screen')).toBeInTheDocument();
    });

    it('sends /settings/routines home for a role outside the tenant role list', async () => {
        renderWithProviders(<Private />, {
            route: '/settings/routines',
            preloadedState: {
                tenant: { ...testTenant, hideRoutines: { visibleToRoles: ['admin'] } },
                user: { ...authenticatedUser, role: 'user' },
            },
        });

        expect(await screen.findByText('agents-screen')).toBeInTheDocument();
    });

    it('sends a routine detail URL home when the tenant has never enabled Routines', async () => {
        renderWithProviders(<Private />, { route: '/settings/routines/routine-1' });

        expect(await screen.findByText('agents-screen')).toBeInTheDocument();
        expect(screen.queryByText('routine-detail-screen')).not.toBeInTheDocument();
    });

    it('opens a routine detail URL once the tenant makes Routines visible', async () => {
        renderWithProviders(<Private />, {
            route: '/settings/routines/routine-1',
            preloadedState: { tenant: { ...testTenant, hideRoutines: false } },
        });

        expect(await screen.findByText('routine-detail-screen')).toBeInTheDocument();
    });

    it('sends a routine detail URL home for a role outside the tenant role list', async () => {
        renderWithProviders(<Private />, {
            route: '/settings/routines/routine-1',
            preloadedState: {
                tenant: { ...testTenant, hideRoutines: { visibleToRoles: ['admin'] } },
                user: { ...authenticatedUser, role: 'user' },
            },
        });

        expect(await screen.findByText('agents-screen')).toBeInTheDocument();
    });
});
