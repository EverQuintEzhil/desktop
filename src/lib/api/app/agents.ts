import qs from 'qs';

import type { PagedList, RawPagedList } from '@/types/api-types';

import { apiClient, type ApiRequestConfig } from '../client';
import { mapPagedList } from '../mappers';

export const appAgentsApi = {
    async listTags<T = unknown>(config?: ApiRequestConfig): Promise<{ values: T[] }> {
        return apiClient.get<{ values: T[] }>('/tags', config);
    },

    async listAgents<T = unknown>(
        params: {
            search?: string;
            size?: number;
            page?: number;
            mineOnly?: boolean;
            ids?: string[];
            sortBy?: string;
        } = {},
        config?: ApiRequestConfig,
    ): Promise<PagedList<T>> {
        const raw = await apiClient.get<RawPagedList<T>>('/agents', {
            ...config,
            params,
            paramsSerializer: (p) => qs.stringify(p, { arrayFormat: 'repeat' }),
        });

        return mapPagedList(raw);
    },

    async listLaunchers<T = unknown>(
        params: { search?: string; tags?: string; size?: number; page?: number; ids?: string[] } = {},
        config?: ApiRequestConfig,
    ): Promise<PagedList<T>> {
        const raw = await apiClient.get<RawPagedList<T>>('/launchers', {
            ...config,
            params,
            paramsSerializer: (p) => qs.stringify(p, { arrayFormat: 'repeat' }),
        });

        return mapPagedList(raw);
    },
};
