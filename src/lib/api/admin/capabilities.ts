import { useMutation } from '@tanstack/react-query';
import qs from 'qs';

import type { BlogPostTypeEnum, TagForEnum } from '@/types/admin';
import type { RawPagedList } from '@/types/api-types';

import { apiClient } from '../client';

export const CAPABILITIES_QUERY_KEY = ['admin', 'capabilities'] as const;

export const ATTACHABLE_MEMORY_KINDS = ['semantic', 'learned_hint'] as const;

export const adminCapabilitiesApi = {
    async update<T = unknown>(type: string, id: string, data: object): Promise<T> {
        return apiClient.put<T>(`/${type}/${id}`, data);
    },

    async search<T = unknown>(
        type: string,
        params: {
            page?: number;
            size?: number;
            search?: string;
            kind?: ReadonlyArray<'conversation' | 'semantic' | 'learned_hint'>;
            tagFor?: TagForEnum;
            types?: BlogPostTypeEnum[];
        } = {},
    ): Promise<RawPagedList<T>> {
        return apiClient.get<RawPagedList<T>>(`/${type}`, {
            params,
            paramsSerializer: (p) => qs.stringify(p, { arrayFormat: 'repeat' }),
        });
    },
};

export interface CapabilitiesUpdateVariables {
    type: string;
    id: string;
    data: object;
}

export function useCapabilitiesUpdateMutation() {
    return useMutation({
        mutationFn: ({ type, id, data }: CapabilitiesUpdateVariables) => adminCapabilitiesApi.update(type, id, data),
    });
}
