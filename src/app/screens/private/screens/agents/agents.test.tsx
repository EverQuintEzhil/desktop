import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http } from 'msw';
import { useEffect, type ReactElement } from 'react';
import { useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AgentLayoutPayload, AgentPinScope } from '@/lib/api/app/agent-layout';
import { sampleLauncher } from '@/test/fixtures/agents';
import { authenticatedUser, testTenant } from '@/test/fixtures/auth';
import { apiUrl, envelope, httpError, pagedEnvelope, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';

import { AGENT_PIN_LIMIT } from './agent-layout';
import Agents from './agents';

const emptyTags = () => envelope({ values: [] });

const myAgent = {
    _id: 'agent-9',
    name: 'My Draft Agent',
    slug: 'my-draft-agent',
    description: 'Only visible under the my scope',
};

const launcherAt = (index: number) => ({
    ...sampleLauncher,
    _id: `launcher-${index}`,
    name: `Agent ${index}`,
    urlOrSlug: `agent-${index}`,
    description: `Description ${index}`,
});

const launchers = (count: number) => Array.from({ length: count }, (_, index) => launcherAt(index + 1));

const LAYOUT_PATH = '/users/me/agentlayout';

/** The stored layout row behind `/users/me/agentlayout`. Two separate lists; a tab whose key is absent takes the defaults. */
let layoutRow: AgentLayoutPayload | null = null;

/** Every `PUT` body, so the exact keys a pin sends can be asserted. */
const layoutPatches: AgentLayoutPayload[] = [];

const storePinned = (scope: AgentPinScope, pinned: string[]) => {
    layoutRow = { ...layoutRow, [scope]: pinned };
};

const readStoredPins = (scope: AgentPinScope): string[] | undefined => layoutRow?.[scope];

const stubLayoutEndpoint = () => {
    server.use(
        http.get(apiUrl(LAYOUT_PATH), () => envelope(layoutRow)),
        // Merged rather than replaced, the way the endpoint's jsonb `||` treats the patch.
        http.put(apiUrl(LAYOUT_PATH), async ({ request }) => {
            const body = (await request.json()) as AgentLayoutPayload;

            layoutPatches.push(body);
            layoutRow = { ...layoutRow, ...body };

            return envelope(layoutRow);
        }),
    );
};

const pinnedRegion = () => screen.getByRole('region', { name: 'Pinned' });

const PINNED_PLACEHOLDER_LABEL = 'Loading pinned agents';

const pinnedPlaceholder = () => screen.getByLabelText(PINNED_PLACEHOLDER_LABEL);

/** How many placeholder tiles the row is holding; they carry no role of their own by design. */
const placeholderTileCount = (): number => pinnedPlaceholder().querySelectorAll('.agent-card').length;

/** A response the test releases by hand, so an assertion can land inside the in-flight window. */
const deferred = () => {
    let release = () => {};
    const held = new Promise<void>((resolve) => {
        release = resolve;
    });

    return { held, release: () => release() };
};

/**
 * Records whether the placeholder row was ever in the DOM, not just whether it is now: "no flash"
 * cannot be proven by looking once the row has settled.
 */
const watchForPlaceholder = () => {
    let appeared = false;
    const sample = () => {
        if (document.querySelector(`[aria-label="${PINNED_PLACEHOLDER_LABEL}"]`) !== null) {
            appeared = true;
        }
    };
    const observer = new MutationObserver(sample);

    observer.observe(document.body, { childList: true, subtree: true });

    return {
        appeared: () => {
            sample();
            observer.disconnect();

            return appeared;
        },
    };
};

/** The real app mounts the `sonner` outlet at its root, so a toast is only assertable with it present. */
const withToasts = (ui: ReactElement): ReactElement => (
    <>
        {ui}
        <Toaster />
    </>
);

/**
 * The paginated list read and the by-ids pin lookup share one path on the real endpoint, so every
 * handler below tells them apart by the repeated `ids` param.
 */
const requestedIds = (request: Request): string[] => new URL(request.url).searchParams.getAll('ids');

const PINNED_LOOKUP_ERROR = "Couldn't load some of your pinned agents. Reload the page and try again.";

/** Lets every queued fetch and re-render land, so an assertion can prove one did *not* happen. */
const settle = async () => {
    await act(async () => {
        await new Promise((resolve) => {
            setTimeout(resolve, 150);
        });
    });
};

/**
 * react-query's focus manager listens for `visibilitychange` on `window` and reads
 * `document.visibilityState`, which jsdom keeps at `visible`; a `focus` event is ignored entirely.
 */
const regainFocus = async () => {
    act(() => {
        window.dispatchEvent(new Event('visibilitychange'));
    });

    await settle();
};

/** A disabled button emits no pointer events, so its tooltip is opened from the wrapping trigger. */
const tooltipTriggerOf = (button: HTMLElement): HTMLElement => {
    const trigger = button.closest<HTMLElement>('[data-slot="tooltip-trigger"]');

    if (trigger === null) {
        throw new Error('The pin button is not wrapped in a tooltip trigger.');
    }

    return trigger;
};

describe('Agents home', () => {
    beforeEach(() => {
        // `usePersistentSearchParam` stores the scope in sessionStorage, which outlives `cleanup()`:
        // a test that ends on the My tab would otherwise pick the tab for the test after it.
        sessionStorage.clear();
        layoutRow = null;
        layoutPatches.length = 0;
        stubLayoutEndpoint();
        server.use(respond('get', '/tags', emptyTags));
    });

    it('renders the home shell and empty firmwide agents state', async () => {
        server.use(respond('get', '/launchers', () => pagedEnvelope([], { page: 0 })));

        renderWithProviders(<Agents />, { route: '/' });

        expect(screen.getByAltText('Fluent Mind')).toBeInTheDocument();
        expect(screen.getByText('Firmwide')).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByText('No Agents Found')).toBeInTheDocument();
        });
    });

    it('renders agent cards when launchers are returned', async () => {
        server.use(respond('get', '/launchers', () => pagedEnvelope([sampleLauncher], { page: 0 })));

        renderWithProviders(<Agents />, { route: '/' });

        await waitFor(() => {
            expect(screen.getByText('Research Assistant')).toBeInTheDocument();
        });

        expect(screen.getByText('Helps with research tasks')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Research Assistant/i })).toHaveAttribute(
            'href',
            '/agent/research-assistant',
        );
    });

    it('renders an error state when launchers fail to load', async () => {
        server.use(respond('get', '/launchers', () => httpError(500)));

        renderWithProviders(<Agents />, { route: '/' });

        await waitFor(() => {
            expect(screen.getByText('Error Occurred')).toBeInTheDocument();
        });
    });

    it('renders an error state when the API answers success: false', async () => {
        server.use(
            respond(
                'get',
                '/launchers',
                () =>
                    new Response(JSON.stringify({ success: false, message: 'Launchers unavailable', value: null }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    }),
            ),
        );

        renderWithProviders(<Agents />, { route: '/' });

        await waitFor(() => {
            expect(screen.getByText('Error Occurred')).toBeInTheDocument();
        });
    });

    it('requests the firmwide launcher list with the default page size', async () => {
        let requestUrl = '';

        server.use(
            http.get(apiUrl('/launchers'), ({ request }) => {
                if (requestedIds(request).length === 0) {
                    requestUrl = request.url;
                }

                return pagedEnvelope([sampleLauncher], { page: 0 });
            }),
        );

        renderWithProviders(<Agents />, { route: '/' });

        await waitFor(() => {
            expect(requestUrl).not.toBe('');
        });

        const params = new URL(requestUrl).searchParams;

        expect(params.get('size')).toBe('20');
        expect(params.get('page')).toBe('0');
        expect(params.get('search')).toBeNull();
    });

    it('renders the category filter options returned by the tags endpoint', async () => {
        server.use(
            respond('get', '/tags', () =>
                envelope({
                    values: [
                        { _id: 'tag-1', name: 'Design' },
                        { _id: 'tag-2', name: 'Research' },
                    ],
                }),
            ),
        );
        server.use(respond('get', '/launchers', () => pagedEnvelope([sampleLauncher], { page: 0 })));

        renderWithProviders(<Agents />, { route: '/' });

        await waitFor(() => {
            expect(screen.getByText('Research Assistant')).toBeInTheDocument();
        });

        expect(screen.getAllByText('All').length).toBeGreaterThan(0);
    });

    it('queries /agents with mineOnly when the scope param is my', async () => {
        let agentsUrl = '';

        server.use(respond('get', '/launchers', () => pagedEnvelope(launchers(6), { page: 0 })));
        server.use(
            http.get(apiUrl('/agents'), ({ request }) => {
                agentsUrl = request.url;

                return pagedEnvelope([myAgent], { page: 0 });
            }),
        );

        renderWithProviders(<Agents />, { route: '/?scope=my' });

        await waitFor(() => {
            expect(screen.getByText('My Draft Agent')).toBeInTheDocument();
        });

        const params = new URL(agentsUrl).searchParams;

        expect(params.get('mineOnly')).toBe('true');
        expect(params.get('size')).toBe('20');
    });

    it('sorts the my list by name by default', async () => {
        let agentsUrl = '';

        server.use(respond('get', '/launchers', () => pagedEnvelope(launchers(6), { page: 0 })));
        server.use(
            http.get(apiUrl('/agents'), ({ request }) => {
                agentsUrl = request.url;

                return pagedEnvelope([myAgent], { page: 0 });
            }),
        );

        renderWithProviders(<Agents />, { route: '/?scope=my' });

        await waitFor(() => {
            expect(screen.getByText('My Draft Agent')).toBeInTheDocument();
        });

        expect(new URL(agentsUrl).searchParams.get('sortBy')).toBe('name:asc');
    });

    it('refetches with the chosen sort', async () => {
        const user = userEvent.setup();
        const sorts: (string | null)[] = [];

        server.use(respond('get', '/launchers', () => pagedEnvelope(launchers(6), { page: 0 })));
        server.use(
            http.get(apiUrl('/agents'), ({ request }) => {
                sorts.push(new URL(request.url).searchParams.get('sortBy'));

                return pagedEnvelope([myAgent], { page: 0 });
            }),
        );

        renderWithProviders(<Agents />, { route: '/?scope=my' });

        await waitFor(() => {
            expect(screen.getByText('My Draft Agent')).toBeInTheDocument();
        });

        await user.click(screen.getByRole('combobox', { name: 'Sort agents' }));
        await user.click(await screen.findByText('Last used date'));

        await waitFor(() => {
            expect(sorts).toContain('lastInteractedAt:desc');
        });
    });

    it('leaves the firmwide tab without a sort control', async () => {
        server.use(respond('get', '/launchers', () => pagedEnvelope([sampleLauncher], { page: 0 })));

        renderWithProviders(<Agents />, { route: '/' });

        await waitFor(() => {
            expect(screen.getByText('Research Assistant')).toBeInTheDocument();
        });

        expect(screen.queryByRole('combobox', { name: 'Sort agents' })).not.toBeInTheDocument();
    });

    it('sends the typed search term to the launchers endpoint', async () => {
        const searches: (string | null)[] = [];

        server.use(
            http.get(apiUrl('/launchers'), ({ request }) => {
                searches.push(new URL(request.url).searchParams.get('search'));

                return pagedEnvelope([sampleLauncher], { page: 0 });
            }),
        );

        renderWithProviders(<Agents />, { route: '/' });

        await waitFor(() => {
            expect(screen.getByText('Research Assistant')).toBeInTheDocument();
        });

        expect(searches[0]).toBeNull();

        await userEvent.type(screen.getByPlaceholderText('Search for AI agents in Fluent Mind'), 'research');

        await waitFor(
            () => {
                expect(searches).toContain('research');
            },
            { timeout: 3000 },
        );
    });

    describe('create agent control', () => {
        const hideCreateAgent = { tenant: { ...testTenant, hideCreateAgent: true } };

        it('renders the create agent link next to the search input by default', async () => {
            server.use(respond('get', '/launchers', () => pagedEnvelope([sampleLauncher], { page: 0 })));

            renderWithProviders(<Agents />, { route: '/' });

            await waitFor(() => {
                expect(screen.getByText('Research Assistant')).toBeInTheDocument();
            });

            expect(screen.getByRole('link', { name: 'Create Agent' })).toHaveAttribute('href', '/agent-builder');
            expect(screen.getByPlaceholderText('Search for AI agents in Fluent Mind')).toBeInTheDocument();
        });

        it('drops the create agent link but keeps search working when the tenant hides it', async () => {
            const searches: (string | null)[] = [];

            server.use(
                http.get(apiUrl('/launchers'), ({ request }) => {
                    searches.push(new URL(request.url).searchParams.get('search'));

                    return pagedEnvelope([sampleLauncher], { page: 0 });
                }),
            );

            renderWithProviders(<Agents />, { route: '/', preloadedState: hideCreateAgent });

            await waitFor(() => {
                expect(screen.getByText('Research Assistant')).toBeInTheDocument();
            });

            expect(screen.queryByRole('link', { name: 'Create Agent' })).not.toBeInTheDocument();
            expect(screen.getAllByText('All').length).toBeGreaterThan(0);

            await userEvent.type(screen.getByPlaceholderText('Search for AI agents in Fluent Mind'), 'research');

            await waitFor(
                () => {
                    expect(searches).toContain('research');
                },
                { timeout: 3000 },
            );
        });

        it('keeps the whole search block hidden when the tenant hides search as well', async () => {
            server.use(respond('get', '/launchers', () => pagedEnvelope([sampleLauncher], { page: 0 })));

            renderWithProviders(<Agents />, {
                route: '/',
                preloadedState: { tenant: { ...testTenant, hideCreateAgent: true, hideSearchBar: true } },
            });

            await waitFor(() => {
                expect(screen.getByText('Research Assistant')).toBeInTheDocument();
            });

            expect(screen.queryByPlaceholderText('Search for AI agents in Fluent Mind')).not.toBeInTheDocument();
            expect(screen.queryByRole('link', { name: 'Create Agent' })).not.toBeInTheDocument();
        });

        it('still offers the edit control for an existing agent while the create agent link is hidden', async () => {
            server.use(respond('get', '/launchers', () => pagedEnvelope(launchers(3), { page: 0 })));
            server.use(respond('get', '/agents', () => pagedEnvelope([myAgent], { page: 0 })));

            renderWithProviders(<Agents />, { route: '/?scope=my', preloadedState: hideCreateAgent });

            await waitFor(() => {
                expect(screen.getByText('My Draft Agent')).toBeInTheDocument();
            });

            expect(screen.queryByRole('link', { name: 'Create Agent' })).not.toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Edit My Draft Agent' })).toBeInTheDocument();
        });
    });

    describe('tenant-hidden home controls', () => {
        const SEARCH_PLACEHOLDER = 'Search for AI agents in Fluent Mind';

        const tenantWith = (flags: Partial<typeof testTenant>) => ({ tenant: { ...testTenant, ...flags } });

        const taggedTags = () =>
            envelope({
                values: [
                    { _id: 'tag-1', name: 'Design' },
                    { _id: 'tag-2', name: 'Research' },
                ],
            });

        it('renders the scope switch, the category filter and the search input by default', async () => {
            server.use(respond('get', '/tags', taggedTags));
            server.use(respond('get', '/launchers', () => pagedEnvelope([sampleLauncher], { page: 0 })));

            renderWithProviders(<Agents />, { route: '/' });

            await waitFor(() => {
                expect(screen.getByText('Research Assistant')).toBeInTheDocument();
            });

            expect(screen.getByText('Firmwide')).toBeInTheDocument();
            expect(screen.getAllByText('All').length).toBeGreaterThan(0);
            expect(screen.getByPlaceholderText(SEARCH_PLACEHOLDER)).toBeInTheDocument();
        });

        it('drops the scope switch but keeps the firmwide list when the tenant hides it', async () => {
            let launchersUrl = '';

            server.use(
                http.get(apiUrl('/launchers'), ({ request }) => {
                    launchersUrl = request.url;

                    return pagedEnvelope([sampleLauncher], { page: 0 });
                }),
            );

            renderWithProviders(<Agents />, { route: '/', preloadedState: tenantWith({ hideScopeSwitch: true }) });

            await waitFor(() => {
                expect(screen.getByText('Research Assistant')).toBeInTheDocument();
            });

            expect(screen.queryByText('Firmwide')).not.toBeInTheDocument();
            expect(new URL(launchersUrl).searchParams.get('page')).toBe('0');
        });

        it('loads the firmwide list when the switch is hidden and the stored scope is my', async () => {
            const myAgentRequests: string[] = [];

            sessionStorage.setItem('search-param:scope', 'my');
            server.use(respond('get', '/launchers', () => pagedEnvelope([sampleLauncher], { page: 0 })));
            server.use(
                http.get(apiUrl('/agents'), ({ request }) => {
                    if (requestedIds(request).length === 0) {
                        myAgentRequests.push(request.url);
                    }

                    return pagedEnvelope([myAgent], { page: 0 });
                }),
            );

            renderWithProviders(<Agents />, {
                route: '/?scope=my',
                preloadedState: tenantWith({ hideScopeSwitch: true }),
            });

            await waitFor(() => {
                expect(screen.getByText('Research Assistant')).toBeInTheDocument();
            });

            await settle();

            expect(myAgentRequests).toEqual([]);
            expect(screen.queryByText('My Draft Agent')).not.toBeInTheDocument();
        });

        it('still selects the my scope from sessionStorage while the switch is visible', async () => {
            let agentsUrl = '';

            sessionStorage.setItem('search-param:scope', 'my');
            server.use(respond('get', '/launchers', () => pagedEnvelope([sampleLauncher], { page: 0 })));
            server.use(
                http.get(apiUrl('/agents'), ({ request }) => {
                    if (requestedIds(request).length === 0) {
                        agentsUrl = request.url;
                    }

                    return pagedEnvelope([myAgent], { page: 0 });
                }),
            );

            renderWithProviders(<Agents />, { route: '/' });

            await waitFor(() => {
                expect(screen.getByText('My Draft Agent')).toBeInTheDocument();
            });

            expect(new URL(agentsUrl).searchParams.get('mineOnly')).toBe('true');
        });

        it('drops the category filter but keeps the search input working when the tenant hides it', async () => {
            const searches: (string | null)[] = [];

            server.use(respond('get', '/tags', taggedTags));
            server.use(
                http.get(apiUrl('/launchers'), ({ request }) => {
                    searches.push(new URL(request.url).searchParams.get('search'));

                    return pagedEnvelope([sampleLauncher], { page: 0 });
                }),
            );

            renderWithProviders(<Agents />, { route: '/', preloadedState: tenantWith({ hideCategoryFilter: true }) });

            await waitFor(() => {
                expect(screen.getByText('Research Assistant')).toBeInTheDocument();
            });

            expect(screen.queryByText('All')).not.toBeInTheDocument();

            await userEvent.type(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), 'research');

            await waitFor(
                () => {
                    expect(searches).toContain('research');
                },
                { timeout: 3000 },
            );
        });

        it('drops the search input but keeps the category filter when the tenant hides it', async () => {
            server.use(respond('get', '/tags', taggedTags));
            server.use(respond('get', '/launchers', () => pagedEnvelope([sampleLauncher], { page: 0 })));

            renderWithProviders(<Agents />, { route: '/', preloadedState: tenantWith({ hideSearchInput: true }) });

            await waitFor(() => {
                expect(screen.getByText('Research Assistant')).toBeInTheDocument();
            });

            expect(screen.queryByPlaceholderText(SEARCH_PLACEHOLDER)).not.toBeInTheDocument();
            expect(screen.getAllByText('All').length).toBeGreaterThan(0);
            expect(screen.getByRole('link', { name: 'Create Agent' })).toBeInTheDocument();
        });

        it('renders no leftover search row when every control inside it is hidden', async () => {
            server.use(respond('get', '/tags', taggedTags));
            server.use(respond('get', '/launchers', () => pagedEnvelope([sampleLauncher], { page: 0 })));

            renderWithProviders(<Agents />, {
                route: '/',
                preloadedState: tenantWith({
                    hideCategoryFilter: true,
                    hideSearchInput: true,
                    hideCreateAgent: true,
                }),
            });

            await waitFor(() => {
                expect(screen.getByText('Research Assistant')).toBeInTheDocument();
            });

            expect(document.querySelector('.search-dropdown')).toBeNull();
        });

        it('keeps the whole search block hidden when hideSearchBar is on and the finer flags are off', async () => {
            server.use(respond('get', '/tags', taggedTags));
            server.use(respond('get', '/launchers', () => pagedEnvelope([sampleLauncher], { page: 0 })));

            renderWithProviders(<Agents />, {
                route: '/',
                preloadedState: tenantWith({ hideSearchBar: true }),
            });

            await waitFor(() => {
                expect(screen.getByText('Research Assistant')).toBeInTheDocument();
            });

            expect(document.querySelector('.search-dropdown')).toBeNull();
            expect(screen.queryByPlaceholderText(SEARCH_PLACEHOLDER)).not.toBeInTheDocument();
            expect(screen.queryByText('All')).not.toBeInTheDocument();
            expect(screen.queryByRole('link', { name: 'Create Agent' })).not.toBeInTheDocument();
        });
    });

    describe('pinned agents', () => {
        it('pins the top of the firmwide order by default and splits the grid', async () => {
            server.use(respond('get', '/launchers', () => pagedEnvelope(launchers(6), { page: 0 })));

            renderWithProviders(<Agents />, { route: '/' });

            await waitFor(() => {
                expect(screen.getByRole('heading', { name: 'Pinned' })).toBeInTheDocument();
            });

            const pinned = pinnedRegion();

            expect(within(pinned).getAllByRole('link')).toHaveLength(4);
            expect(within(pinned).getByRole('link', { name: /Agent 1/ })).toBeInTheDocument();
            expect(within(pinned).queryByRole('link', { name: /Agent 5/ })).not.toBeInTheDocument();

            const rest = screen.getByRole('region', { name: 'All agents' });

            expect(within(rest).getAllByRole('link')).toHaveLength(2);
        });

        it('pins and unpins an agent from the lower grid', async () => {
            server.use(respond('get', '/launchers', () => pagedEnvelope(launchers(6), { page: 0 })));

            renderWithProviders(<Agents />, { route: '/' });

            await waitFor(() => {
                expect(screen.getByRole('heading', { name: 'Pinned' })).toBeInTheDocument();
            });

            await userEvent.click(screen.getByRole('button', { name: 'Pin Agent 5' }));

            await waitFor(() => {
                expect(within(pinnedRegion()).getByRole('link', { name: /Agent 5/ })).toBeInTheDocument();
            });

            await userEvent.click(within(pinnedRegion()).getByRole('button', { name: 'Unpin Agent 5' }));

            await waitFor(() => {
                expect(within(pinnedRegion()).queryByRole('link', { name: /Agent 5/ })).not.toBeInTheDocument();
            });

            expect(screen.getByRole('button', { name: 'Pin Agent 5' })).toBeInTheDocument();
        });

        it('collapses the pinned section into a flat grid while a search is active', async () => {
            server.use(respond('get', '/launchers', () => pagedEnvelope(launchers(6), { page: 0 })));

            renderWithProviders(<Agents />, { route: '/' });

            await waitFor(() => {
                expect(screen.getByRole('heading', { name: 'Pinned' })).toBeInTheDocument();
            });

            await userEvent.type(screen.getByPlaceholderText('Search for AI agents in Fluent Mind'), 'agent');

            await waitFor(
                () => {
                    expect(screen.queryByRole('heading', { name: 'Pinned' })).not.toBeInTheDocument();
                },
                { timeout: 3000 },
            );

            await waitFor(() => {
                expect(screen.getByRole('region', { name: 'Agents' })).toBeInTheDocument();
            });

            expect(screen.getByRole('button', { name: 'Unpin Agent 1' })).toBeInTheDocument();
        });

        it('disables the pin control for unpinned agents once the pin limit is reached', async () => {
            // Derived from the cap, so raising it cannot leave this seeding an under-cap list.
            const unpinnable = `Pin Agent ${AGENT_PIN_LIMIT + 1}`;

            storePinned(
                'firm',
                launchers(AGENT_PIN_LIMIT).map((launcher) => launcher._id),
            );
            server.use(respond('get', '/launchers', () => pagedEnvelope(launchers(AGENT_PIN_LIMIT + 1), { page: 0 })));

            renderWithProviders(<Agents />, { route: '/' });

            await waitFor(() => {
                expect(screen.getByRole('button', { name: unpinnable })).toBeDisabled();
            });

            await userEvent.hover(tooltipTriggerOf(screen.getByRole('button', { name: unpinnable })));

            expect(await screen.findByRole('tooltip')).toHaveTextContent(
                `You can pin up to ${AGENT_PIN_LIMIT} agents. Unpin one to pin another.`,
            );
        });

        it('renders the reorder grip of an external-link tile outside the anchor', async () => {
            const linkLauncher = {
                ...launcherAt(1),
                type: 'link',
                urlOrSlug: 'https://example.com/tool',
            };

            server.use(respond('get', '/launchers', () => pagedEnvelope([linkLauncher], { page: 0 })));

            renderWithProviders(<Agents />, { route: '/' });

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Reorder Agent 1' })).toBeInTheDocument();
            });

            const anchor = within(pinnedRegion()).getByRole('link', { name: /Agent 1/ });

            expect(anchor).toHaveAttribute('href', 'https://example.com/tool');
            expect(anchor).toHaveAttribute('target', '_blank');

            /*
             * dnd-kit ends a pointer drag with a capture-phase `stopPropagation` on the trailing
             * click, which cannot cancel a native anchor's default action, so the grip has to stay
             * out of the anchor's ancestry. The DOM position is all jsdom can assert: with no layout
             * the drag never activates, and jsdom does not navigate either way.
             */
            expect(screen.getByRole('button', { name: 'Reorder Agent 1' }).closest('a')).toBeNull();
            expect(anchor.contains(screen.getByRole('button', { name: 'Reorder Agent 1' }))).toBe(false);
        });

        it('shares one launchers request between the grid and the default pins', async () => {
            let pagedRequests = 0;

            server.use(
                http.get(apiUrl('/launchers'), ({ request }) => {
                    if (requestedIds(request).length === 0) {
                        pagedRequests += 1;
                    }

                    return pagedEnvelope(launchers(6), { page: 0 });
                }),
            );

            renderWithProviders(<Agents />, { route: '/' });

            await waitFor(() => {
                expect(screen.getByRole('heading', { name: 'Pinned' })).toBeInTheDocument();
            });

            expect(pagedRequests).toBe(1);
        });

        it('keeps the firmwide defaults when the first ever pin is made under the my scope', async () => {
            server.use(respond('get', '/launchers', () => pagedEnvelope(launchers(6), { page: 0 })));
            server.use(respond('get', '/agents', () => pagedEnvelope([myAgent], { page: 0 })));

            renderWithProviders(<Agents />, { route: '/?scope=my' });

            await waitFor(() => {
                expect(screen.getByText('My Draft Agent')).toBeInTheDocument();
            });

            // No firmwide tile renders under this scope, and the write must not touch that list.
            expect(screen.queryByRole('heading', { name: 'Pinned' })).not.toBeInTheDocument();

            await userEvent.click(screen.getByRole('button', { name: 'Pin My Draft Agent' }));

            await waitFor(() => {
                expect(readStoredPins('my')).toEqual(['agent-9']);
            });

            expect(layoutPatches).toEqual([{ my: ['agent-9'] }]);
            expect(readStoredPins('firm')).toBeUndefined();

            await userEvent.click(screen.getByText('Firmwide'));

            await waitFor(() => {
                expect(screen.getByRole('heading', { name: 'Pinned' })).toBeInTheDocument();
            });

            const pinned = pinnedRegion();

            expect(within(pinned).getAllByRole('link')).toHaveLength(4);
            expect(within(pinned).getByRole('link', { name: /Agent 1/ })).toBeInTheDocument();
            expect(within(pinned).getByRole('link', { name: /Agent 4/ })).toBeInTheDocument();
        });

        it('shows the firmwide defaults again after they were explicitly cleared nowhere but the my tab', async () => {
            storePinned('my', []);
            server.use(respond('get', '/launchers', () => pagedEnvelope(launchers(6), { page: 0 })));

            renderWithProviders(<Agents />, { route: '/' });

            await waitFor(() => {
                expect(screen.getByRole('heading', { name: 'Pinned' })).toBeInTheDocument();
            });

            expect(within(pinnedRegion()).getAllByRole('link')).toHaveLength(4);
        });

        it('keeps the firmwide defaults out of the grid once that tab is explicitly emptied', async () => {
            storePinned('firm', []);
            server.use(respond('get', '/launchers', () => pagedEnvelope(launchers(6), { page: 0 })));

            renderWithProviders(<Agents />, { route: '/' });

            await waitFor(() => {
                expect(screen.getByRole('region', { name: 'Agents' })).toBeInTheDocument();
            });

            expect(screen.queryByRole('heading', { name: 'Pinned' })).not.toBeInTheDocument();
            expect(within(screen.getByRole('region', { name: 'Agents' })).getAllByRole('link')).toHaveLength(6);
        });

        it('disables the pin control and explains why when the stored layout cannot be read', async () => {
            server.use(respond('get', LAYOUT_PATH, () => httpError(500)));
            server.use(respond('get', '/launchers', () => pagedEnvelope(launchers(6), { page: 0 })));
            server.use(respond('get', '/agents', () => pagedEnvelope([myAgent], { page: 0 })));

            renderWithProviders(<Agents />, { route: '/?scope=my' });

            await waitFor(() => {
                expect(screen.getByText('My Draft Agent')).toBeInTheDocument();
            });

            const pinButton = screen.getByRole('button', { name: 'Pin My Draft Agent' });

            await waitFor(() => {
                expect(pinButton).toBeDisabled();
            });

            await userEvent.hover(tooltipTriggerOf(pinButton));

            expect(await screen.findByRole('tooltip')).toHaveTextContent(
                'Pinning is unavailable right now. Reload the page and try again.',
            );

            await userEvent.click(pinButton);

            expect(layoutPatches).toEqual([]);
        });

        it('keeps a pinned id that no request can resolve without rendering a tile for it', async () => {
            const known = launchers(3);

            storePinned('firm', ['launcher-2', 'launcher-404']);
            server.use(
                http.get(apiUrl('/launchers'), ({ request }) => {
                    const ids = requestedIds(request);

                    if (ids.length > 0) {
                        return pagedEnvelope(
                            known.filter((launcher) => ids.includes(launcher._id)),
                            { page: 0 },
                        );
                    }

                    return pagedEnvelope(known, { page: 0 });
                }),
            );

            renderWithProviders(<Agents />, { route: '/' });

            // The unresolvable pin holds the row in its placeholder state until the lookup answers,
            // so the heading alone does not mean the real row is mounted.
            await waitFor(() => {
                expect(within(pinnedRegion()).getByRole('link', { name: /Agent 2/ })).toBeInTheDocument();
            });

            expect(within(pinnedRegion()).getAllByRole('link')).toHaveLength(1);

            const rest = screen.getByRole('region', { name: 'All agents' });

            expect(within(rest).getAllByRole('link')).toHaveLength(2);
            expect(within(rest).queryByRole('link', { name: /Agent 2/ })).not.toBeInTheDocument();
        });

        it('renders a firmwide pin whose record is on an unfetched page, with no scrolling', async () => {
            let idsRequestUrl = '';

            storePinned('firm', ['launcher-7']);
            server.use(
                http.get(apiUrl('/launchers'), ({ request }) => {
                    const ids = requestedIds(request);

                    if (ids.length > 0) {
                        idsRequestUrl = request.url;

                        return pagedEnvelope([launcherAt(7)], { page: 0 });
                    }

                    return pagedEnvelope(launchers(3), { page: 0, totalPages: 3, totalCount: 9 });
                }),
            );

            renderWithProviders(<Agents />, { route: '/' });

            await waitFor(() => {
                expect(within(pinnedRegion()).getByRole('link', { name: /Agent 7/ })).toBeInTheDocument();
            });

            const idsParams = new URL(idsRequestUrl).searchParams;

            expect(idsParams.getAll('ids')).toEqual(['launcher-7']);
            // One page must cover any legal pin set, or a pin past the page boundary silently loses its tile.
            expect(idsParams.get('size')).toBe(String(AGENT_PIN_LIMIT));

            const rest = screen.getByRole('region', { name: 'All agents' });

            expect(within(rest).getAllByRole('link')).toHaveLength(3);
            expect(within(rest).queryByRole('link', { name: /Agent 7/ })).not.toBeInTheDocument();
        });

        it('renders a my-scope pin whose record is on an unfetched page, with no scrolling', async () => {
            const hiddenAgent = {
                _id: 'agent-42',
                name: 'Hidden Draft Agent',
                slug: 'hidden-draft-agent',
                description: 'Sits on a later page of the my list',
            };
            let idsRequestUrl = '';

            storePinned('my', ['agent-42']);
            server.use(respond('get', '/launchers', () => pagedEnvelope(launchers(3), { page: 0 })));
            server.use(
                http.get(apiUrl('/agents'), ({ request }) => {
                    const ids = requestedIds(request);

                    if (ids.length > 0) {
                        idsRequestUrl = request.url;

                        return pagedEnvelope([hiddenAgent], { page: 0 });
                    }

                    return pagedEnvelope([myAgent], { page: 0, totalPages: 3, totalCount: 9 });
                }),
            );

            renderWithProviders(<Agents />, { route: '/?scope=my' });

            await waitFor(() => {
                expect(within(pinnedRegion()).getByRole('link', { name: /Hidden Draft Agent/ })).toBeInTheDocument();
            });

            const idsParams = new URL(idsRequestUrl).searchParams;

            expect(idsParams.getAll('ids')).toEqual(['agent-42']);
            expect(idsParams.get('size')).toBe(String(AGENT_PIN_LIMIT));
            // Without it the endpoint would resolve, and this tab would render, another user's agent by id.
            expect(idsParams.get('mineOnly')).toBe('true');
            // The slug href proves the agent record went through the same launcher mapping the list uses.
            expect(within(pinnedRegion()).getByRole('link', { name: /Hidden Draft Agent/ })).toHaveAttribute(
                'href',
                '/agent/hidden-draft-agent',
            );

            const rest = screen.getByRole('region', { name: 'All agents' });

            expect(within(rest).getAllByRole('link')).toHaveLength(1);
            expect(within(rest).getByRole('link', { name: /My Draft Agent/ })).toBeInTheDocument();
        });

        it('does not resolve pins by id when the tab is explicitly empty', async () => {
            let idsRequests = 0;

            storePinned('firm', []);
            server.use(
                http.get(apiUrl('/launchers'), ({ request }) => {
                    if (requestedIds(request).length > 0) {
                        idsRequests += 1;
                    }

                    return pagedEnvelope(launchers(6), { page: 0 });
                }),
            );

            renderWithProviders(<Agents />, { route: '/' });

            await waitFor(() => {
                expect(screen.getByRole('region', { name: 'Agents' })).toBeInTheDocument();
            });

            expect(idsRequests).toBe(0);
        });

        it('does not resolve pins by id while a search filter is active', async () => {
            let idsRequests = 0;

            storePinned('firm', ['launcher-7', 'launcher-1']);
            server.use(
                http.get(apiUrl('/launchers'), ({ request }) => {
                    const ids = requestedIds(request);

                    if (ids.length > 0) {
                        idsRequests += 1;

                        return pagedEnvelope([launcherAt(7), launcherAt(1)], { page: 0 });
                    }

                    return pagedEnvelope(launchers(3), { page: 0 });
                }),
            );

            renderWithProviders(<Agents />, { route: '/' });

            await waitFor(() => {
                expect(within(pinnedRegion()).getByRole('link', { name: /Agent 7/ })).toBeInTheDocument();
            });

            expect(idsRequests).toBe(1);

            await userEvent.type(screen.getByPlaceholderText('Search for AI agents in Fluent Mind'), 'agent');

            await waitFor(
                () => {
                    expect(screen.queryByRole('heading', { name: 'Pinned' })).not.toBeInTheDocument();
                },
                { timeout: 3000 },
            );

            await waitFor(() => {
                expect(screen.getByRole('region', { name: 'Agents' })).toBeInTheDocument();
            });

            // A pin change re-keys the lookup, so a still-enabled query would issue a second request.
            await userEvent.click(screen.getByRole('button', { name: 'Unpin Agent 1' }));

            await waitFor(() => {
                expect(readStoredPins('firm')).toEqual(['launcher-7']);
            });

            expect(idsRequests).toBe(1);
        });

        it('keeps a by-ids resolved tile on screen while a new pin re-keys the lookup', async () => {
            const pool = launchers(9);
            let idsRequests = 0;

            storePinned('firm', ['launcher-7']);
            server.use(
                http.get(apiUrl('/launchers'), async ({ request }) => {
                    const ids = requestedIds(request);

                    if (ids.length === 0) {
                        return pagedEnvelope(launchers(3), { page: 0, totalPages: 3, totalCount: 9 });
                    }

                    idsRequests += 1;

                    // The gesture's lookup is held open so the assertion below lands inside its in-flight window.
                    if (idsRequests > 1) {
                        await delay(200);
                    }

                    return pagedEnvelope(
                        pool.filter((launcher) => ids.includes(launcher._id)),
                        { page: 0 },
                    );
                }),
            );

            renderWithProviders(<Agents />, { route: '/' });

            await waitFor(() => {
                expect(within(pinnedRegion()).getByRole('link', { name: /Agent 7/ })).toBeInTheDocument();
            });

            await userEvent.click(screen.getByRole('button', { name: 'Pin Agent 2' }));

            await waitFor(() => {
                expect(idsRequests).toBe(2);
            });

            expect(within(pinnedRegion()).getByRole('link', { name: /Agent 7/ })).toBeInTheDocument();

            await waitFor(() => {
                expect(within(pinnedRegion()).getByRole('link', { name: /Agent 2/ })).toBeInTheDocument();
            });

            expect(within(pinnedRegion()).getByRole('link', { name: /Agent 7/ })).toBeInTheDocument();
        });

        it('drops the previous scope by-ids tile when the tab is switched', async () => {
            storePinned('firm', ['launcher-7']);
            storePinned('my', ['agent-9']);
            server.use(
                http.get(apiUrl('/launchers'), ({ request }) => {
                    if (requestedIds(request).length > 0) {
                        return pagedEnvelope([launcherAt(7)], { page: 0 });
                    }

                    return pagedEnvelope(launchers(3), { page: 0, totalPages: 3, totalCount: 9 });
                }),
            );
            server.use(respond('get', '/agents', () => pagedEnvelope([myAgent], { page: 0 })));

            renderWithProviders(<Agents />, { route: '/' });

            await waitFor(() => {
                expect(within(pinnedRegion()).getByRole('link', { name: /Agent 7/ })).toBeInTheDocument();
            });

            await userEvent.click(screen.getByText('My'));

            await waitFor(() => {
                expect(within(pinnedRegion()).getByRole('link', { name: /My Draft Agent/ })).toBeInTheDocument();
            });

            expect(screen.queryByRole('link', { name: /Agent 7/ })).not.toBeInTheDocument();
        });

        it('keeps the grid-resolvable pins and warns when the by-ids lookup fails', async () => {
            storePinned('firm', ['launcher-2', 'launcher-404']);
            server.use(
                http.get(apiUrl('/launchers'), ({ request }) => {
                    if (requestedIds(request).length > 0) {
                        return httpError(500);
                    }

                    return pagedEnvelope(launchers(3), { page: 0 });
                }),
            );

            renderWithProviders(withToasts(<Agents />), { route: '/' });

            await waitFor(() => {
                expect(within(pinnedRegion()).getByRole('link', { name: /Agent 2/ })).toBeInTheDocument();
            });

            expect(await screen.findByText(PINNED_LOOKUP_ERROR)).toBeInTheDocument();

            expect(screen.getByRole('region', { name: 'All agents' })).toBeInTheDocument();
        });

        it('warns once however many times the by-ids lookup fails', async () => {
            let idsRequests = 0;

            storePinned('firm', ['launcher-2', 'launcher-404']);
            server.use(
                http.get(apiUrl('/launchers'), ({ request }) => {
                    if (requestedIds(request).length > 0) {
                        idsRequests += 1;

                        return httpError(500);
                    }

                    return pagedEnvelope(launchers(3), { page: 0 });
                }),
            );

            renderWithProviders(withToasts(<Agents />), { route: '/' });

            expect(await screen.findByText(PINNED_LOOKUP_ERROR)).toBeInTheDocument();
            expect(idsRequests).toBe(1);

            await regainFocus();

            expect(screen.getAllByText(PINNED_LOOKUP_ERROR)).toHaveLength(1);
        });

        it('does not warn again on returning to a scope whose by-ids lookup already failed', async () => {
            storePinned('firm', ['launcher-2', 'launcher-404']);
            storePinned('my', ['agent-9']);
            server.use(
                http.get(apiUrl('/launchers'), ({ request }) => {
                    if (requestedIds(request).length > 0) {
                        return httpError(500);
                    }

                    return pagedEnvelope(launchers(3), { page: 0 });
                }),
            );
            server.use(respond('get', '/agents', () => pagedEnvelope([myAgent], { page: 0 })));

            renderWithProviders(withToasts(<Agents />), { route: '/' });

            expect(await screen.findByText(PINNED_LOOKUP_ERROR)).toBeInTheDocument();

            await userEvent.click(screen.getByText('My'));

            await waitFor(() => {
                expect(within(pinnedRegion()).getByRole('link', { name: /My Draft Agent/ })).toBeInTheDocument();
            });

            await userEvent.click(screen.getByText('Firmwide'));

            await waitFor(() => {
                expect(within(pinnedRegion()).getByRole('link', { name: /Agent 2/ })).toBeInTheDocument();
            });

            await settle();

            expect(screen.getAllByText(PINNED_LOOKUP_ERROR)).toHaveLength(1);
        });

        it('prunes an unresolvable pin and then settles without re-requesting on focus', async () => {
            let idsRequests = 0;

            storePinned('firm', ['launcher-7', 'launcher-404']);
            server.use(
                http.get(apiUrl('/launchers'), ({ request }) => {
                    const ids = requestedIds(request);

                    if (ids.length > 0) {
                        idsRequests += 1;

                        return pagedEnvelope([launcherAt(7)], { page: 0 });
                    }

                    return pagedEnvelope(launchers(3), { page: 0, totalPages: 3, totalCount: 9 });
                }),
            );

            renderWithProviders(<Agents />, { route: '/' });

            await waitFor(() => {
                expect(within(pinnedRegion()).getByRole('link', { name: /Agent 7/ })).toBeInTheDocument();
            });

            // The confirmed-absent launcher-404 is pruned, which re-keys the lookup to the surviving id.
            await waitFor(() => {
                expect(readStoredPins('firm')).toEqual(['launcher-7']);
            });

            const settledRequests = idsRequests;

            await regainFocus();

            // Once the stale id is gone the pin set is stable, so focus issues no further request.
            expect(idsRequests).toBe(settledRequests);
        });

        it('resolves stored pins by id without waiting for the grid page', async () => {
            const hiddenAgent = {
                _id: 'agent-42',
                name: 'Hidden Draft Agent',
                slug: 'hidden-draft-agent',
                description: 'Sits on a later page of the my list',
            };
            const listPage = deferred();
            let isIdsRequested = false;
            let isListResolved = false;

            storePinned('my', ['agent-42']);
            server.use(respond('get', '/launchers', () => pagedEnvelope(launchers(3), { page: 0 })));
            server.use(
                http.get(apiUrl('/agents'), async ({ request }) => {
                    if (requestedIds(request).length > 0) {
                        isIdsRequested = true;

                        return pagedEnvelope([hiddenAgent], { page: 0 });
                    }

                    await listPage.held;
                    isListResolved = true;

                    return pagedEnvelope([myAgent], { page: 0, totalPages: 3, totalCount: 9 });
                }),
            );

            renderWithProviders(<Agents />, { route: '/?scope=my' });

            // Serialized behind the grid page this can never arrive: the page is still held open.
            await waitFor(() => {
                expect(isIdsRequested).toBe(true);
            });

            expect(isListResolved).toBe(false);

            listPage.release();

            await waitFor(() => {
                expect(within(pinnedRegion()).getByRole('link', { name: /Hidden Draft Agent/ })).toBeInTheDocument();
            });
        });

        it('holds the pinned row in placeholders rather than rendering the pins page 0 happens to carry', async () => {
            const pool = launchers(9);
            const idsLookup = deferred();

            storePinned('firm', ['launcher-1', 'launcher-7']);
            server.use(
                http.get(apiUrl('/launchers'), async ({ request }) => {
                    const ids = requestedIds(request);

                    if (ids.length === 0) {
                        return pagedEnvelope(launchers(3), { page: 0, totalPages: 3, totalCount: 9 });
                    }

                    await idsLookup.held;

                    return pagedEnvelope(
                        pool.filter((launcher) => ids.includes(launcher._id)),
                        { page: 0 },
                    );
                }),
            );

            renderWithProviders(<Agents />, { route: '/' });

            await waitFor(() => {
                expect(screen.getByRole('region', { name: 'All agents' })).toBeInTheDocument();
            });

            // Page 0 carries launcher-1, so an ungated row would already be showing one of the two tiles.
            expect(pinnedPlaceholder()).toBeInTheDocument();
            expect(placeholderTileCount()).toBe(2);
            expect(screen.queryByRole('region', { name: 'Pinned' })).not.toBeInTheDocument();
            expect(screen.queryByRole('link', { name: /Agent 1/ })).not.toBeInTheDocument();

            idsLookup.release();

            await waitFor(() => {
                expect(within(pinnedRegion()).getAllByRole('link')).toHaveLength(2);
            });

            // The real row only ever existed complete, so the count cannot have grown into place.
            expect(screen.queryByLabelText(PINNED_PLACEHOLDER_LABEL)).not.toBeInTheDocument();
            expect(within(pinnedRegion()).getByRole('link', { name: /Agent 1/ })).toBeInTheDocument();
            expect(within(pinnedRegion()).getByRole('link', { name: /Agent 7/ })).toBeInTheDocument();
        });

        it('renders defaults straight from page 0, with no placeholder and no by-ids request', async () => {
            let idsRequests = 0;

            server.use(
                http.get(apiUrl('/launchers'), ({ request }) => {
                    if (requestedIds(request).length > 0) {
                        idsRequests += 1;
                    }

                    return pagedEnvelope(launchers(6), { page: 0 });
                }),
            );

            const placeholderWatch = watchForPlaceholder();

            renderWithProviders(<Agents />, { route: '/' });

            await waitFor(() => {
                expect(within(pinnedRegion()).getAllByRole('link')).toHaveLength(4);
            });

            await settle();

            expect(placeholderWatch.appeared()).toBe(false);
            expect(idsRequests).toBe(0);
        });

        it('prunes a pinned id from storage once the by-ids lookup confirms it resolves to nothing', async () => {
            const known = launchers(3);

            storePinned('firm', ['launcher-2', 'launcher-404']);
            server.use(
                http.get(apiUrl('/launchers'), ({ request }) => {
                    const ids = requestedIds(request);

                    if (ids.length > 0) {
                        return pagedEnvelope(
                            known.filter((launcher) => ids.includes(launcher._id)),
                            { page: 0 },
                        );
                    }

                    return pagedEnvelope(known, { page: 0 });
                }),
            );

            renderWithProviders(<Agents />, { route: '/' });

            await waitFor(() => {
                expect(within(pinnedRegion()).getByRole('link', { name: /Agent 2/ })).toBeInTheDocument();
            });

            await waitFor(() => {
                expect(readStoredPins('firm')).toEqual(['launcher-2']);
            });

            expect(layoutPatches).toEqual([{ firm: ['launcher-2'] }]);
            // The resolvable tile stays, and nothing broken renders for the pruned id.
            expect(within(pinnedRegion()).getAllByRole('link')).toHaveLength(1);
        });

        it('does not prune a pinned id while the by-ids lookup is still pending', async () => {
            const known = launchers(3);
            const idsLookup = deferred();

            storePinned('firm', ['launcher-2', 'launcher-404']);
            server.use(
                http.get(apiUrl('/launchers'), async ({ request }) => {
                    const ids = requestedIds(request);

                    if (ids.length > 0) {
                        await idsLookup.held;

                        return pagedEnvelope(
                            known.filter((launcher) => ids.includes(launcher._id)),
                            { page: 0 },
                        );
                    }

                    return pagedEnvelope(known, { page: 0 });
                }),
            );

            renderWithProviders(<Agents />, { route: '/' });

            await waitFor(() => {
                expect(pinnedPlaceholder()).toBeInTheDocument();
            });

            await settle();

            // The lookup has not answered, so the stale id must not be dropped yet.
            expect(layoutPatches).toEqual([]);

            idsLookup.release();

            await waitFor(() => {
                expect(readStoredPins('firm')).toEqual(['launcher-2']);
            });
        });

        it('does not prune a pinned id when the by-ids lookup errors', async () => {
            storePinned('firm', ['launcher-2', 'launcher-404']);
            server.use(
                http.get(apiUrl('/launchers'), ({ request }) => {
                    if (requestedIds(request).length > 0) {
                        return httpError(500);
                    }

                    return pagedEnvelope(launchers(3), { page: 0 });
                }),
            );

            renderWithProviders(withToasts(<Agents />), { route: '/' });

            await waitFor(() => {
                expect(within(pinnedRegion()).getByRole('link', { name: /Agent 2/ })).toBeInTheDocument();
            });

            expect(await screen.findByText(PINNED_LOOKUP_ERROR)).toBeInTheDocument();

            await settle();

            // A failed lookup is not authoritative absence, so the pin must survive.
            expect(layoutPatches).toEqual([]);
            expect(readStoredPins('firm')).toEqual(['launcher-2', 'launcher-404']);
        });

        it('replaces the placeholders with the resolvable tiles when the by-ids lookup fails', async () => {
            const idsLookup = deferred();

            storePinned('firm', ['launcher-2', 'launcher-404']);
            server.use(
                http.get(apiUrl('/launchers'), async ({ request }) => {
                    if (requestedIds(request).length > 0) {
                        await idsLookup.held;

                        return httpError(500);
                    }

                    return pagedEnvelope(launchers(3), { page: 0 });
                }),
            );

            renderWithProviders(withToasts(<Agents />), { route: '/' });

            await waitFor(() => {
                expect(pinnedPlaceholder()).toBeInTheDocument();
            });

            idsLookup.release();

            await waitFor(() => {
                expect(within(pinnedRegion()).getByRole('link', { name: /Agent 2/ })).toBeInTheDocument();
            });

            expect(screen.queryByLabelText(PINNED_PLACEHOLDER_LABEL)).not.toBeInTheDocument();
            expect(await screen.findByText(PINNED_LOOKUP_ERROR)).toBeInTheDocument();
        });

        it('does not prune a newly arrived pin while its re-keyed by-ids lookup is still in flight', async () => {
            const pool = launchers(9);
            const rekeyLookup = deferred();
            let rekeyRequested = false;

            // Only launcher-1 is pinned at first, and it sits on page 0, so the row latches without
            // a stale pin. launcher-7 arrives later (another device) and lives on an unfetched page.
            storePinned('firm', ['launcher-1']);
            server.use(
                http.get(apiUrl('/launchers'), async ({ request }) => {
                    const ids = requestedIds(request);

                    if (ids.length === 0) {
                        return pagedEnvelope(launchers(3), { page: 0, totalPages: 3, totalCount: 9 });
                    }

                    // The re-keyed lookup (launcher-7 added) is held so the assertion lands inside the
                    // in-flight window, where keepPreviousData still shows the prior key's records.
                    if (ids.includes('launcher-7')) {
                        rekeyRequested = true;
                        await rekeyLookup.held;
                    }

                    return pagedEnvelope(
                        pool.filter((launcher) => ids.includes(launcher._id)),
                        { page: 0 },
                    );
                }),
            );

            const { queryClient } = renderWithProviders(<Agents />, { route: '/' });

            await waitFor(() => {
                expect(within(pinnedRegion()).getByRole('link', { name: /Agent 1/ })).toBeInTheDocument();
            });

            // Another device pins launcher-7; a layout refetch pulls it in and re-keys the by-ids lookup.
            storePinned('firm', ['launcher-1', 'launcher-7']);
            await act(async () => {
                await queryClient.invalidateQueries({ queryKey: ['agent-layout'] });
            });

            await waitFor(() => {
                expect(rekeyRequested).toBe(true);
            });

            await settle();

            // In flight, launcher-7 is absent from both the grid and the resolved-by-ids map, but the
            // current lookup has not answered yet, so it must not be misread as stale and pruned.
            expect(layoutPatches).toEqual([]);

            rekeyLookup.release();

            // Once the lookup answers with launcher-7 it is confirmed live: rendered, still not pruned.
            await waitFor(() => {
                expect(within(pinnedRegion()).getByRole('link', { name: /Agent 7/ })).toBeInTheDocument();
            });

            expect(layoutPatches).toEqual([]);
        });

        it('attempts an auto-prune at most once when the prune save keeps failing', async () => {
            let putRequests = 0;

            storePinned('firm', ['launcher-2', 'launcher-404']);
            server.use(
                http.get(apiUrl('/launchers'), ({ request }) => {
                    const ids = requestedIds(request);

                    if (ids.length > 0) {
                        return pagedEnvelope(
                            launchers(3).filter((launcher) => ids.includes(launcher._id)),
                            { page: 0 },
                        );
                    }

                    return pagedEnvelope(launchers(3), { page: 0 });
                }),
            );
            // The prune save fails, so onError rolls the stale id back into the cache. Without the
            // attempted-prune guard that rollback re-fires the effect into a save/toast storm.
            server.use(
                http.put(apiUrl(LAYOUT_PATH), () => {
                    putRequests += 1;

                    return httpError(500);
                }),
            );

            renderWithProviders(withToasts(<Agents />), { route: '/' });

            await waitFor(() => {
                expect(within(pinnedRegion()).getByRole('link', { name: /Agent 2/ })).toBeInTheDocument();
            });

            // The confirmed-absent launcher-404 triggers exactly one prune attempt.
            await waitFor(() => {
                expect(putRequests).toBe(1);
            });

            await settle();
            await settle();

            // The rollback restored launcher-404, but the effect must not retry it this mount.
            expect(putRequests).toBe(1);
            expect(readStoredPins('firm')).toEqual(['launcher-2', 'launcher-404']);
        });
    });
    describe('scope normalization when the switch is hidden', () => {
        const searchHistory: string[] = [];

        /** `MemoryRouter` keeps the URL in memory, so the address bar is only readable from inside the router. */
        const LocationProbe = () => {
            const { search } = useLocation();

            useEffect(() => {
                searchHistory.push(search);
            }, [search]);

            return <div data-testid="location-search">{search}</div>;
        };

        const withLocationProbe = (ui: ReactElement): ReactElement => (
            <>
                {ui}
                <LocationProbe />
            </>
        );

        const locationSearch = (): string => screen.getByTestId('location-search').textContent ?? '';

        beforeEach(() => {
            searchHistory.length = 0;
        });

        it('clears a stored my scope out of the URL when the switch is hidden', async () => {
            sessionStorage.setItem('search-param:scope', 'my');
            server.use(respond('get', '/launchers', () => pagedEnvelope([sampleLauncher], { page: 0 })));

            renderWithProviders(withLocationProbe(<Agents />), {
                route: '/?scope=my',
                preloadedState: { tenant: { ...testTenant, hideScopeSwitch: true } },
            });

            await waitFor(() => {
                expect(screen.getByText('Research Assistant')).toBeInTheDocument();
            });

            await waitFor(() => {
                expect(locationSearch()).toBe('');
            });

            expect(sessionStorage.getItem('search-param:scope')).toBe('firm');
        });

        it('leaves the my scope in the URL while the switch is visible', async () => {
            sessionStorage.setItem('search-param:scope', 'my');
            server.use(respond('get', '/launchers', () => pagedEnvelope([sampleLauncher], { page: 0 })));
            server.use(respond('get', '/agents', () => pagedEnvelope([myAgent], { page: 0 })));

            renderWithProviders(withLocationProbe(<Agents />), { route: '/?scope=my' });

            await waitFor(() => {
                expect(screen.getByText('My Draft Agent')).toBeInTheDocument();
            });

            await settle();

            expect(locationSearch()).toBe('?scope=my');
            expect(sessionStorage.getItem('search-param:scope')).toBe('my');
        });

        it('normalizes the scope once instead of looping', async () => {
            sessionStorage.setItem('search-param:scope', 'my');
            server.use(respond('get', '/launchers', () => pagedEnvelope([sampleLauncher], { page: 0 })));

            renderWithProviders(withLocationProbe(<Agents />), {
                route: '/?scope=my',
                preloadedState: { tenant: { ...testTenant, hideScopeSwitch: true } },
            });

            await waitFor(() => {
                expect(locationSearch()).toBe('');
            });

            await settle();
            await settle();

            expect(searchHistory).toEqual(['?scope=my', '']);
        });
    });
});

