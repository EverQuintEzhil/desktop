import { useQuery } from '@tanstack/react-query';
import qs from 'qs';
import { z } from 'zod';

import type { RawPagedList } from '@/types/api-types';

import { apiClient } from '../client';
import { mapPagedList } from '../mappers';

export const BUILDER_AGENT_MODELS_ABOUT_KEY = 'builder-agent-models';

export const builderAgentModelSchema = z.object({
    modelId: z.string().min(1),
    modelName: z.string().min(1),
});

export type BuilderAgentModel = z.infer<typeof builderAgentModelSchema>;

const aboutByKeySchema = z.object({
    key: z.string(),
    value: z.unknown(),
});

export type AboutByKey = z.infer<typeof aboutByKeySchema>;

export const APP_ABOUT_QUERY_KEY = ['app', 'about'] as const;
export const appAboutByKeyQueryKey = (key: string) => [...APP_ABOUT_QUERY_KEY, 'by-key', key] as const;

export const appAboutApi = {
    async getByKey(key: string): Promise<AboutByKey | undefined> {
        const raw = await apiClient.get<RawPagedList<unknown>>('/abouts', {
            params: { search: key, size: 20 },
            paramsSerializer: (params) => qs.stringify(params, { arrayFormat: 'repeat' }),
        });
        const page = mapPagedList(raw);

        for (const item of page.values) {
            const parsed = aboutByKeySchema.safeParse(item);

            if (parsed.success && parsed.data.key === key) {
                return parsed.data;
            }
        }

        return undefined;
    },
};

export function parseBuilderAgentModels(value: unknown): BuilderAgentModel[] {
    if (!Array.isArray(value)) return [];

    return value.flatMap((item) => {
        const parsed = builderAgentModelSchema.safeParse(item);

        return parsed.success ? [parsed.data] : [];
    });
}

export function useBuilderAgentModelsQuery() {
    return useQuery({
        queryKey: appAboutByKeyQueryKey(BUILDER_AGENT_MODELS_ABOUT_KEY),
        queryFn: async () => {
            const about = await appAboutApi.getByKey(BUILDER_AGENT_MODELS_ABOUT_KEY);

            return parseBuilderAgentModels(about?.value);
        },
    });
}
