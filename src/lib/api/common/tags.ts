import qs from 'qs';

import type { TagForEnum, TagType } from '@/types/admin';
import type { PagedList, RawPagedList } from '@/types/api-types';

import { apiClient, type ApiRequestConfig } from '../client';
import { mapPagedList } from '../mappers';

export type ListTagsParams = {
    page?: number;
    size?: number;
    search?: string;
    sortBy?: string | string[];
    tagFor?: TagForEnum;
    hasPosts?: boolean;
};

export const tagsApi = {
    async list(params: ListTagsParams = {}, config?: ApiRequestConfig): Promise<PagedList<TagType>> {
        const raw = await apiClient.get<RawPagedList<TagType>>('/tags', {
            params,
            paramsSerializer: (p) => qs.stringify(p, { arrayFormat: 'repeat' }),
            ...config,
        });

        return mapPagedList(raw);
    },

    async getById(id: string, config?: ApiRequestConfig): Promise<TagType> {
        return apiClient.get<TagType>(`/tags/${id}`, config);
    },
};
