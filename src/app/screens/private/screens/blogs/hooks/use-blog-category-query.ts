import { useQuery } from '@tanstack/react-query';

import { appTagsApi } from '@/lib/api/app/tags';
import { type TagType } from '@/types/admin';

export const useBlogCategoryQuery = (categoryId: string | undefined) =>
    useQuery<TagType>({
        queryKey: ['blog-category', categoryId],
        queryFn: ({ signal }) => appTagsApi.getBlogCategory(categoryId!, { signal }),
        enabled: Boolean(categoryId),
    });
