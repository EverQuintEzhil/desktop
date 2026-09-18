import { apiClient, type ApiRequestConfig } from '../client';

export const appBlogApi = {
    async getBlogPost<T = unknown>(blogPostId: string, config?: ApiRequestConfig): Promise<T> {
        return apiClient.get<T>(`/blogposts/${blogPostId}`, config);
    },
};
