import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { apiUrl, failureEnvelope, httpError, pagedEnvelope, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import type { TagType } from '@/types/admin';

import Collections from './collections';

const gettingStarted = {
    _id: 'tag-1',
    name: 'Getting started',
    icon: 'rocket',
    description: 'Onboarding guides and first steps for new teams.',
    postCount: 4,
} as unknown as TagType;

const engineering = {
    _id: 'tag-2',
    name: 'Engineering',
    icon: 'code-2',
    description: 'Technical deep dives.',
    postCount: 1,
} as unknown as TagType;

const uncountedCategory = {
    _id: 'tag-3',
    name: 'Case studies',
    icon: '',
    description: 'How teams use the platform.',
} as unknown as TagType;

const pageOfCategories = (count: number, prefix: string) =>
    Array.from({ length: count }, (_, index) => ({
        _id: `${prefix}-${index}`,
        name: `${prefix} ${index}`,
        icon: '',
        description: '',
        postCount: 1,
    })) as unknown as TagType[];

/** The suite-wide IntersectionObserver mock never fires; this one hands the callback back. */
const installFiringObserver = () => {
    const original = globalThis.IntersectionObserver;
    let fire: (() => void) | undefined;

    class FiringObserver {
        root = null;

        rootMargin = '';

        thresholds: number[] = [];

        observe = vi.fn();

        unobserve = vi.fn();

        disconnect = vi.fn();

        takeRecords = vi.fn(() => []);

        constructor(callback: IntersectionObserverCallback) {
            fire = () => {
                callback(
                    [{ isIntersecting: true } as IntersectionObserverEntry],
                    this as unknown as IntersectionObserver,
                );
            };
        }
    }

    vi.stubGlobal('IntersectionObserver', FiringObserver);

    return {
        scrollToSentinel: () => act(() => fire?.()),
        restore: () => vi.stubGlobal('IntersectionObserver', original),
    };
};

describe('Blog collections landing', () => {
    it('renders a card per collection with its article count', async () => {
        server.use(respond('get', '/tags', () => pagedEnvelope([gettingStarted, engineering], { page: 0 })));

        renderWithProviders(<Collections />, { route: '/help-center' });

        expect(await screen.findByText('Getting started')).toBeInTheDocument();
        expect(screen.getByText('Onboarding guides and first steps for new teams.')).toBeInTheDocument();
        expect(screen.getByText('4 articles')).toBeInTheDocument();
        expect(screen.getByText('1 article')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Getting started/i })).toHaveAttribute(
            'href',
            '/help-center/collections/tag-1',
        );
    });

    it('hides the count when the API sends no postCount', async () => {
        server.use(respond('get', '/tags', () => pagedEnvelope([uncountedCategory], { page: 0 })));

        renderWithProviders(<Collections />, { route: '/help-center' });

        await screen.findByText('Case studies');

        expect(screen.queryByText(/undefined/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/articles$/)).not.toBeInTheDocument();
    });

    it('asks the blogpost tag bucket for the collections', async () => {
        const tagUrls: string[] = [];

        server.use(
            http.get(apiUrl('/tags'), ({ request }) => {
                tagUrls.push(request.url);

                return pagedEnvelope([gettingStarted], { page: 0 });
            }),
        );

        renderWithProviders(<Collections />, { route: '/help-center' });

        await screen.findByText('Getting started');

        const params = new URL(tagUrls[0]).searchParams;

        expect(params.get('tagFor')).toBe('blogpost');
        expect(params.get('sortBy')).toBe('sortOrder:asc');
    });

    it('asks for one page of 30 non-empty categories, not the whole set', async () => {
        const tagUrls: string[] = [];

        server.use(
            http.get(apiUrl('/tags'), ({ request }) => {
                tagUrls.push(request.url);

                return pagedEnvelope([gettingStarted], { page: 0 });
            }),
        );

        renderWithProviders(<Collections />, { route: '/help-center' });

        await screen.findByText('Getting started');

        const params = new URL(tagUrls[0]).searchParams;

        expect(params.get('size')).toBe('30');
        expect(params.get('page')).toBe('0');
        expect(params.get('hasPosts')).toBe('true');
    });

    it('reads a sort value from the URL and sends it as sortBy', async () => {
        const tagUrls: string[] = [];

        server.use(
            http.get(apiUrl('/tags'), ({ request }) => {
                tagUrls.push(request.url);

                return pagedEnvelope([gettingStarted], { page: 0 });
            }),
        );

        renderWithProviders(<Collections />, { route: '/help-center?sort=name:asc' });

        await screen.findByText('Getting started');

        expect(new URL(tagUrls[0]).searchParams.get('sortBy')).toBe('name:asc');
    });

    it('falls back to the default sort when the URL carries an unknown value', async () => {
        const tagUrls: string[] = [];

        server.use(
            http.get(apiUrl('/tags'), ({ request }) => {
                tagUrls.push(request.url);

                return pagedEnvelope([gettingStarted], { page: 0 });
            }),
        );

        renderWithProviders(<Collections />, { route: '/help-center?sort=nonsense' });

        await screen.findByText('Getting started');

        expect(new URL(tagUrls[0]).searchParams.get('sortBy')).toBe('sortOrder:asc');
    });

    it('picks a sort option from the menu and puts it in the URL', async () => {
        const user = userEvent.setup();
        const tagUrls: string[] = [];

        server.use(
            http.get(apiUrl('/tags'), ({ request }) => {
                tagUrls.push(request.url);

                return pagedEnvelope([gettingStarted], { page: 0 });
            }),
        );

        renderWithProviders(<Collections />, { route: '/help-center' });

        await screen.findByText('Getting started');
        await user.click(screen.getByRole('button', { name: /Default order/i }));
        await user.click(screen.getByRole('menuitem', { name: /Name \(A–Z\)/i }));

        await waitFor(() => {
            expect(new URL(tagUrls.at(-1)!).searchParams.get('sortBy')).toBe('name:asc');
        });
    });

    it('appends the next page when the scroll sentinel comes into view', async () => {
        const observer = installFiringObserver();
        const requestedPages: (string | null)[] = [];

        server.use(
            http.get(apiUrl('/tags'), ({ request }) => {
                const page = new URL(request.url).searchParams.get('page');

                requestedPages.push(page);

                return page === '1'
                    ? pagedEnvelope([engineering], { page: 1, totalPages: 2, totalCount: 31 })
                    : pagedEnvelope(pageOfCategories(30, 'Collection'), {
                          page: 0,
                          totalPages: 2,
                          totalCount: 31,
                      });
            }),
        );

        try {
            renderWithProviders(<Collections />, { route: '/help-center' });

            await screen.findByText('Collection 0');

            expect(screen.queryByText('Engineering')).not.toBeInTheDocument();

            observer.scrollToSentinel();

            expect(await screen.findByText('Engineering')).toBeInTheDocument();
            // The first page stays rendered above the second rather than being replaced.
            expect(screen.getByText('Collection 0')).toBeInTheDocument();
            expect(requestedPages).toEqual(['0', '1']);
        } finally {
            observer.restore();
        }
    });

    it('stops asking for more once the last page has landed', async () => {
        const observer = installFiringObserver();
        let tagRequests = 0;

        server.use(
            http.get(apiUrl('/tags'), () => {
                tagRequests += 1;

                return pagedEnvelope([gettingStarted], { page: 0, totalPages: 1, totalCount: 1 });
            }),
        );

        try {
            renderWithProviders(<Collections />, { route: '/help-center' });

            await screen.findByText('Getting started');

            observer.scrollToSentinel();

            await waitFor(() => {
                expect(tagRequests).toBe(1);
            });
        } finally {
            observer.restore();
        }
    });

    it('counts every match, not just the page on screen', async () => {
        const user = userEvent.setup();

        server.use(
            http.get(apiUrl('/tags'), ({ request }) => {
                const term = new URL(request.url).searchParams.get('search');

                return term
                    ? pagedEnvelope(pageOfCategories(30, 'Match'), { page: 0, totalPages: 2, totalCount: 47 })
                    : pagedEnvelope([gettingStarted], { page: 0 });
            }),
        );

        renderWithProviders(<Collections />, { route: '/help-center' });

        await screen.findByText('Getting started');
        await user.type(screen.getByPlaceholderText('Search collections...'), 'match');

        expect(await screen.findByText('47 collections found')).toBeInTheDocument();
    });

    it('renders an empty state when there are no collections', async () => {
        server.use(respond('get', '/tags', () => pagedEnvelope([], { page: 0 })));

        renderWithProviders(<Collections />, { route: '/help-center' });

        expect(await screen.findByText('No collections yet')).toBeInTheDocument();
    });

    it('renders an error state when the collections request fails', async () => {
        server.use(respond('get', '/tags', () => httpError(500)));

        renderWithProviders(<Collections />, { route: '/help-center' });

        expect(await screen.findByText('Collections could not be loaded')).toBeInTheDocument();
    });

    it('renders an error state when the API answers success: false', async () => {
        server.use(respond('get', '/tags', () => failureEnvelope('Tag service unavailable')));

        renderWithProviders(<Collections />, { route: '/help-center' });

        expect(await screen.findByText('Collections could not be loaded')).toBeInTheDocument();
    });

    it('sends the typed term to the tags endpoint and renders what comes back', async () => {
        const user = userEvent.setup();
        const tagUrls: string[] = [];
        let blogPostRequests = 0;

        server.use(
            http.get(apiUrl('/tags'), ({ request }) => {
                const url = new URL(request.url);

                tagUrls.push(url.href);

                const term = url.searchParams.get('search');
                const matches = term ? [engineering] : [gettingStarted, engineering];

                return pagedEnvelope(matches, { page: 0 });
            }),
        );
        server.use(
            http.get(apiUrl('/blogposts'), () => {
                blogPostRequests += 1;

                return pagedEnvelope([], { page: 0 });
            }),
        );

        renderWithProviders(<Collections />, { route: '/help-center' });

        await screen.findByText('Getting started');
        await user.type(screen.getByPlaceholderText('Search collections...'), 'engine');

        await waitFor(
            () => {
                expect(tagUrls.some((url) => new URL(url).searchParams.get('search') === 'engine')).toBe(true);
            },
            { timeout: 3000 },
        );

        expect(await screen.findByText('Engineering')).toBeInTheDocument();
        expect(screen.queryByText('Getting started')).not.toBeInTheDocument();
        expect(await screen.findByText('1 collection found')).toBeInTheDocument();
        // This screen browses collections; it must never reach for articles.
        expect(blogPostRequests).toBe(0);
    });

    it('shows the skeleton again while a search is refetching, not stale results underneath', async () => {
        const user = userEvent.setup();

        server.use(
            http.get(apiUrl('/tags'), async ({ request }) => {
                const term = new URL(request.url).searchParams.get('search');

                if (term) {
                    await delay('infinite');
                }

                return pagedEnvelope([gettingStarted], { page: 0 });
            }),
        );

        renderWithProviders(<Collections />, { route: '/help-center' });

        await screen.findByText('Getting started');
        await user.type(screen.getByPlaceholderText('Search collections...'), 'engine');

        expect(await screen.findByRole('list', { name: 'Loading collections' })).toBeInTheDocument();
        expect(screen.queryByText('Getting started')).not.toBeInTheDocument();
    });

    it('reads the term out of the URL and sends it on, like the posts feed does', async () => {
        const tagUrls: string[] = [];

        server.use(
            http.get(apiUrl('/tags'), ({ request }) => {
                tagUrls.push(request.url);

                return pagedEnvelope([engineering], { page: 0 });
            }),
        );

        renderWithProviders(<Collections />, { route: '/help-center?search=engine' });

        await screen.findByText('Engineering');

        expect(new URL(tagUrls[0]).searchParams.get('search')).toBe('engine');
        expect(screen.getByPlaceholderText('Search collections...')).toHaveValue('engine');
    });

    it('omits the search param entirely when the box is empty', async () => {
        const tagUrls: string[] = [];

        server.use(
            http.get(apiUrl('/tags'), ({ request }) => {
                tagUrls.push(request.url);

                return pagedEnvelope([gettingStarted], { page: 0 });
            }),
        );

        renderWithProviders(<Collections />, { route: '/help-center' });

        await screen.findByText('Getting started');

        expect(new URL(tagUrls[0]).searchParams.get('search')).toBeNull();
    });

    it('tells the reader when the search comes back with nothing', async () => {
        const user = userEvent.setup();

        server.use(
            http.get(apiUrl('/tags'), ({ request }) => {
                const term = new URL(request.url).searchParams.get('search');

                return pagedEnvelope(term ? [] : [gettingStarted], { page: 0 });
            }),
        );

        renderWithProviders(<Collections />, { route: '/help-center' });

        await screen.findByText('Getting started');
        await user.type(screen.getByPlaceholderText('Search collections...'), 'nothing matches this');

        expect(await screen.findByText('No collections found')).toBeInTheDocument();
        expect(screen.queryByText('No collections yet')).not.toBeInTheDocument();
    });
});
