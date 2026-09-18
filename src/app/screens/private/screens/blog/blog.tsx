import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { NavigationType, useNavigationType, useParams } from 'react-router-dom';

import BlogBreadcrumb, { type BlogBreadcrumbEntry } from '@/app/components/blog-breadcrumb';
import BlogByline from '@/app/components/blog-byline';
import { useBlogQuery } from '@/app/hooks/use-blog-query';
import { useCategoryArticlesQuery } from '@/app/hooks/use-category-articles-query';
import { Image } from '@/components';
import { Button } from '@/components/ui/button';
import Spinner from '@/components/ui/spinner';
import { Tag } from '@/components/ui/tag';
import { useReadableArticleColors } from '@/hooks';
import { sanitizeArticleContent } from '@/lib/sanitize-html';
import { cn } from '@/lib/utils';
import { resolveCategoryTag } from '@/utils/resolve-category-tag';

import { ANNOUNCEMENTS_PATH, HELP_CENTER_COLLECTIONS_PATH, HELP_CENTER_PATH } from '../blogs/constants';

import { BlogAdjacentNav, BlogAskAgent, BlogCopyForLlm, BlogRelatedArticles } from './components';

import '../blogs/blogs.scss';

import './blog.scss';

// vh inside the iframe means the iframe's own viewport, which is sized to the content —
// a circular dependency that makes the height sync diverge. Remap every vh-family unit
// to a custom property carrying the real window height instead. The lookbehind keeps
// identifiers like var(--offset-100vh) intact; the sign must live inside the calc().
const VIEWPORT_UNIT_PATTERN = /(?<![\w-])(-?\d*\.?\d+)[dsl]?vh\b/gi;

// declaration values only — rewriting rule.cssText would also mangle selectors
// (.h-\[100vh\]) and media conditions, where calc()/var() are invalid
const remapDeclarations = (style: CSSStyleDeclaration): void => {
    for (const property of Array.from(style)) {
        const value = style.getPropertyValue(property);

        // string values (content, url) must keep their text verbatim
        if (value.includes('"') || value.includes("'")) {
            continue;
        }

        const next = value.replace(VIEWPORT_UNIT_PATTERN, 'calc($1 * var(--fm-outer-vh))');

        if (next !== value) {
            style.setProperty(property, next, style.getPropertyPriority(property));
        }
    }
};

// duck-typed, not instanceof: rules belong to the iframe's realm, whose CSSRule
// constructors are different objects from ours
const remapRules = (rules: CSSRuleList): void => {
    for (const rule of Array.from(rules)) {
        if ('style' in rule) {
            remapDeclarations((rule as CSSStyleRule).style);
        }

        if ('cssRules' in rule) {
            remapRules((rule as CSSGroupingRule).cssRules);
        } else if ('styleSheet' in rule) {
            try {
                const importedSheet = (rule as CSSImportRule).styleSheet;

                if (importedSheet) {
                    remapRules(importedSheet.cssRules);
                }
            } catch {
                // cross-origin imports cannot be read
            }
        }
    }
};

const setOuterViewportUnit = (doc: Document): void => {
    doc.documentElement.style.setProperty('--fm-outer-vh', `${window.innerHeight / 100}px`);
};

const remapViewportUnits = (doc: Document): void => {
    // the custom property must exist before any declaration references it
    setOuterViewportUnit(doc);

    for (const sheet of Array.from(doc.styleSheets)) {
        try {
            remapRules(sheet.cssRules);
        } catch {
            // cross-origin stylesheet
        }
    }

    doc.querySelectorAll<HTMLElement>('[style*="vh" i]').forEach((element) => {
        remapDeclarations(element.style);
    });
};

