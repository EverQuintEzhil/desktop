import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { appTagsApi } from '@/lib/api/app/tags';
import { type TagType } from '@/types/admin';

const CATEGORY_LIST_PAGE_SIZE = 100;
const CATEGORY_GRID_PAGE_SIZE = 30;

export const useBlogCategoriesQuery = (search = '') =>
    useQuery<TagType[]>({
        queryKey: ['blog-categories', search],
        queryFn: async ({ signal }) => {
            const { values } = await appTagsApi.listBlogCategories(
                { search: search || undefined, size: CATEGORY_LIST_PAGE_SIZE },
                { signal },
            );

            return values;
        },
        placeholderData: keepPreviousData,
    });

export const useBlogCategoriesGridQuery = (search = '', sortBy?: string) =>
    useInfiniteQuery({
        queryKey: ['blog-categories-grid', search, sortBy],
        queryFn: ({ pageParam, signal }) =>
            appTagsApi.listBlogCategories(
                { search: search || undefined, page: pageParam, size: CATEGORY_GRID_PAGE_SIZE, sortBy },
                { signal },
            ),
        initialPageParam: 0,
        getNextPageParam: (lastPage) => {
            const { page, totalPages } = lastPage.pageInfo;

            return totalPages - page > 1 ? page + 1 : undefined;
        },
    });
