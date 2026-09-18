import { useQuery } from '@tanstack/react-query';

import { appBlogApi } from '@/lib/api/app/blog';
import { type BlogPostType } from '@/types/admin';

export const useBlogQuery = (blogPostId: string | undefined) =>
    useQuery<BlogPostType>({
        queryKey: ['blogPost', blogPostId],
        queryFn: ({ signal }) => appBlogApi.getBlogPost<BlogPostType>(blogPostId!, { signal }),
        enabled: Boolean(blogPostId),
    });
