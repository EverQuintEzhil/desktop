import { screen, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { apiUrl, envelope, failureEnvelope, httpError, pagedEnvelope, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import type { BlogPostType, TagType } from '@/types/admin';

import CollectionDetail from './collection-detail';

// GET /tags/:id returns the tag row raw — no postCount and no joined creator.
const category = {
    _id: 'tag-1',
    name: 'Getting Started',
    icon: 'rocket',
    description: 'Onboarding guides and first steps for new teams.',
    updatedAt: '2026-01-01T12:00:00.000Z',
} as unknown as TagType;

// The list is the only response that joins the creator and counts the posts.
const listedCategory = {
    ...category,
    postCount: 12,
    creator: { name: { first: 'Naveena', last: 'Kumanan' }, avatar: '' },
} as unknown as TagType;

const firstArticle = {
    _id: 'post-1',
    title: 'What is Amplify?',
    slug: 'what-is-amplify',
    description: 'Learn what Amplify is and the problems it solves',
    tags: [{ _id: 'tag-1', name: 'Getting Started' }],
    categoryId: 'tag-1',
    category: { _id: 'tag-1', name: 'Getting Started', icon: 'rocket' },
    creator: { name: { first: 'Ada', last: 'Lovelace' }, avatar: '' },
    createdAt: '2026-01-01T00:00:00.000Z',
} as unknown as BlogPostType;

const secondArticle = {
    ...firstArticle,
    _id: 'post-2',
    title: 'How Amplify works',
    slug: 'how-amplify-works',
} as unknown as BlogPostType;

const renderCollectionDetail = (route = '/help-center/collections/tag-1') =>
    renderWithProviders(
        <Routes>
            <Route path="/help-center/collections/:categoryId" element={<CollectionDetail />} />
        </Routes>,
        { route },
    );

describe('Blog collection detail', () => {
    beforeEach(() => {
        server.use(respond('get', '/tags', () => pagedEnvelope([listedCategory], { page: 0 })));
    });

    it('renders the collection header from the single-tag endpoint', async () => {
        server.use(respond('get', '/tags/tag-1', () => envelope(category)));
        server.use(respond('get', '/blogposts', () => pagedEnvelope([firstArticle], { page: 0, totalCount: 1 })));

        renderCollectionDetail();

        expect(await screen.findByRole('heading', { level: 1, name: 'Getting Started' })).toBeInTheDocument();
        expect(screen.getByText('Onboarding guides and first steps for new teams.')).toBeInTheDocument();
        expect(screen.queryByText(/By Naveena Kumanan/)).not.toBeInTheDocument();
        expect(screen.getByText('January 1, 2026')).toBeInTheDocument();
    });

    it('takes the header count from the tag list, which is the only response carrying postCount', async () => {
        server.use(respond('get', '/tags/tag-1', () => envelope(category)));
        server.use(
            respond('get', '/blogposts', () =>
                pagedEnvelope([firstArticle, secondArticle], { page: 0, totalCount: 2, totalPages: 1 }),
            ),
        );

        renderCollectionDetail();

        expect(await screen.findByText(/12 articles/)).toBeInTheDocument();
    });

    it('keeps the header count whole while a search narrows the list', async () => {
        server.use(respond('get', '/tags/tag-1', () => envelope(category)));
        server.use(
            respond('get', '/blogposts', () =>
                pagedEnvelope([firstArticle], { page: 0, totalCount: 1, totalPages: 1 }),
            ),
        );

        renderCollectionDetail('/help-center/collections/tag-1?search=amplify');

        // The header still describes the collection; the filtered number gets its own line.
        expect(await screen.findByText(/12 articles/)).toBeInTheDocument();
        expect(screen.getByText(/1 result for/)).toBeInTheDocument();
    });

    it('omits the header count when the tag list has not supplied one', async () => {
        server.use(respond('get', '/tags', () => pagedEnvelope([category], { page: 0 })));
        server.use(respond('get', '/tags/tag-1', () => envelope(category)));
        server.use(
            // plural on purpose: with `totalCount: 1` a regression that fell back to this number
            // would render "1 article" and slip past the /articles/ assertion below
            respond('get', '/blogposts', () =>
                pagedEnvelope([firstArticle], { page: 0, totalCount: 2, totalPages: 1 }),
            ),
        );

        renderCollectionDetail('/help-center/collections/tag-1?search=amplify');

        await screen.findByRole('heading', { level: 1, name: 'Getting Started' });

        expect(screen.queryByText(/undefined/)).not.toBeInTheDocument();
        expect(screen.queryByText(/articles/)).not.toBeInTheDocument();
    });

    it('falls back to the default sort when the URL carries the other screen’s value', async () => {
        let requestUrl: URL | null = null;

        server.use(respond('get', '/tags/tag-1', () => envelope(category)));
        server.use(
            http.get(apiUrl('/blogposts'), ({ request }) => {
                requestUrl = new URL(request.url);

                return pagedEnvelope([firstArticle], { page: 0, totalCount: 1 });
            }),
        );

        renderCollectionDetail('/help-center/collections/tag-1?sort=nonsense');

        await waitFor(() => {
            expect(requestUrl).not.toBeNull();
        });

        expect((requestUrl as unknown as URL).searchParams.get('sortBy')).toBe('categorySortOrder:asc');
    });

    it('lists the articles in the collection, linked by slug', async () => {
        server.use(respond('get', '/tags/tag-1', () => envelope(category)));
        server.use(
            respond('get', '/blogposts', () =>
                pagedEnvelope([firstArticle, secondArticle], { page: 0, totalCount: 2 }),
            ),
        );

        renderCollectionDetail();

        expect(await screen.findByText('What is Amplify?')).toBeInTheDocument();
        expect(screen.getByText('How Amplify works')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /What is Amplify\?/i })).toHaveAttribute(
            'href',
            '/help-center/what-is-amplify',
        );
    });

    it('filters the posts request by the category id in reading order', async () => {
        let requestUrl: URL | null = null;

        server.use(respond('get', '/tags/tag-1', () => envelope(category)));
        server.use(
            http.get(apiUrl('/blogposts'), ({ request }) => {
                requestUrl = new URL(request.url);

                return pagedEnvelope([firstArticle], { page: 0, totalCount: 1 });
            }),
        );

        renderCollectionDetail();

        await waitFor(() => {
            expect(requestUrl).not.toBeNull();
        });

        const params = (requestUrl as unknown as URL).searchParams;

        expect(params.get('tags')).toBeNull();
        expect(params.get('categoryId')).toBe('tag-1');
        expect(params.get('sortBy')).toBe('categorySortOrder:asc');
        expect(params.getAll('types')).toEqual(['post']);
    });

    it('honours a sort and a search term from the URL', async () => {
        let requestUrl: URL | null = null;

        server.use(respond('get', '/tags/tag-1', () => envelope(category)));
        server.use(
            http.get(apiUrl('/blogposts'), ({ request }) => {
                requestUrl = new URL(request.url);

                return pagedEnvelope([firstArticle], { page: 0, totalCount: 1 });
            }),
        );

        renderCollectionDetail('/help-center/collections/tag-1?search=amplify&sort=updatedAt:desc');

        await waitFor(() => {
            expect(requestUrl).not.toBeNull();
        });

        const params = (requestUrl as unknown as URL).searchParams;

        expect(params.get('search')).toBe('amplify');
        expect(params.get('sortBy')).toBe('updatedAt:desc');
    });

    it('tells the reader when the collection has no articles yet', async () => {
        server.use(respond('get', '/tags/tag-1', () => envelope(category)));
        server.use(respond('get', '/blogposts', () => pagedEnvelope([], { page: 0, totalCount: 0 })));

        renderCollectionDetail();

        expect(await screen.findByText('No articles in this collection yet')).toBeInTheDocument();
    });

    it('renders an error state when the collection cannot be fetched', async () => {
        server.use(respond('get', '/tags/tag-1', () => httpError(404)));
        server.use(respond('get', '/blogposts', () => pagedEnvelope([], { page: 0 })));

        renderCollectionDetail();

        expect(await screen.findByText('Collection could not be loaded')).toBeInTheDocument();
    });

    it('renders an error state when the articles request answers success: false', async () => {
        server.use(respond('get', '/tags/tag-1', () => envelope(category)));
        server.use(respond('get', '/blogposts', () => failureEnvelope('Blog service unavailable')));

        renderCollectionDetail();

        expect(await screen.findByText('Articles could not be loaded')).toBeInTheDocument();
    });
});
