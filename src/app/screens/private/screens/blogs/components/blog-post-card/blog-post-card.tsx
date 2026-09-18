import { Link } from 'react-router-dom';

import { Image } from '@/components';
import type { BlogPostType } from '@/types/admin';
import { resolveCategoryTag } from '@/utils/resolve-category-tag';

import { ANNOUNCEMENTS_PATH } from '../../constants';
import { formatBlogDate } from '../../utils/format-blog-date';

export interface BlogPostCardProps {
    post: BlogPostType;
}

const BlogPostCard = (props: BlogPostCardProps) => {
    const { post } = props;
    const category = resolveCategoryTag(post);
    const featuredImage = typeof post.featuredImage === 'string' ? post.featuredImage : post.featuredImage?.url;

    const renderFigure = () => {
        if (!featuredImage) {
            return null;
        }

        return (
            <figure className="blog-post-figure mt-1 flex h-50 items-center justify-center overflow-hidden rounded-xl">
                <Image
                    src={featuredImage}
                    placeholder={'/assets/images/broken-image.svg'}
                    alt={post.title || 'Blog Cover'}
                />
            </figure>
        );
    };

    return (
        <li className="blog-post-card blog-post-card-link">
            <Link
                to={`${ANNOUNCEMENTS_PATH}/${post.slug}`}
                className="blog-card-hover flex flex-col gap-3 rounded-3xl bg-card px-7 pt-7 pb-5"
            >
                <div className="blog-post-card-meta flex items-center gap-2.5">
                    {category ? (
                        <span className="blog-post-card-tag rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-primary">
                            {category.name}
                        </span>
                    ) : null}
                    <span className="text-xs text-text-secondary">{formatBlogDate(post.createdAt)}</span>
                </div>
                {post.title ? (
                    <h3 className="text-lg leading-snug font-semibold text-pretty text-primary">{post.title}</h3>
                ) : null}
                {post.description ? (
                    <p className="text-sm leading-normal font-medium text-text-secondary">{post.description}</p>
                ) : null}
                {renderFigure()}
            </Link>
        </li>
    );
};

export default BlogPostCard;