describe('Agents — per-role launcher settings', () => {
    beforeEach(() => {
        sessionStorage.clear();
        layoutRow = null;
        stubLayoutEndpoint();
        server.use(respond('get', '/tags', emptyTags));
    });

    const renderAs = (role: 'admin' | 'user', tenantPatch: Partial<typeof testTenant>) => {
        server.use(respond('get', '/launchers', () => pagedEnvelope([sampleLauncher], { page: 0 })));

        return renderWithProviders(<Agents />, {
            route: '/',
            preloadedState: {
                tenant: { ...testTenant, ...tenantPatch },
                user: { ...authenticatedUser, role },
            },
        });
    };

    it('does NOT take Create Agent away from an admin when it is hidden from users only', async () => {
        renderAs('admin', { hideCreateAgent: { visibleToRoles: ['admin'] } });

        expect(await screen.findByText('Research Assistant')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Create Agent' })).toHaveAttribute('href', '/agent-builder');
    });

    it('takes Create Agent away from a role left off the list', async () => {
        renderAs('user', { hideCreateAgent: { visibleToRoles: ['admin'] } });

        expect(await screen.findByText('Research Assistant')).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Create Agent' })).not.toBeInTheDocument();
    });

    it('takes Create Agent away from an admin too once the master hide is on', async () => {
        renderAs('admin', { hideCreateAgent: { hidden: true, visibleToRoles: ['admin'] } });

        expect(await screen.findByText('Research Assistant')).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Create Agent' })).not.toBeInTheDocument();
    });

    it('behaves like the setting being off when all four roles are listed', async () => {
        renderAs('user', { hideCreateAgent: { visibleToRoles: ['admin', 'owner', 'developer', 'user'] } });

        expect(await screen.findByText('Research Assistant')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Create Agent' })).toBeInTheDocument();
    });

    it('keeps the search bar for an admin when it is hidden from users only', async () => {
        renderAs('admin', { hideSearchBar: { visibleToRoles: ['admin'] } });

        expect(await screen.findByText('Research Assistant')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Search for AI agents in Fluent Mind')).toBeInTheDocument();
    });

    it('drops the search bar for a role left off the list', async () => {
        renderAs('user', { hideSearchBar: { visibleToRoles: ['admin'] } });

        expect(await screen.findByText('Research Assistant')).toBeInTheDocument();
        expect(screen.queryByPlaceholderText('Search for AI agents in Fluent Mind')).not.toBeInTheDocument();
    });
});
