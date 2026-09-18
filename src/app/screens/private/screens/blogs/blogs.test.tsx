import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { apiUrl, envelope, pagedEnvelope, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import type { BlogPostType, TagType } from '@/types/admin';

import Blog from '../blog';

import AllPosts from './all-posts';
import Blogs from './blogs';
import CollectionDetail from './collection-detail';
import Collections from './collections';

const category = {
    _id: 'tag-1',
    name: 'Getting Started',
    icon: 'rocket',
    description: 'Onboarding guides and first steps for new teams.',
    postCount: 2,
} as unknown as TagType;

const article = {
    _id: 'post-1',
    title: 'What is Amplify?',
    slug: 'what-is-amplify',
    description: 'Learn what Amplify is',
    contentType: 'text',
    content: '<p>Amplify brings it together.</p>',
    tags: [{ _id: 'tag-1', name: 'Getting Started' }],
    categoryId: 'tag-1',
    category: { _id: 'tag-1', name: 'Getting Started', icon: 'rocket' },
    relatedPostIds: [],
    creator: { name: { first: 'Ada', last: 'Lovelace' }, avatar: '' },
    createdAt: '2026-01-01T00:00:00.000Z',
} as unknown as BlogPostType;

const otherCategory = {
    _id: 'tag-2',
    name: 'Product Updates',
    icon: 'sparkles',
    description: 'New features and releases.',
    postCount: 3,
} as unknown as TagType;

/** Announcements are not filed under a collection, so they carry no trail. */
const announcementPost = {
    ...article,
    _id: 'post-10',
    title: 'Release notes',
    slug: 'release-notes',
    type: 'announcement',
} as unknown as BlogPostType;

const untaggedArticle = {
    ...article,
    _id: 'post-9',
    title: 'Standalone note',
    slug: 'standalone-note',
    tags: [],
    categoryId: null,
    category: null,
} as unknown as BlogPostType;

const renderBlogsRoute = (route: string) =>
    renderWithProviders(
        <Routes>
            <Route path="/announcements" element={<Blogs />}>
                <Route index element={<AllPosts />} />
                <Route path=":blogPostId" element={<Blog />} />
            </Route>
            <Route path="/help-center" element={<Blogs />}>
                <Route index element={<Collections />} />
                <Route path="collections/:categoryId" element={<CollectionDetail />} />
                <Route path=":blogPostId" element={<Blog />} />
            </Route>
        </Routes>,
        { route },
    );

describe('Blogs layout', () => {
    beforeEach(() => {
        server.use(respond('get', '/tags', () => pagedEnvelope([category], { page: 0 })));
        server.use(respond('get', '/tags/tag-1', () => envelope(category)));
        server.use(respond('get', '/blogposts', () => pagedEnvelope([article], { page: 0, totalCount: 1 })));
        server.use(respond('get', '/blogposts/what-is-amplify', () => envelope(article)));
        server.use(respond('get', '/blogposts/standalone-note', () => envelope(untaggedArticle)));
    });

    it('titles the two flows apart and cross-links between them', async () => {
        renderBlogsRoute('/announcements');

        const feedHeader = await screen.findByRole('banner');

        expect(within(feedHeader).getByText('Fluent Mind Announcements')).toBeInTheDocument();
        expect(within(feedHeader).getByRole('link', { name: 'Help Center' })).toHaveAttribute('href', '/help-center');
    });

    it('titles the Help Center flow and links back to the feed', async () => {
        renderBlogsRoute('/help-center');

        const helpHeader = await screen.findByRole('banner');

        expect(within(helpHeader).getByText('Fluent Mind Help Center')).toBeInTheDocument();
        expect(within(helpHeader).getByRole('link', { name: 'Announcements' })).toHaveAttribute(
            'href',
            '/announcements',
        );
    });

    it('keeps the sidebar off the feed and on the collection flow', async () => {
        renderBlogsRoute('/announcements');

        await screen.findByText('Fluent Mind Announcements');
        expect(screen.queryByRole('navigation', { name: 'Collections' })).not.toBeInTheDocument();
    });

    it('renders the collections sidebar on a collection page', async () => {
        renderBlogsRoute('/help-center/collections/tag-1');

        const sidebars = await screen.findAllByRole('navigation', { name: 'Collections' });

        expect(sidebars.length).toBeGreaterThan(0);
        await waitFor(() => {
            expect(within(sidebars[0]).getByRole('link', { name: /Getting Started/i })).toHaveAttribute(
                'href',
                '/help-center/collections/tag-1',
            );
        });
    });

    it('builds the breadcrumb for a collection page', async () => {
        renderBlogsRoute('/help-center/collections/tag-1');

        const breadcrumb = await screen.findByRole('navigation', { name: 'breadcrumb' });

        expect(within(breadcrumb).getByRole('link', { name: 'All Collections' })).toHaveAttribute(
            'href',
            '/help-center',
        );
        await waitFor(() => {
            expect(within(breadcrumb).getByText('Getting Started')).toBeInTheDocument();
        });
    });

    it('builds a three-level breadcrumb for an article in a collection', async () => {
        renderBlogsRoute('/help-center/what-is-amplify');

        const breadcrumb = await screen.findByRole('navigation', { name: 'breadcrumb' });

        await waitFor(() => {
            expect(within(breadcrumb).getByRole('link', { name: 'Getting Started' })).toHaveAttribute(
                'href',
                '/help-center/collections/tag-1',
            );
        });
        expect(within(breadcrumb).getByRole('link', { name: 'All Collections' })).toBeInTheDocument();
        expect(within(breadcrumb).getByText('What is Amplify?')).toBeInTheDocument();
    });

    it('falls back to the Help Center breadcrumb for an article with no collection', async () => {
        renderBlogsRoute('/help-center/standalone-note');

        const breadcrumb = await screen.findByRole('navigation', { name: 'breadcrumb' });

        await waitFor(() => {
            expect(within(breadcrumb).getByRole('link', { name: 'All Collections' })).toHaveAttribute(
                'href',
                '/help-center',
            );
        });
        expect(within(breadcrumb).getByText('Standalone note')).toBeInTheDocument();
    });

    it('moves the panel highlight to the opened article before it has loaded', async () => {
        // The rail is permanent Help Center chrome, so a slow article must not leave the previous one lit.
        server.use(
            http.get(apiUrl('/blogposts/what-is-amplify'), async () => {
                await delay('infinite');

                return envelope(article);
            }),
        );

        renderBlogsRoute('/help-center/collections/tag-1');

        const sidebar = (await screen.findAllByRole('navigation', { name: 'Collections' }))[0];

        await userEvent.click(await within(sidebar).findByRole('link', { name: 'What is Amplify?' }));

        await waitFor(() => {
            expect(within(sidebar).getByRole('link', { name: 'What is Amplify?' })).toHaveAttribute(
                'aria-current',
                'page',
            );
        });
    });

    it('dresses a cold-loaded Help Center article as Help Center before the post arrives', async () => {
        // The section comes from the URL, not the post, so a deep link must not paint the
        // Announcements header and a missing rail and then flip once the fetch lands.
        server.use(
            http.get(apiUrl('/blogposts/what-is-amplify'), async () => {
                await delay('infinite');

                return envelope(article);
            }),
        );

        renderBlogsRoute('/help-center/what-is-amplify');

        expect(await screen.findByText('Fluent Mind Help Center')).toBeInTheDocument();
        expect(screen.queryByText('Fluent Mind Announcements')).not.toBeInTheDocument();
        expect((await screen.findAllByRole('navigation', { name: 'Collections' })).length).toBeGreaterThan(0);
    });

    it('leaves an announcement free of the collection furniture', async () => {
        // it carries a tag, which before this rule was enough to give it a category
        server.use(respond('get', '/blogposts/release-notes', () => envelope(announcementPost)));

        renderBlogsRoute('/announcements/release-notes');

        // wait for the post itself, otherwise absent furniture only means it has not loaded
        await screen.findByRole('heading', { name: 'Release notes' });

        // its trail goes home to the feed, never into a collection
        const breadcrumb = screen.getByRole('navigation', { name: 'breadcrumb' });

        expect(within(breadcrumb).getByRole('link', { name: 'Announcements' })).toHaveAttribute(
            'href',
            '/announcements',
        );
        expect(screen.queryByRole('navigation', { name: 'Collections' })).not.toBeInTheDocument();
        expect(screen.queryByRole('navigation', { name: 'Article navigation' })).not.toBeInTheDocument();
    });

    it('expands a collection from the sidebar chevron', async () => {
        const user = userEvent.setup();

        server.use(respond('get', '/tags', () => pagedEnvelope([category, otherCategory], { page: 0 })));

        renderBlogsRoute('/help-center');

        const toggle = await screen.findByRole('button', { name: 'Show articles in Product Updates' });

        expect(toggle).toHaveAttribute('aria-expanded', 'false');

        await user.click(toggle);

        const collapse = await screen.findByRole('button', { name: 'Hide articles in Product Updates' });

        expect(collapse).toHaveAttribute('aria-expanded', 'true');
    });

    it('marks the open collection as the current page in the sidebar', async () => {
        renderBlogsRoute('/help-center/collections/tag-1');

        const sidebars = await screen.findAllByRole('navigation', { name: 'Collections' });

        await waitFor(() => {
            expect(within(sidebars[0]).getByRole('link', { name: /Getting Started/i })).toHaveAttribute(
                'aria-current',
                'page',
            );
        });
    });

    it('navigates by breadcrumb rather than a Back button', async () => {
        renderBlogsRoute('/help-center/what-is-amplify');

        const breadcrumb = await screen.findByRole('navigation', { name: 'breadcrumb' });

        expect(screen.queryByRole('button', { name: 'Go back' })).not.toBeInTheDocument();

        await userEvent.click(await within(breadcrumb).findByRole('link', { name: 'Getting Started' }));

        expect(await screen.findByRole('heading', { level: 1, name: 'Getting Started' })).toBeInTheDocument();
    });

    it('marks the open article as the current page in the sidebar', async () => {
        renderBlogsRoute('/help-center/what-is-amplify');

        const sidebars = await screen.findAllByRole('navigation', { name: 'Collections' });

        await waitFor(() => {
            expect(within(sidebars[0]).getByRole('link', { name: 'What is Amplify?' })).toHaveAttribute(
                'aria-current',
                'page',
            );
        });
    });
});
