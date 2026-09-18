import { ArrowUpRightIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { BlogPostRelatedType } from '@/types/admin';

const HEADING_ID = 'blog-related-articles-heading';

export interface BlogRelatedArticlesProps {
    related: BlogPostRelatedType[] | undefined;
    variant?: 'rows' | 'tiles';
    heading?: string;
    basePath: string;
}

const BlogRelatedArticles = (props: BlogRelatedArticlesProps) => {
    const { related, variant = 'rows', heading, basePath } = props;

    // The API already drops unpublished, private and deleted ids, so anything left is openable.
    const articles = (related ?? []).filter((article) => typeof article === 'object' && Boolean(article?.slug));

    if (articles.length === 0) {
        return null;
    }

    const renderTiles = () => (
        <ul className="blog-related-articles-tiles grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
            {articles.map((article) => (
                <li key={article._id} className="flex">
                    <Link
                        to={`${basePath}/${article.slug}`}
                        className="blog-card-hover flex w-full flex-col gap-2 rounded-2xl bg-card p-5"
                    >
                        <span className="text-h5 leading-snug font-semibold text-primary">{article.title}</span>
                    </Link>
                </li>
            ))}
        </ul>
    );

    const renderRows = () => (
        <ul className="blog-related-articles-list flex flex-col overflow-hidden rounded-3xl bg-card">
            {articles.map((article) => (
                <li key={article._id} className="border-b border-border last:border-b-0">
                    <Link
                        to={`${basePath}/${article.slug}`}
                        className="grid grid-cols-[1fr_auto] items-center gap-3 px-5 py-3 hover:bg-primary/5"
                    >
                        <span className="truncate text-sm font-medium text-(--text-primary)">{article.title}</span>
                        <ArrowUpRightIcon className="size-4 text-primary" aria-hidden="true" />
                    </Link>
                </li>
            ))}
        </ul>
    );

    return (
        <section className="blog-related-articles flex flex-col gap-2.5" aria-labelledby={HEADING_ID}>
            <h2 id={HEADING_ID} className="text-h3 font-semibold text-(--text-primary)">
                {heading ?? 'Related articles'}
            </h2>
            {variant === 'tiles' ? renderTiles() : renderRows()}
        </section>
    );
};

export default BlogRelatedArticles;
