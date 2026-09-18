import { useQuery } from '@tanstack/react-query';

import { BLOG_SORT_ARTICLE_ORDER } from '@/app/screens/private/screens/blogs/constants';
import { appBlogsApi, KNOWLEDGE_POST_TYPES } from '@/lib/api/app/blogs';
import { type BlogPostType } from '@/types/admin';

// One page, no paging: past this many articles in a single category the positional neighbours are
// no longer trustworthy, so BlogAdjacentNav stops claiming an end once a full page comes back.
export const CATEGORY_ARTICLES_PAGE_SIZE = 100;

export const useCategoryArticlesQuery = (categoryId: string | undefined) =>
    useQuery<BlogPostType[]>({
        queryKey: ['blog-category-articles', categoryId],
        queryFn: async ({ signal }) => {
            const { values } = await appBlogsApi.listBlogPosts<BlogPostType>(
                {
                    categoryId,
                    types: KNOWLEDGE_POST_TYPES,
                    sortBy: BLOG_SORT_ARTICLE_ORDER,
                    page: 0,
                    size: CATEGORY_ARTICLES_PAGE_SIZE,
                },
                { signal },
            );

            return values;
        },
        enabled: Boolean(categoryId),
    });