const Blog = () => {
    const params = useParams();
    const navigationType = useNavigationType();
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const articleBodyRef = useRef<HTMLDivElement>(null);
    const contentObserverRef = useRef<ResizeObserver | null>(null);

    const { data: blogPost, isLoading, isError, refetch } = useBlogQuery(params.blogPostId);
    const categoryTag = resolveCategoryTag(blogPost);
    const postTags = (blogPost?.tags ?? []).filter((tag) => typeof tag === 'object' && !!tag?._id);
    const { data: categoryArticles } = useCategoryArticlesQuery(categoryTag?._id);
    const isAnnouncement = blogPost?.type === 'announcement';

    useReadableArticleColors(articleBodyRef, blogPost?.content);

    const syncIframeHeight = useCallback(() => {
        const iframe = iframeRef.current;
        const doc = iframe?.contentDocument;

        if (!iframe || !doc?.body) {
            return;
        }

        setOuterViewportUnit(doc);

        // collapse before measuring: with a 0-height viewport, %- and viewport-sized
        // boxes stop tracking the iframe itself, so the reading is pure content extent
        // and the loop can neither ratchet up nor diverge; both writes land in the
        // same frame, so nothing flickers and the ResizeObserver settles
        iframe.style.height = '0px';

        const next = doc.documentElement.scrollHeight;

        iframe.style.height = `${next}px`;
    }, []);

    const handleContentClick = useCallback((event: MouseEvent) => {
        const anchor = (event.target as HTMLElement | null)?.closest('a');
        const href = anchor?.getAttribute('href');

        if (!anchor || !href) {
            return;
        }

        // srcdoc inherits the parent base URL, so any navigation would reload the app inside the iframe
        event.preventDefault();

        if (!href.startsWith('#')) {
            if (/^https?:/i.test(anchor.href)) {
                window.open(anchor.href, '_blank', 'noopener,noreferrer');
            } else {
                // mailto:, tel:, etc. — a blank tab would be left stranded
                window.location.href = anchor.href;
            }

            return;
        }

        let fragment = href.slice(1);

        try {
            fragment = decodeURIComponent(fragment);
        } catch {
            // keep the raw fragment if it is not valid percent-encoding
        }

        const iframe = iframeRef.current;
        const doc = iframe?.contentDocument;
        const target = fragment
            ? (doc?.getElementById(fragment) ?? doc?.querySelector(`[name="${CSS.escape(fragment)}"]`))
            : null;

        if (!iframe || !target) {
            return;
        }

        window.scrollTo({
            top: window.scrollY + iframe.getBoundingClientRect().top + target.getBoundingClientRect().top,
            behavior: 'smooth',
        });
    }, []);

    const handleIframeLoad = useCallback(() => {
        try {
            const doc = iframeRef.current?.contentDocument;

            if (!doc?.body) {
                return;
            }

            // outer page owns vertical scrolling, iframe must never grow a second scrollbar;
            // body margin must go too or it feeds back into the height measurement
            doc.documentElement.style.overflowY = 'hidden';
            doc.body.style.margin = '0';
            remapViewportUnits(doc);
            doc.addEventListener('click', handleContentClick);

            contentObserverRef.current?.disconnect();
            contentObserverRef.current = new ResizeObserver(syncIframeHeight);
            contentObserverRef.current.observe(doc.body);

            syncIframeHeight();
        } catch (error) {
            console.error('Failed to load blog HTML content', error);
        }
    }, [handleContentClick, syncIframeHeight]);

    // POP is left alone so the browser's own back/forward scroll restoration keeps the reader's
    // place; 'instant' overrides the global scroll-behavior:smooth, which would animate the reset.
    useLayoutEffect(() => {
        if (navigationType === NavigationType.Pop) {
            return;
        }

        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }, [params.blogPostId, navigationType]);

    useEffect(() => {
        window.addEventListener('resize', syncIframeHeight);

        return () => {
            window.removeEventListener('resize', syncIframeHeight);
            contentObserverRef.current?.disconnect();
            contentObserverRef.current = null;
        };
    }, [syncIframeHeight]);

    // The screen is reused across posts, so unmount cleanup alone leaks the detached iframe document.
    useEffect(() => {
        return () => {
            contentObserverRef.current?.disconnect();
            contentObserverRef.current = null;
        };
    }, [params.blogPostId, blogPost?.contentType]);

    const resolveBreadcrumbItems = (): BlogBreadcrumbEntry[] => {
        if (!blogPost) {
            return [];
        }

        if (isAnnouncement) {
            return [{ label: 'Announcements', to: ANNOUNCEMENTS_PATH }, { label: blogPost.title }];
        }

        if (categoryTag) {
            return [
                { label: 'All Collections', to: HELP_CENTER_PATH },
                { label: categoryTag.name, to: `${HELP_CENTER_COLLECTIONS_PATH}/${categoryTag._id}` },
                { label: blogPost.title },
            ];
        }

        return [{ label: 'All Collections', to: HELP_CENTER_PATH }, { label: blogPost.title }];
    };

    const renderArticleActions = () => (
        <div className="blog-details-actions flex items-center gap-2">
            <BlogCopyForLlm title={blogPost?.title} description={blogPost?.description} content={blogPost?.content} />
            <BlogAskAgent title={blogPost?.title} slug={blogPost?.slug} />
        </div>
    );

    const renderArticleHeader = () => (
        <div className="blog-details-header flex flex-col gap-5">
            <BlogBreadcrumb items={resolveBreadcrumbItems()} />
            <div className="blog-details-header-content flex flex-col gap-3">
                <h1 className="font-semibold text-pretty">{blogPost?.title}</h1>
                {blogPost?.description && (
                    <p className="text-h5 leading-relaxed font-medium text-text-secondary">{blogPost.description}</p>
                )}
                {postTags.length > 0 && (
                    <div className="blog-details-tags flex flex-wrap items-center gap-2">
                        {postTags.map((tag) => (
                            <Tag
                                key={tag._id}
                                size="small"
                                variant="pill"
                                className="border border-border-secondary bg-card text-text-secondary hover:bg-card"
                            >
                                {tag.name}
                            </Tag>
                        ))}
                    </div>
                )}
            </div>
            <div className="blog-details-byline flex flex-wrap items-center justify-between gap-4 border-b border-border-secondary pb-6">
                <BlogByline date={blogPost?.updatedAt} />
                {isAnnouncement ? null : renderArticleActions()}
            </div>
        </div>
    );

    const renderContent = () => {
        if (isError) {
            return (
                <div className="blogs-details-page pb-8">
                    <div className="blogs-container mx-auto w-full">
                        <div className="blog-container mx-auto flex w-full items-center justify-center">
                            <div className="flex max-w-xs flex-col items-center justify-center gap-4 text-center">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50">
                                    <svg
                                        width="20"
                                        height="20"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="#ef4444"
                                        strokeWidth="2"
                                    >
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="15" y1="9" x2="9" y2="15" />
                                        <line x1="9" y1="9" x2="15" y2="15" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="mb-1 text-sm font-medium">Failed to Load Blog Post</h3>
                                    <span className="text-sm">Network issue or blog post doesn&apos;t exist</span>
                                </div>
                                <Button className="blog-retry-button rounded-full" size="sm" onClick={() => refetch()}>
                                    Retry
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        if (blogPost?.contentType === 'html') {
            return (
                <div className="blogs-details-page mx-auto w-full max-w-full">
                    <div className="blogs-container mx-auto w-full">
                        {/* The iframe is a separate document, so the page itself would have no heading. */}
                        <h1 className="sr-only">{blogPost.title}</h1>
                        <iframe
                            ref={iframeRef}
                            className="blog-post-html-preview block w-full border-none"
                            srcDoc={blogPost.content || ''}
                            title="Blog post HTML content"
                            sandbox="allow-same-origin allow-scripts"
                            onLoad={handleIframeLoad}
                        />
                    </div>
                </div>
            );
        }

        return (
            <div className="blogs-details-page mx-auto w-full max-w-[820px]">
                <article className="blogs-container blogs-details flex w-full flex-col gap-6">
                    {renderArticleHeader()}
                    {blogPost?.featuredImage && (
                        <figure
                            className={cn(
                                'blog-featured-image flex items-center justify-center overflow-hidden rounded-2xl',
                                isAnnouncement ? null : 'border border-border-secondary bg-card',
                            )}
                        >
                            <Image
                                src={
                                    typeof blogPost?.featuredImage === 'string'
                                        ? blogPost?.featuredImage
                                        : blogPost?.featuredImage.url
                                }
                                placeholder={'/assets/images/broken-image.svg'}
                                alt={blogPost?.title || 'Blog Cover'}
                            />
                        </figure>
                    )}
                    {blogPost?.content && (
                        <div className="blogs-content">
                            <div
                                ref={articleBodyRef}
                                className="article-body"
                                role="presentation"
                                dangerouslySetInnerHTML={{ __html: sanitizeArticleContent(blogPost.content) }}
                            />
                        </div>
                    )}
                    {isAnnouncement ? (
                        <div className="blog-details-more mt-2 border-t border-border-secondary pt-7">
                            <BlogRelatedArticles
                                related={blogPost?.relatedPostIds}
                                variant="tiles"
                                heading="More announcements"
                                basePath={ANNOUNCEMENTS_PATH}
                            />
                        </div>
                    ) : null}
                </article>
            </div>
        );
    };

    const renderFooter = () => {
        if (!blogPost || isError || isAnnouncement) {
            return null;
        }

        return (
            <div className="blog-post-footer mx-auto flex w-full max-w-[820px] flex-col gap-8">
                <BlogRelatedArticles related={blogPost.relatedPostIds} basePath={HELP_CENTER_PATH} />
                <BlogAdjacentNav articles={categoryArticles} currentSlug={blogPost.slug} />
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="blog-loading flex min-h-[50svh] flex-col items-center justify-center gap-6 p-4">
                <Spinner className="scale-[1.5]" />
                <h2 className="text-center font-medium">Loading</h2>
            </div>
        );
    }

    return (
        <div className="blogs-page-details flex flex-col gap-10">
            {renderContent()}
            {renderFooter()}
        </div>
    );
};

export default Blog;
