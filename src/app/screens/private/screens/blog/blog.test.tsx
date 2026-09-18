import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, delay } from 'msw';
import { Route, Routes, useNavigate } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { testTenant } from '@/test/fixtures/auth';
import { apiUrl, envelope, httpError, pagedEnvelope, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import type { BlogPostType } from '@/types/admin';
import type { TenantType } from '@/types/store';

import Blog from './blog';

const POST_SLUG = 'announcing-fluent-mind-v2';

const samplePost = {
    _id: 'post-1',
    title: 'Announcing Fluent Mind v2',
    slug: POST_SLUG,
    description: 'A short summary of the release',
    // A screenshot and a coloured phrase, because those are what the reader used to lose:
    // the old allowlist had no img and a regex stripped every inline colour before it.
    content:
        '<p>Full post content</p>' +
        '<figure><img src="https://x.dev/a.png" alt="the settings panel"><figcaption>Settings</figcaption></figure>' +
        '<p><span style="color: rgb(203, 45, 45);">red words</span></p>',
    featuredImage: '',
    creator: { name: { first: 'Naveena', last: 'Kumanan' }, avatar: '' },
    createdAt: '2026-01-01T12:00:00.000Z',
    // midday, not midnight: a UTC-midnight stamp renders as the previous day west of Greenwich
    // and this assertion would then depend on where the suite runs
    updatedAt: '2026-01-01T12:00:00.000Z',
} as unknown as BlogPostType;

const renderBlogRoute = (blogPostId = POST_SLUG, tenant?: Partial<TenantType>) =>
    renderWithProviders(
        <Routes>
            <Route path="/help-center/:blogPostId" element={<Blog />} />
        </Routes>,
        {
            route: `/help-center/${blogPostId}`,
            preloadedState: tenant ? { tenant: { ...testTenant, ...tenant } } : undefined,
        },
    );

describe('Blog detail', () => {
    it('shows loading while the blog post is fetched', () => {
        server.use(
            http.get(apiUrl(`/blogposts/${POST_SLUG}`), async () => {
                await delay('infinite');

                return envelope(samplePost);
            }),
        );

        renderBlogRoute();

        expect(screen.getByText('Loading')).toBeInTheDocument();
    });

    it('renders the blog post once loaded', async () => {
        server.use(respond('get', `/blogposts/${POST_SLUG}`, () => envelope(samplePost)));

        renderBlogRoute();

        await waitFor(() => {
            expect(screen.getByRole('heading', { level: 1, name: 'Announcing Fluent Mind v2' })).toBeInTheDocument();
        });

        expect(screen.getByText('A short summary of the release')).toBeInTheDocument();
        expect(screen.queryByText(/Written by/)).not.toBeInTheDocument();
        // the full date reads at a glance; "how long ago" is the hover
        expect(screen.getByText('January 1, 2026')).toHaveAttribute('title', expect.stringContaining('Updated'));
        expect(screen.getByText('Full post content')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Ask in/ })).not.toBeInTheDocument();
    });

    it('renders each tag on the post as a chip', async () => {
        server.use(
            respond('get', `/blogposts/${POST_SLUG}`, () =>
                envelope({
                    ...samplePost,
                    tags: [
                        { _id: 'tag-1', name: 'Billing' },
                        { _id: 'tag-2', name: 'Getting started' },
                    ],
                }),
            ),
        );

        renderBlogRoute();

        await waitFor(() => {
            expect(document.querySelector('.blog-details-tags')).toBeInTheDocument();
        });

        const tagsRow = within(document.querySelector('.blog-details-tags') as HTMLElement);

        expect(tagsRow.getByText('Billing')).toBeInTheDocument();
        expect(tagsRow.getByText('Getting started')).toBeInTheDocument();
    });

    it('renders no tag chips when the post carries none', async () => {
        server.use(respond('get', `/blogposts/${POST_SLUG}`, () => envelope({ ...samplePost, tags: [] })));

        renderBlogRoute();

        await waitFor(() => {
            expect(screen.getByRole('heading', { level: 1, name: 'Announcing Fluent Mind v2' })).toBeInTheDocument();
        });

        expect(document.querySelector('.blog-details-tags')).not.toBeInTheDocument();
    });

    it('shows the Ask-in-agent button beside Copy for LLM once the tenant has one configured', async () => {
        server.use(respond('get', `/blogposts/${POST_SLUG}`, () => envelope(samplePost)));

        renderBlogRoute(POST_SLUG, {
            helpCenterAgent: { agentId: 'agent-1', agentName: 'Help Bot', agentSlug: 'help-bot' },
        });

        expect(await screen.findByRole('button', { name: 'Copy for LLM' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Ask in Help Bot/ })).toBeInTheDocument();
    });

    it('hides both article actions on an announcement, even with an agent configured', async () => {
        const announcementPost = { ...samplePost, type: 'announcement' } as unknown as BlogPostType;

        server.use(respond('get', `/blogposts/${POST_SLUG}`, () => envelope(announcementPost)));

        renderBlogRoute(POST_SLUG, {
            helpCenterAgent: { agentId: 'agent-1', agentName: 'Help Bot', agentSlug: 'help-bot' },
        });

        await waitFor(() => {
            expect(screen.getByRole('heading', { level: 1, name: 'Announcing Fluent Mind v2' })).toBeInTheDocument();
        });

        expect(screen.queryByRole('button', { name: 'Copy for LLM' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Ask in/ })).not.toBeInTheDocument();
    });

    it('keeps the screenshots and colours a BlockNote article carries', async () => {
        // jsdom leaves every surface transparent, which the contrast pass reads as black
        // and would re-tone a colour that is readable on the real page.
        document.body.style.backgroundColor = 'rgb(255, 255, 255)';
        server.use(respond('get', `/blogposts/${POST_SLUG}`, () => envelope(samplePost)));

        renderBlogRoute();

        expect(await screen.findByAltText('the settings panel')).toBeInTheDocument();
        expect(screen.getByText('Settings')).toBeInTheDocument();
        expect(screen.getByText('red words')).toHaveStyle({ color: 'rgb(203, 45, 45)' });
    });

    it('renders an error state with a retry action when the fetch fails', async () => {
        server.use(respond('get', `/blogposts/${POST_SLUG}`, () => httpError(500)));

        renderBlogRoute();

        await waitFor(() => {
            expect(screen.getByText('Failed to Load Blog Post')).toBeInTheDocument();
        });

        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    });

    it('renders an error state when the API answers success: false', async () => {
        server.use(
            respond(
                'get',
                `/blogposts/${POST_SLUG}`,
                () =>
                    new Response(JSON.stringify({ success: false, message: 'Blog post not published', value: null }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    }),
            ),
        );

        renderBlogRoute();

        await waitFor(() => {
            expect(screen.getByText('Failed to Load Blog Post')).toBeInTheDocument();
        });
    });

    it('refetches and recovers when Retry is clicked', async () => {
        let attempt = 0;

        server.use(
            http.get(apiUrl(`/blogposts/${POST_SLUG}`), () => {
                attempt += 1;

                return attempt === 1 ? httpError(500) : envelope(samplePost);
            }),
        );

        renderBlogRoute();

        await waitFor(() => {
            expect(screen.getByText('Failed to Load Blog Post')).toBeInTheDocument();
        });

        await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

        await waitFor(() => {
            expect(screen.getByRole('heading', { level: 1, name: 'Announcing Fluent Mind v2' })).toBeInTheDocument();
        });

        expect(attempt).toBe(2);
    });

    it('requests the slug taken from the route param', async () => {
        let requestPath = '';

        server.use(
            http.get(apiUrl('/blogposts/:blogPostId'), ({ request }) => {
                requestPath = new URL(request.url).pathname;

                return envelope(samplePost);
            }),
        );

        renderBlogRoute('second-release-note');

        await waitFor(() => {
            expect(requestPath).toBe('/blogposts/second-release-note');
        });
    });

    it('renders an HTML post as a bare iframe, without the breadcrumb or byline furniture', async () => {
        const htmlPost = {
            ...samplePost,
            _id: 'post-html',
            title: 'HTML announcement',
            slug: 'html-announcement',
            contentType: 'html',
            type: 'announcement',
            content: '<p>Raw HTML content</p>',
        } as unknown as BlogPostType;

        server.use(respond('get', '/blogposts/html-announcement', () => envelope(htmlPost)));

        renderBlogRoute('html-announcement');

        expect(await screen.findByTitle('Blog post HTML content')).toBeInTheDocument();
        expect(screen.queryByRole('navigation', { name: 'breadcrumb' })).not.toBeInTheDocument();
        expect(screen.queryByText('January 1, 2026')).not.toBeInTheDocument();
    });

    it('does not ask for a category article list when the post is unfiled', async () => {
        let listRequests = 0;

        server.use(respond('get', `/blogposts/${POST_SLUG}`, () => envelope(samplePost)));
        server.use(
            http.get(apiUrl('/blogposts'), () => {
                listRequests += 1;

                return pagedEnvelope([], { page: 0 });
            }),
        );

        renderBlogRoute();

        await screen.findByText('Full post content');

        expect(listRequests).toBe(0);
        expect(screen.queryByRole('navigation', { name: 'Article navigation' })).not.toBeInTheDocument();
    });
});

