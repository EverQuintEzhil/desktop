import type { PagedList, RawPagedList } from '@/types/api-types';

import { apiClient, type ApiRequestConfig } from '../client';
import { mapPagedList } from '../mappers';

export const appAnnouncementsApi = {
    async listAnnouncements<T = unknown>(
        params: { size?: number; page?: number; types?: string; unreadOnly?: boolean; agentId?: string } = {},
        config?: ApiRequestConfig,
    ): Promise<PagedList<T>> {
        const raw = await apiClient.get<RawPagedList<T>>('/blogposts', { ...config, params });

        return mapPagedList(raw);
    },

    async markRead<D = unknown>(data: D, config?: ApiRequestConfig): Promise<unknown> {
        return apiClient.post<unknown, D>('/blogPosts/mark-read', data, config);
    },
};
