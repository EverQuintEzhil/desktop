import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { BLOG_NAV_PALETTE } from '@/app/components/blog-nav-palette';
import CollectionIcon from '@/app/components/collection-icon';
import { useBlogCategoriesQuery } from '@/app/hooks/use-blog-categories-query';
import { useCategoryArticlesQuery } from '@/app/hooks/use-category-articles-query';
import { HELP_CENTER_COLLECTIONS_PATH, HELP_CENTER_PATH } from '@/app/screens/private/screens/blogs/constants';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { TagType } from '@/types/admin';

export interface BlogCollectionsNavProps {
    activeCategoryId?: string | null;
    activeArticleSlug?: string | null;
    onNavigate?: () => void;
    className?: string;
}

type ExpandOverride = {
    forPathname: string;
    value: string | null;
};

const SKELETON_KEYS = ['a', 'b', 'c', 'd'];

const BlogCollectionsNav = (props: BlogCollectionsNavProps) => {
    const { activeCategoryId = null, activeArticleSlug = null, onNavigate, className } = props;

    const { pathname } = useLocation();

    // A manual expand is remembered against the route it was made from, so any navigation re-expands
    // for the new route. Keyed on the path, not the category: an article carries its collection's id,
    // so a collapse made on the collection page would otherwise still hide the article you opened.
    const [override, setOverride] = useState<ExpandOverride | null>(null);
    const expandedCategoryId = override && override.forPathname === pathname ? override.value : activeCategoryId;

    const { data: categories, isLoading, isError } = useBlogCategoriesQuery();
    const { data: articles, isLoading: isArticlesLoading } = useCategoryArticlesQuery(expandedCategoryId ?? undefined);

    const toggleCategory = (categoryId: string) => {
        setOverride({
            forPathname: pathname,
            value: expandedCategoryId === categoryId ? null : categoryId,
        });
    };

    const renderArticles = () => {
        if (isArticlesLoading) {
            return (
                <ul
                    className={cn(
                        'blog-collections-nav-articles mt-0.5 mb-1.5 ml-5 flex flex-col border-l',
                        BLOG_NAV_PALETTE.rule,
                    )}
                    aria-busy="true"
                    aria-label="Loading articles"
                >
                    {SKELETON_KEYS.slice(0, 3).map((key) => (
                        <li key={`nav-article-skeleton-${key}`} className="-ml-px">
                            <div className="flex items-center border-l-2 border-transparent px-3.5 py-2">
                                <Skeleton className={cn('h-5 w-4/5 rounded-sm', BLOG_NAV_PALETTE.skeleton)} />
                            </div>
                        </li>
                    ))}
                </ul>
            );
        }

        if (!articles || articles.length === 0) {
            return (
                <p
                    className={cn(
                        'blog-collections-nav-articles mt-0.5 mb-1.5 ml-5 border-l px-3.5 py-2 text-sm',
                        BLOG_NAV_PALETTE.rule,
                        BLOG_NAV_PALETTE.muted,
                    )}
                >
                    No articles yet
                </p>
            );
        }

        return (
            <ul
                className={cn(
                    'blog-collections-nav-articles mt-0.5 mb-1.5 ml-5 flex flex-col border-l',
                    BLOG_NAV_PALETTE.rule,
                )}
            >
                {articles.map((article) => {
                    const isCurrent = Boolean(activeArticleSlug) && article.slug === activeArticleSlug;

                    return (
                        <li key={article._id} className="-ml-px">
                            <Link
                                to={`${HELP_CENTER_PATH}/${article.slug}`}
                                onClick={onNavigate}
                                aria-current={isCurrent ? 'page' : undefined}
                                className={cn(
                                    'block border-l-2 px-3.5 py-2 text-sm leading-snug font-medium',
                                    isCurrent ? BLOG_NAV_PALETTE.articleActive : BLOG_NAV_PALETTE.article,
                                )}
                            >
                                {article.title}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        );
    };

    const renderCategory = (category: TagType) => {
        const isActive = category._id === activeCategoryId;
        const isExpanded = category._id === expandedCategoryId;

        return (
            <li key={category._id} className="blog-collections-nav-item flex flex-col">
                <div className="blog-collections-nav-row flex items-stretch gap-0.5">
                    <Link
                        to={`${HELP_CENTER_COLLECTIONS_PATH}/${category._id}`}
                        onClick={onNavigate}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                            'flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-sm font-medium',
                            isActive ? BLOG_NAV_PALETTE.rowActive : BLOG_NAV_PALETTE.row,
                        )}
                    >
                        <CollectionIcon icon={category.icon} variant="bare" size="sm" />
                        <span className="truncate">{category.name}</span>
                    </Link>
                    <button
                        type="button"
                        aria-expanded={isExpanded}
                        aria-label={`${isExpanded ? 'Hide' : 'Show'} articles in ${category.name}`}
                        className={cn(
                            'flex w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg',
                            BLOG_NAV_PALETTE.toggle,
                        )}
                        onClick={() => toggleCategory(category._id)}
                    >
                        {isExpanded ? <ChevronDownIcon className="size-4" /> : <ChevronRightIcon className="size-4" />}
                    </button>
                </div>
                {isExpanded ? renderArticles() : null}
            </li>
        );
    };

    const renderBody = () => {
        if (isLoading) {
            return (
                <ul
                    className="blog-collections-nav-list flex flex-col gap-0.5"
                    aria-busy="true"
                    aria-label="Loading collections"
                >
                    {SKELETON_KEYS.map((key) => (
                        <li key={`nav-skeleton-${key}`} className="blog-collections-nav-item flex flex-col">
                            <div className="blog-collections-nav-row flex items-stretch gap-0.5">
                                <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2.5 py-2.5">
                                    <Skeleton className={cn('size-4 shrink-0 rounded-sm', BLOG_NAV_PALETTE.skeleton)} />
                                    <Skeleton className={cn('h-5 w-2/3 rounded-sm', BLOG_NAV_PALETTE.skeleton)} />
                                </div>
                                <div className="w-7 shrink-0" />
                            </div>
                        </li>
                    ))}
                </ul>
            );
        }

        if (isError) {
            return <p className={cn('px-2.5 text-sm', BLOG_NAV_PALETTE.muted)}>Collections could not be loaded</p>;
        }

        if (!categories || categories.length === 0) {
            return <p className={cn('px-2.5 text-sm', BLOG_NAV_PALETTE.muted)}>No collections yet</p>;
        }

        return <ul className="blog-collections-nav-list flex flex-col gap-0.5">{categories.map(renderCategory)}</ul>;
    };

    return (
        <nav aria-label="Collections" className={cn('blog-collections-nav flex flex-col', className)}>
            <p
                className={cn(
                    'blog-collections-nav-heading px-2.5 pb-2.5 text-xs font-semibold tracking-wide uppercase',
                    BLOG_NAV_PALETTE.heading,
                )}
            >
                Collections
            </p>
            {renderBody()}
        </nav>
    );
};

export default BlogCollectionsNav;
