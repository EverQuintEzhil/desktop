import { FileTextIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { BlogPostType } from '@/types/admin';

import { HELP_CENTER_PATH } from '../../constants';

export interface BlogArticleRowProps {
    post: BlogPostType;
}

const BlogArticleRow = (props: BlogArticleRowProps) => {
    const { post } = props;

    return (
        <li className="blog-article-row flex">
            <Link
                to={`${HELP_CENTER_PATH}/${post.slug}`}
                className="blog-article-row-link flex w-full rounded-xl px-5 hover:bg-card"
            >
                <span className="blog-article-row-inner flex w-full items-center gap-5 border-b border-border-secondary py-5">
                    <span className="blog-article-row-body flex min-w-0 flex-1 flex-col">
                        <span className="text-base leading-snug font-medium text-(--text-primary)">{post.title}</span>
                        {post.description ? (
                            <span className="truncate text-sm leading-normal font-medium text-text-secondary">
                                {post.description}
                            </span>
                        ) : null}
                    </span>
                    <FileTextIcon className="size-5 shrink-0 text-text-secondary" aria-hidden="true" />
                </span>
            </Link>
        </li>
    );
};

export default BlogArticleRow;