const CATEGORY_TAG = { _id: 'tag-1', name: 'Getting Started' };

const middlePost = {
    ...samplePost,
    _id: 'post-2',
    title: 'How Amplify works',
    content: '<p>The middle article</p>',
    tags: [CATEGORY_TAG],
    categoryId: 'tag-1',
    category: { ...CATEGORY_TAG, icon: 'rocket' },
    slug: 'how-amplify-works',
    relatedPostIds: [{ _id: 'post-9', title: 'Install the add-in', slug: 'install-the-add-in' }],
} as unknown as BlogPostType;

const orderedArticles = [
    { ...samplePost, _id: 'post-1', title: 'What is Amplify?', slug: 'what-is-amplify' },
    middlePost,
    { ...samplePost, _id: 'post-3', title: '5-minute quick start', slug: 'five-minute-quick-start' },
] as unknown as BlogPostType[];

const BackButton = () => {
    const navigate = useNavigate();

    return (
        <button type="button" onClick={() => navigate(-1)}>
            Back
        </button>
    );
};

// the shared helper renders Blog alone; a POP has to come from inside the router
const renderBlogRouteWithBack = (blogPostId: string) =>
    renderWithProviders(
        <Routes>
            <Route
                path="/help-center/:blogPostId"
                element={
                    <>
                        <BackButton />
                        <Blog />
                    </>
                }
            />
        </Routes>,
        { route: `/help-center/${blogPostId}` },
    );

