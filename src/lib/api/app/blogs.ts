import qs from 'qs';

import type { BlogPostTypeEnum } from '@/types/admin';
import type { PagedList, RawPagedList } from '@/types/api-types';

import { apiClient, type ApiRequestConfig } from '../client';
import { mapPagedList } from '../mappers';

export const READER_BLOG_POST_TYPES: BlogPostTypeEnum[] = ['announcement', 'post'];

/** Announcements is the timeline of what shipped; the knowledge base is the written guides. */
export const ANNOUNCEMENT_POST_TYPES: BlogPostTypeEnum[] = ['announcement'];

export const KNOWLEDGE_POST_TYPES: BlogPostTypeEnum[] = ['post'];

type ListBlogPostsParams = {
    search?: string;
    sortBy?: string;
    size?: number;
    page?: number;
    tags?: string[];
    types?: BlogPostTypeEnum[];
    categoryId?: string;
    ids?: string[];
};

export const appBlogsApi = {
    async listBlogPosts<T = unknown>(
        params: ListBlogPostsParams = {},
        config?: ApiRequestConfig,
    ): Promise<PagedList<T>> {
        const raw = await apiClient.get<RawPagedList<T>>('/blogposts', {
            ...config,
            params,
            paramsSerializer: (p) => qs.stringify(p, { arrayFormat: 'repeat' }),
        });

        return mapPagedList(raw);
    },
};
