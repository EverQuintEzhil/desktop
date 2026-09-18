import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SortingState } from '@tanstack/react-table';
import qs from 'qs';

import type { BlogPostType } from '@/types/admin';
import type { PagedList, RawPagedList } from '@/types/api-types';

import { apiClient, type ApiRequestConfig } from '../client';
import { mapPagedList } from '../mappers';

export type CategorySortOrderItem = {
    blogpostId: string;
    categorySortOrder: number;
};

export type CategorySortOrderResult = {
    categoryId: string;
    updated: number;
};

export const adminBlogPostsApi = {
    async list(
        params: {
            page?: number;
            size?: number;
            search?: string;
            sortBy?: string[];
            types?: string[];
            includeDrafts?: boolean;
            includePrivate?: boolean;
            featuredOnly?: boolean;
            tags?: string[];
            categoryId?: string;
        } = {},
        config?: ApiRequestConfig,
    ): Promise<PagedList<BlogPostType>> {
        const raw = await apiClient.get<RawPagedList<BlogPostType>>('/blogposts', {
            params,
            paramsSerializer: (p) => qs.stringify(p, { arrayFormat: 'repeat' }),
            ...config,
        });

        return mapPagedList(raw);
    },

    async getById(id: string): Promise<BlogPostType> {
        return apiClient.get<BlogPostType>(`/blogposts/${id}`);
    },

    async getFile<T = unknown>(id: string): Promise<T> {
        return apiClient.get<T>(`/files/${id}`);
    },

    async create(data: object): Promise<BlogPostType> {
        return apiClient.post<BlogPostType>('/blogposts', data);
    },

    async update(id: string, data: object): Promise<BlogPostType> {
        return apiClient.put<BlogPostType>(`/blogposts/${id}`, data);
    },

    async updateCategorySortOrder(items: CategorySortOrderItem[]): Promise<CategorySortOrderResult> {
        return apiClient.put<CategorySortOrderResult>('/blogposts/category-sort-order', { items });
    },

    async delete(id: string): Promise<unknown> {
        return apiClient.delete<unknown>(`/blogposts/${id}`);
    },
};

export const BLOG_POSTS_QUERY_KEY = ['admin', 'blog-posts'] as const;
export const BLOG_POSTS_LIST_QUERY_KEY = [...BLOG_POSTS_QUERY_KEY, 'list'] as const;

export interface BlogPostsQueryParams {
    pageIndex: number;
    pageSize: number;
    search: string;
    sort: SortingState;
    featuredOnly?: boolean;
    tags?: string[];
}

export function useBlogPostsQuery(params: BlogPostsQueryParams) {
    return useQuery({
        queryKey: [...BLOG_POSTS_LIST_QUERY_KEY, params],
        queryFn: () =>
            adminBlogPostsApi.list({
                page: params.pageIndex,
                size: params.pageSize,
                search: params.search,
                sortBy: params.sort.map((s) => `${s.id}:${s.desc ? 'desc' : 'asc'}`),
                types: ['post', 'announcement', 'page'],
                includeDrafts: true,
                includePrivate: true,
                featuredOnly: params.featuredOnly || undefined,
                tags: params.tags?.length ? params.tags : undefined,
            }),
        placeholderData: keepPreviousData,
    });
}

export function useBlogPostByIdQuery(id: string) {
    return useQuery({
        queryKey: [...BLOG_POSTS_QUERY_KEY, 'detail', id],
        queryFn: () => adminBlogPostsApi.getById(id),
        enabled: !!id,
    });
}

export const CATEGORY_ORDER_QUERY_KEY = [...BLOG_POSTS_QUERY_KEY, 'category-order'] as const;

export const CATEGORY_ORDER_PAGE_SIZE = 100;

export function useCategoryOrderedPostsQuery(categoryId: string | null | undefined) {
    return useQuery({
        queryKey: [...CATEGORY_ORDER_QUERY_KEY, categoryId],
        queryFn: () =>
            adminBlogPostsApi.list({
                categoryId: categoryId!,
                sortBy: ['categorySortOrder:asc'],
                size: CATEGORY_ORDER_PAGE_SIZE,
                includeDrafts: true,
                includePrivate: true,
            }),
        enabled: !!categoryId,
    });
}

export function useBlogPostFileQuery<T = unknown>(fileId: string | undefined) {
    return useQuery({
        queryKey: [...BLOG_POSTS_QUERY_KEY, 'file', fileId],
        queryFn: () => adminBlogPostsApi.getFile<T>(fileId!),
        enabled: !!fileId,
        retry: false,
    });
}

export function useCreateBlogPostMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: object) => adminBlogPostsApi.create(data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: BLOG_POSTS_QUERY_KEY }),
    });
}

export function useUpdateBlogPostMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: object }) => adminBlogPostsApi.update(id, data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: BLOG_POSTS_QUERY_KEY }),
    });
}

export function useDeleteBlogPostMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => adminBlogPostsApi.delete(id),
        onSuccess: (_data, deletedId) => {
            queryClient.removeQueries({ queryKey: [...BLOG_POSTS_QUERY_KEY, 'detail', deletedId] });
            void queryClient.invalidateQueries({ queryKey: BLOG_POSTS_LIST_QUERY_KEY });
        },
    });
}