describe('Blog detail related articles and neighbours', () => {
    const serveCategoryArticles = () => {
        server.use(respond('get', '/blogposts', () => pagedEnvelope(orderedArticles, { page: 0, totalCount: 3 })));
    };

    it('renders the related articles carried on the post, without a second request', async () => {
        const listUrls: string[] = [];

        server.use(respond('get', '/blogposts/how-amplify-works', () => envelope(middlePost)));
        server.use(
            http.get(apiUrl('/blogposts'), ({ request }) => {
                listUrls.push(request.url);

                return pagedEnvelope(orderedArticles, { page: 0, totalCount: 3 });
            }),
        );

        renderBlogRoute('how-amplify-works');

        expect(await screen.findByRole('heading', { name: 'Related articles' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Install the add-in/i })).toHaveAttribute(
            'href',
            '/help-center/install-the-add-in',
        );
        expect(listUrls.every((url) => new URL(url).searchParams.get('ids') === null)).toBe(true);
    });

    it('renders Previous and Next from the category reading order', async () => {
        server.use(respond('get', '/blogposts/how-amplify-works', () => envelope(middlePost)));
        serveCategoryArticles();

        renderBlogRoute('how-amplify-works');

        const nav = await screen.findByRole('navigation', { name: 'Article navigation' });

        await waitFor(() => {
            expect(within(nav).getByRole('link', { name: /What is Amplify\?/i })).toHaveAttribute(
                'href',
                '/help-center/what-is-amplify',
            );
        });
        expect(within(nav).getByRole('link', { name: /5-minute quick start/i })).toHaveAttribute(
            'href',
            '/help-center/five-minute-quick-start',
        );
        expect(within(nav).getByText('Previous')).toBeInTheDocument();
        expect(within(nav).getByText('Next')).toBeInTheDocument();
    });

    it('requests the category articles in configured reading order', async () => {
        let requestUrl: URL | null = null;

        server.use(respond('get', '/blogposts/how-amplify-works', () => envelope(middlePost)));
        server.use(
            http.get(apiUrl('/blogposts'), ({ request }) => {
                requestUrl = new URL(request.url);

                return pagedEnvelope(orderedArticles, { page: 0, totalCount: 3 });
            }),
        );

        renderBlogRoute('how-amplify-works');

        await waitFor(() => {
            expect(requestUrl).not.toBeNull();
        });

        const params = (requestUrl as unknown as URL).searchParams;

        expect(params.get('tags')).toBeNull();
        expect(params.get('categoryId')).toBe('tag-1');
        expect(params.get('sortBy')).toBe('categorySortOrder:asc');
        // the sidebar and these neighbours are help-centre furniture; announcements do not belong
        expect(params.getAll('types')).toEqual(['post']);
    });

    it('omits Previous on the first article and keeps Next in the second column', async () => {
        const firstPost = {
            ...middlePost,
            _id: 'post-1',
            title: 'What is Amplify?',
            slug: 'what-is-amplify',
            relatedPostIds: [],
        } as unknown as BlogPostType;

        server.use(respond('get', '/blogposts/what-is-amplify', () => envelope(firstPost)));
        serveCategoryArticles();

        renderBlogRoute('what-is-amplify');

        const nav = await screen.findByRole('navigation', { name: 'Article navigation' });

        await waitFor(() => {
            expect(within(nav).getByText('Next')).toBeInTheDocument();
        });
        expect(within(nav).queryByText('Previous')).not.toBeInTheDocument();
        // the placeholder has to stay the first child, or the lone Next link falls back into the
        // grid's first column and renders right-aligned under a left-hand heading
        expect(nav.firstElementChild?.tagName).toBe('SPAN');
        expect(nav.children).toHaveLength(2);
    });

    it('omits Next on the last article in the collection', async () => {
        const lastPost = {
            ...middlePost,
            _id: 'post-3',
            title: '5-minute quick start',
            slug: 'five-minute-quick-start',
            relatedPostIds: [],
        } as unknown as BlogPostType;

        server.use(respond('get', '/blogposts/five-minute-quick-start', () => envelope(lastPost)));
        serveCategoryArticles();

        renderBlogRoute('five-minute-quick-start');

        const nav = await screen.findByRole('navigation', { name: 'Article navigation' });

        await waitFor(() => {
            expect(within(nav).getByText('Previous')).toBeInTheDocument();
        });
        expect(within(nav).queryByText('Next')).not.toBeInTheDocument();
    });

    const lastOfFullPage = {
        ...middlePost,
        _id: 'post-100',
        title: 'Article one hundred',
        slug: 'article-100',
        relatedPostIds: [],
    } as unknown as BlogPostType;

    // A full page means more articles probably follow, so "Next" must not be silently dropped
    // and the reader must not be told this is the last article in the collection.
    const fullPage = [
        ...Array.from({ length: 99 }, (_, index) => ({
            ...middlePost,
            _id: `filler-${index}`,
            title: `Filler ${index}`,
            slug: `filler-${index}`,
        })),
        lastOfFullPage,
    ] as unknown as BlogPostType[];

    /**
     * The control for the test below it. The nav is the only thing this route renders from the
     * category list, so without a case that proves the list arrives and the nav draws from it,
     * an absent nav cannot be told apart from a list that never landed.
     */
    it('still shows the neighbours mid-way through a full page', async () => {
        server.use(respond('get', '/blogposts/filler-50', () => envelope(fullPage[50])));
        server.use(respond('get', '/blogposts', () => pagedEnvelope(fullPage, { page: 0, totalCount: 140 })));

        renderBlogRoute('filler-50');

        const nav = await screen.findByRole('navigation', { name: 'Article navigation' });

        expect(within(nav).getByRole('link', { name: /Filler 49/ })).toHaveAttribute('href', '/help-center/filler-49');
        expect(within(nav).getByRole('link', { name: /Filler 51/ })).toHaveAttribute('href', '/help-center/filler-51');
    });

    it('hides the neighbours rather than claiming the end when the fetched page is full', async () => {
        let listServed = false;

        server.use(respond('get', '/blogposts/article-100', () => envelope(lastOfFullPage)));
        server.use(
            http.get(apiUrl('/blogposts'), () => {
                listServed = true;

                return pagedEnvelope(fullPage, { page: 0, totalCount: 140 });
            }),
        );

        renderBlogRoute('article-100');

        await screen.findByText('The middle article');

        // an absence asserted before the list lands passes on its own, so wait for the response
        // first — the control above proves the nav would be on screen by now if it were coming
        await waitFor(() => expect(listServed).toBe(true));
        await waitFor(() =>
            expect(screen.getByRole('heading', { level: 1, name: 'Article one hundred' })).toBeInTheDocument(),
        );

        expect(screen.queryByRole('navigation', { name: 'Article navigation' })).not.toBeInTheDocument();
    });

    it('opens the next article at the top instead of keeping the previous scroll offset', async () => {
        server.use(respond('get', '/blogposts/how-amplify-works', () => envelope(middlePost)));
        server.use(respond('get', '/blogposts/five-minute-quick-start', () => envelope(orderedArticles[2])));
        serveCategoryArticles();

        renderBlogRoute('how-amplify-works');

        const nav = await screen.findByRole('navigation', { name: 'Article navigation' });
        const next = await within(nav).findByRole('link', { name: /5-minute quick start/i });

        // the first render is a POP, which is exempt, so nothing has scrolled yet
        expect(window.scrollTo).not.toHaveBeenCalled();

        await userEvent.click(next);

        // awaited so the destination request settles before teardown, not only that the scroll fired
        expect(await screen.findByRole('heading', { level: 1, name: '5-minute quick start' })).toBeInTheDocument();
        expect(window.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0, behavior: 'instant' }));
    });

    it('leaves the scroll position alone on a back navigation so the browser can restore it', async () => {
        server.use(respond('get', '/blogposts/how-amplify-works', () => envelope(middlePost)));
        server.use(respond('get', '/blogposts/five-minute-quick-start', () => envelope(orderedArticles[2])));
        serveCategoryArticles();

        renderBlogRouteWithBack('how-amplify-works');

        const nav = await screen.findByRole('navigation', { name: 'Article navigation' });

        await userEvent.click(await within(nav).findByRole('link', { name: /5-minute quick start/i }));
        await screen.findByRole('heading', { level: 1, name: '5-minute quick start' });

        vi.mocked(window.scrollTo).mockClear();

        await userEvent.click(screen.getByRole('button', { name: 'Back' }));

        expect(await screen.findByRole('heading', { level: 1, name: 'How Amplify works' })).toBeInTheDocument();
        expect(window.scrollTo).not.toHaveBeenCalled();
    });

    it('renders no related section when the post carries none', async () => {
        const barePost = { ...middlePost, relatedPostIds: [] } as unknown as BlogPostType;

        server.use(respond('get', '/blogposts/how-amplify-works', () => envelope(barePost)));
        serveCategoryArticles();

        renderBlogRoute('how-amplify-works');

        await screen.findByText('The middle article');

        expect(screen.queryByRole('heading', { name: 'Related articles' })).not.toBeInTheDocument();
    });

    it('drops a related entry the API left without a slug', async () => {
        const mixedPost = {
            ...middlePost,
            relatedPostIds: [
                { _id: 'post-9', title: 'Install the add-in', slug: 'install-the-add-in' },
                { _id: 'post-10', title: 'Unpublished draft' },
            ],
        } as unknown as BlogPostType;

        server.use(respond('get', '/blogposts/how-amplify-works', () => envelope(mixedPost)));
        serveCategoryArticles();

        renderBlogRoute('how-amplify-works');

        expect(await screen.findByRole('link', { name: /Install the add-in/i })).toBeInTheDocument();
        expect(screen.queryByText('Unpublished draft')).not.toBeInTheDocument();
    });
});
