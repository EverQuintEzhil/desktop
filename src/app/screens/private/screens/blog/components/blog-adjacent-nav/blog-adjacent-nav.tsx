import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

import { CATEGORY_ARTICLES_PAGE_SIZE } from '@/app/hooks/use-category-articles-query';
import { cn } from '@/lib/utils';
import type { BlogPostType } from '@/types/admin';

import { HELP_CENTER_PATH } from '../../../blogs/constants';

export interface BlogAdjacentNavProps {
    articles: BlogPostType[] | undefined;
    currentSlug: string | undefined;
}

const BlogAdjacentNav = (props: BlogAdjacentNavProps) => {
    const { articles, currentSlug } = props;
    const ordered = articles ?? [];
    const currentIndex = currentSlug ? ordered.findIndex((article) => article.slug === currentSlug) : -1;

    if (currentIndex === -1) {
        return null;
    }

    const previous = currentIndex > 0 ? ordered[currentIndex - 1] : undefined;
    const isLastFetched = currentIndex === ordered.length - 1;
    // A full page means there are probably more articles behind it, so the last fetched article
    // must not be presented as the end of the collection.
    const mayHaveMore = ordered.length >= CATEGORY_ARTICLES_PAGE_SIZE;
    const next = isLastFetched ? undefined : ordered[currentIndex + 1];

    if (isLastFetched && mayHaveMore) {
        return null;
    }

    if (!previous && !next) {
        return null;
    }

    const renderLink = (article: BlogPostType | undefined, direction: 'previous' | 'next') => {
        if (!article) {
            return <span className="blog-adjacent-nav-spacer hidden sm:block" />;
        }

        const isPrevious = direction === 'previous';
        const Arrow = isPrevious ? ArrowLeftIcon : ArrowRightIcon;

        const arrow = <Arrow className="size-5 shrink-0 text-primary" aria-hidden="true" />;

        return (
            <Link
                to={`${HELP_CENTER_PATH}/${article.slug}`}
                rel={isPrevious ? 'prev' : 'next'}
                className={cn(
                    'blog-adjacent-nav-link blog-card-hover flex items-center gap-4 rounded-3xl border border-border bg-card px-6 py-5',
                    isPrevious ? 'justify-start' : 'justify-end',
                )}
            >
                {isPrevious ? arrow : null}
                <span className={cn('flex min-w-0 flex-col gap-0.5', isPrevious ? 'items-start' : 'items-end')}>
                    <span className="text-sm font-medium text-text-secondary">{isPrevious ? 'Previous' : 'Next'}</span>
                    <span
                        className={cn(
                            'line-clamp-2 text-h5 font-semibold text-(--text-primary)',
                            isPrevious ? 'text-left' : 'text-right',
                        )}
                    >
                        {article.title}
                    </span>
                </span>
                {isPrevious ? null : arrow}
            </Link>
        );
    };

    return (
        <nav
            aria-label="Article navigation"
            className="blog-adjacent-nav grid grid-cols-1 gap-4 border-t border-border pt-8 sm:grid-cols-2"
        >
            {renderLink(previous, 'previous')}
            {renderLink(next, 'next')}
        </nav>
    );
};

export default BlogAdjacentNav;
