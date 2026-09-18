import { useInfiniteQuery } from '@tanstack/react-query';

import { appBlogsApi, READER_BLOG_POST_TYPES } from '@/lib/api/app/blogs';
import { type BlogPostType, type BlogPostTypeEnum } from '@/types/admin';

const PAGE_SIZE = 20;

export type BlogsQueryOptions = {
    search?: string;
    /** The collection the list is scoped to. Tags are labels and never scope a collection. */
    categoryId?: string;
    /** Announcements and the knowledge base are the same endpoint split by post type. */
    types?: BlogPostTypeEnum[];
    sortBy?: string;
    size?: number;
    enabled?: boolean;
};

export const useBlogsQuery = (options: BlogsQueryOptions = {}) => {
    const {
        search = '',
        categoryId,
        types = READER_BLOG_POST_TYPES,
        sortBy,
        size = PAGE_SIZE,
        enabled = true,
    } = options;

    return useInfiniteQuery({
        queryKey: ['blogs', search, categoryId, types, sortBy, size],
        queryFn: ({ pageParam = 0, signal }) =>
            appBlogsApi.listBlogPosts<BlogPostType>(
                {
                    search: search || undefined,
                    sortBy,
                    size,
                    page: pageParam as number,
                    categoryId,
                    types,
                },
                { signal },
            ),
        initialPageParam: 0,
        enabled,
        getNextPageParam: (lastPage) => {
            const { page, totalPages } = lastPage.pageInfo;

            return totalPages - page > 1 ? page + 1 : undefined;
        },
    });
};
