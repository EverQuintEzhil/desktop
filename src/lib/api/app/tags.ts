import { BLOG_TAG_FOR, type TagType } from '@/types/admin';
import type { PagedList } from '@/types/api-types';

import { type ApiRequestConfig } from '../client';
import { tagsApi } from '../common/tags';

type ListBlogCategoriesParams = {
    search?: string;
    page?: number;
    size?: number;
    sortBy?: string;
};

export const appTagsApi = {
    async listBlogCategories(
        params: ListBlogCategoriesParams = {},
        config?: ApiRequestConfig,
    ): Promise<PagedList<TagType>> {
        const { sortBy = 'sortOrder:asc', ...rest } = params;

        return tagsApi.list({ ...rest, tagFor: BLOG_TAG_FOR, hasPosts: true, sortBy }, config);
    },

    async getBlogCategory(categoryId: string, config?: ApiRequestConfig): Promise<TagType> {
        return tagsApi.getById(categoryId, config);
    },
};
