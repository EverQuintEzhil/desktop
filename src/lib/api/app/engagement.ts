import { apiClient, type ApiRequestConfig } from '../client';

export const appEngagementApi = {
    async updateLike<D = unknown>(
        itemType: string,
        itemId: string,
        data: D,
        config?: ApiRequestConfig,
    ): Promise<unknown> {
        return apiClient.put<unknown, D>(`/${itemType}/${itemId}/liked`, data, config);
    },
};
