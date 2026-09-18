import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { installPointerCaptureShims } from '@/test/dom-shims';
import { apiUrl, failureEnvelope, httpError, pagedEnvelope, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import type { BlogPostType, TagType } from '@/types/admin';

import AllPosts from './all-posts';

installPointerCaptureShims();

const samplePost = {
    _id: 'post-1',
    title: 'Announcing Fluent Mind v2',
    slug: 'announcing-fluent-mind-v2',
    description: 'A short summary of the release',
    featuredImage: '',
    tags: [],
    categoryId: null,
    category: null,
    creator: { name: { first: 'Ada', last: 'Lovelace' }, avatar: '' },
    createdAt: '2026-01-01T00:00:00.000Z',
} as unknown as BlogPostType;

const secondPost = {
    ...samplePost,
    _id: 'post-2',
    title: 'Second release note',
    slug: 'second-release-note',
} as unknown as BlogPostType;

const taggedPost = {
    ...samplePost,
    _id: 'post-3',
    title: 'Tagged release note',
    slug: 'tagged-release-note',
    tags: [{ _id: 'tag-1', name: 'Getting started' }],
    categoryId: 'tag-1',
    category: { _id: 'tag-1', name: 'Getting started', icon: 'rocket' },
} as unknown as BlogPostType;

const sampleCategory = {
    _id: 'tag-1',
    name: 'Getting started',
    icon: 'rocket',
    description: 'Onboarding guides',
    postCount: 4,
} as unknown as TagType;

const LocationProbe = () => {
    const location = useLocation();

    return <div data-testid="location-search">{location.search}</div>;
};

const renderAllPosts = (route = '/announcements') =>
    renderWithProviders(
        <>
            <AllPosts />
            <LocationProbe />
        </>,
        { route },
    );

describe('Blog all-posts feed', () => {
    beforeEach(() => {
        server.use(respond('get', '/tags', () => pagedEnvelope([], { page: 0 })));
    });

    it('renders an empty state when there are no blog posts', async () => {
        server.use(respond('get', '/blogposts', () => pagedEnvelope([], { page: 0 })));

        renderAllPosts();

        expect(await screen.findByText('No blogs found?')).toBeInTheDocument();
    });

    it('renders blog post cards linked by slug', async () => {
        server.use(respond('get', '/blogposts', () => pagedEnvelope([samplePost], { page: 0 })));

        renderAllPosts();

        expect(await screen.findByText('Announcing Fluent Mind v2')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Announcing Fluent Mind v2/i })).toHaveAttribute(
            'href',
            '/announcements/announcing-fluent-mind-v2',
        );
    });

    it('renders an error state when the request fails', async () => {
        server.use(respond('get', '/blogposts', () => httpError(500)));

        renderAllPosts();

        expect(await screen.findByText('Posts could not be loaded')).toBeInTheDocument();
    });

    it('renders an error state when the API answers success: false', async () => {
        server.use(respond('get', '/blogposts', () => failureEnvelope('Blog service unavailable')));

        renderAllPosts();

        expect(await screen.findByText('Posts could not be loaded')).toBeInTheDocument();
    });

    it('serializes list params onto the request URL', async () => {
        let requestUrl: URL | null = null;

        server.use(
            http.get(apiUrl('/blogposts'), ({ request }) => {
                requestUrl = new URL(request.url);

                return pagedEnvelope([samplePost], { page: 0 });
            }),
        );

        renderAllPosts();

        await waitFor(() => {
            expect(requestUrl).not.toBeNull();
        });

        const params = (requestUrl as unknown as URL).searchParams;

        expect(params.get('size')).toBe('20');
        expect(params.get('page')).toBe('0');
        expect(params.get('sortBy')).toBe('updatedAt:desc');
        // Announcements is the announcement half of the reader; guides live in the knowledge base
        expect(params.getAll('types')).toEqual(['announcement']);
        expect(params.get('search')).toBeNull();
        expect(params.get('tags')).toBeNull();
    });

    it('renders every post returned across the loaded pages', async () => {
        server.use(
            respond('get', '/blogposts', () =>
                pagedEnvelope([samplePost, secondPost], { page: 0, totalPages: 2, totalCount: 2 }),
            ),
        );

        renderAllPosts();

        expect(await screen.findByText('Announcing Fluent Mind v2')).toBeInTheDocument();
        expect(screen.getByText('Second release note')).toBeInTheDocument();
    });

    it('shows how many posts matched', async () => {
        server.use(
            respond('get', '/blogposts', () => pagedEnvelope([samplePost], { page: 0, totalCount: 7, totalPages: 1 })),
        );

        renderAllPosts();

        expect(await screen.findByText('7 posts')).toBeInTheDocument();
    });

    it('reads the search term out of the URL and sends it to the API', async () => {
        let requestUrl: URL | null = null;

        server.use(
            http.get(apiUrl('/blogposts'), ({ request }) => {
                requestUrl = new URL(request.url);

                return pagedEnvelope([samplePost], { page: 0 });
            }),
        );

        renderAllPosts('/announcements?search=release');

        await waitFor(() => {
            expect(requestUrl).not.toBeNull();
        });

        expect((requestUrl as unknown as URL).searchParams.get('search')).toBe('release');
    });

    it('clears the search term without disturbing the chosen sort', async () => {
        const user = userEvent.setup();

        server.use(respond('get', '/blogposts', () => pagedEnvelope([samplePost], { page: 0 })));

        renderAllPosts('/announcements?search=release&sort=updatedAt:asc');

        await screen.findByText('Announcing Fluent Mind v2');
        await user.click(screen.getByRole('button', { name: 'Clear' }));

        // Clear is offered for the search term alone, so it must not silently reorder the feed.
        await waitFor(() => {
            expect(screen.getByTestId('location-search').textContent).not.toContain('search');
        });
        expect(screen.getByTestId('location-search').textContent).toContain('sort=updatedAt%3Aasc');
    });

    it('does not let a debounced term reappear after Clear', async () => {
        const user = userEvent.setup();

        server.use(respond('get', '/blogposts', () => pagedEnvelope([samplePost], { page: 0 })));
        server.use(respond('get', '/tags', () => pagedEnvelope([sampleCategory], { page: 0 })));

        // Starts from a committed term so Clear is on screen, then types more and clears inside the
        // 750ms window — the pending commit must be dropped, not refill the box a moment later.
        renderAllPosts('/announcements?search=release');

        await screen.findByText('Announcing Fluent Mind v2');

        await user.type(screen.getByPlaceholderText('Search blog posts...'), 'x');
        await user.click(screen.getByRole('button', { name: 'Clear' }));

        await new Promise((resolve) => {
            setTimeout(resolve, 1200);
        });

        expect(screen.getByPlaceholderText('Search blog posts...')).toHaveValue('');
        expect(screen.getByTestId('location-search').textContent).not.toContain('search');
    });

    it('falls back to the default sort when the URL carries an unknown value', async () => {
        let requestUrl: URL | null = null;

        server.use(
            http.get(apiUrl('/blogposts'), ({ request }) => {
                requestUrl = new URL(request.url);

                return pagedEnvelope([samplePost], { page: 0 });
            }),
        );

        renderAllPosts('/announcements?sort=categorySortOrder:asc');

        await waitFor(() => {
            expect(requestUrl).not.toBeNull();
        });

        expect((requestUrl as unknown as URL).searchParams.get('sortBy')).toBe('updatedAt:desc');
    });

    it('does not call a non-default sort a filter in the summary, and shows no Clear for it', async () => {
        server.use(
            respond('get', '/blogposts', () => pagedEnvelope([samplePost], { page: 0, totalCount: 7, totalPages: 1 })),
        );

        renderAllPosts('/announcements?sort=updatedAt:asc');

        expect(await screen.findByText('7 posts')).toBeInTheDocument();
        expect(screen.queryByText('7 matching posts')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
    });

    it('shows the collection name on a card that is filed under one', async () => {
        server.use(respond('get', '/blogposts', () => pagedEnvelope([taggedPost], { page: 0 })));

        renderAllPosts();

        expect(await screen.findByText('Tagged release note')).toBeInTheDocument();
        expect(screen.getByText('Getting started')).toBeInTheDocument();
    });
});
