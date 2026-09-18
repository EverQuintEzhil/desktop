import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type { SortingState } from '@tanstack/react-table';
import qs from 'qs';

import type { SkillType } from '@/types/admin';
import type { PagedList, RawPagedList } from '@/types/api-types';

import uiAxios from '../../axios';
import { apiClient, type ApiRequestConfig } from '../client';
import { mapPagedList } from '../mappers';

import { patchAgentCaches, setEnabledById } from './agent-cache';

interface SkillFileEntry {
    path: string;
    kind?: string;
    isFolder?: boolean;
    content?: string;
    [key: string]: unknown;
}

interface SkillFilesEnvelope {
    folders?: SkillFileEntry[];
    files?: SkillFileEntry[];
    values?: SkillFileEntry[];
    items?: SkillFileEntry[];
    data?: SkillFileEntry[];
}

type SkillFilesResponse = SkillFileEntry[] | SkillFilesEnvelope;

export interface SkillPreference {
    skillId: string;
    userId: string;
    disabled: boolean;
    agentId?: string;
}

const normalizeSkillFiles = (response: SkillFilesResponse): SkillFileEntry[] => {
    if (Array.isArray(response)) return response;

    if (response.folders || response.files) {
        return [...(response.folders ?? []), ...(response.files ?? [])];
    }

    return response.files ?? response.values ?? response.items ?? response.data ?? [];
};

export const skillsApi = {
    async list(
        params: {
            page?: number;
            size?: number;
            search?: string;
            sortBy?: string[];
            createdByMe?: boolean;
            agentId?: string;
            enabled?: 'true' | 'false';
            accessibleOnly?: boolean;
        } = {},
        config?: ApiRequestConfig,
    ): Promise<PagedList<SkillType>> {
        const raw = await apiClient.get<RawPagedList<SkillType>>('/skills', {
            params,
            paramsSerializer: (p) => qs.stringify(p, { arrayFormat: 'repeat' }),
            ...config,
        });

        return mapPagedList(raw);
    },

    async getById(id: string, config?: ApiRequestConfig): Promise<SkillType> {
        return apiClient.get<SkillType>(`/skills/${id}`, config);
    },

    async uploadSkillFromZip(payload: { fileId: string }, config?: ApiRequestConfig): Promise<SkillType> {
        return apiClient.post<SkillType>('/skills', payload, config);
    },

    async replaceSkillFromZip(id: string, payload: { fileId: string }, config?: ApiRequestConfig): Promise<SkillType> {
        return apiClient.put<SkillType>(`/skills/${id}/replace`, payload, config);
    },

    async clone(id: string, config?: ApiRequestConfig): Promise<SkillType> {
        return apiClient.post<SkillType>(`/skills/${id}/clone`, {}, config);
    },

    async downloadSkillAsZip(id: string, config?: ApiRequestConfig): Promise<Blob> {
        const response = await uiAxios.get<Blob>(`/skills/${id}/files/download`, {
            ...config,
            responseType: 'blob',
        });

        return response.data;
    },

    async create(data: object, config?: ApiRequestConfig): Promise<SkillType> {
        return apiClient.post<SkillType>('/skills', data, config);
    },

    async update(id: string, data: object, config?: ApiRequestConfig): Promise<SkillType> {
        return apiClient.put<SkillType>(`/skills/${id}`, data, config);
    },

    async delete(id: string, config?: ApiRequestConfig): Promise<unknown> {
        return apiClient.delete<unknown>(`/skills/${id}`, config);
    },

    async getFile(
        id: string,
        path: string,
        config?: ApiRequestConfig,
    ): Promise<{ path: string; content?: string; [key: string]: unknown }> {
        return apiClient.get<{ path: string; content?: string; [key: string]: unknown }>(`/skills/${id}/files`, {
            ...config,
            params: { ...config?.params, path, includeContent: true },
        });
    },

    async getFiles(id: string, folder?: string, config?: ApiRequestConfig): Promise<SkillFileEntry[]> {
        const response = await apiClient.get<SkillFilesResponse>(`/skills/${id}/files`, {
            ...config,
            params: { ...config?.params, folder },
        });

        return normalizeSkillFiles(response);
    },

    async createFile(id: string, data: object, config?: ApiRequestConfig): Promise<unknown> {
        return apiClient.post<unknown>(`/skills/${id}/files`, data, config);
    },

    async createFolder(id: string, data: object, config?: ApiRequestConfig): Promise<unknown> {
        return apiClient.post<unknown>(`/skills/${id}/folders`, data, config);
    },

    async editFile(id: string, data: object, config?: ApiRequestConfig): Promise<unknown> {
        return apiClient.put<unknown>(`/skills/${id}/files`, data, config);
    },

    async renameFile(id: string, data: object, config?: ApiRequestConfig): Promise<unknown> {
        return apiClient.patch<unknown>(`/skills/${id}/files`, data, config);
    },

    async deleteFile(id: string, path: string, config?: ApiRequestConfig): Promise<unknown> {
        return apiClient.delete<unknown>(`/skills/${id}/files`, { ...config, params: { ...config?.params, path } });
    },

    async uploadFile(
        id: string,
        payload: { fileId: string; path?: string; folder?: string },
        config?: ApiRequestConfig,
    ): Promise<unknown> {
        return apiClient.post<unknown>(`/skills/${id}/files/upload`, payload, config);
    },

    getSkillPreference(id: string, config?: ApiRequestConfig): Promise<SkillPreference | null> {
        return apiClient.get<SkillPreference | null>(`/skills/${id}/preferences`, config);
    },

    putSkillPreference(
        id: string,
        disabled: boolean,
        agentId?: string,
        config?: ApiRequestConfig,
    ): Promise<SkillPreference> {
        return apiClient.put<SkillPreference>(
            `/skills/${id}/preferences`,
            agentId ? { disabled, agentId } : { disabled },
            config,
        );
    },
};

export const SKILLS_QUERY_KEY = ['admin', 'skills'] as const;
export const SKILLS_LIST_QUERY_KEY = [...SKILLS_QUERY_KEY, 'list'] as const;

export const SKILLS_PAGE_SIZE = 30;

// Broad prefixes on purpose: skill lists live under two unrelated roots — the admin-style
// ['admin', 'skills', ...] tree and the ['skills', 'composer'|'sidebar', ...] tree the chat
// composer and settings sidebar read — plus the agent payload (['agent', agentId]) that
// carries the agent's attached skills. Anything narrower leaves one of those surfaces stale.
export const invalidateSkillSurfaces = (queryClient: QueryClient): void => {
    void queryClient.invalidateQueries({ queryKey: SKILLS_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: ['skills'] });
    void queryClient.invalidateQueries({ queryKey: ['agent'] });
};

export const composerSkillsKey = (agentId: string) => ['skills', 'composer', agentId] as const;

export const patchSkillEnabledInCaches = (
    queryClient: QueryClient,
    agentId: string,
    skillId: string,
    enabled: boolean,
): void => {
    queryClient.setQueryData<PagedList<SkillType>>(composerSkillsKey(agentId), (prev) =>
        prev ? { ...prev, values: setEnabledById(prev.values, skillId, enabled) } : prev,
    );
    patchAgentCaches(queryClient, agentId, (agent) =>
        agent.skills ? { ...agent, skills: setEnabledById(agent.skills, skillId, enabled) } : agent,
    );
};

export interface SkillsQueryParams {
    pageIndex: number;
    pageSize: number;
    search: string;
    sort: SortingState;
}

export function useSkillsQuery(params: SkillsQueryParams) {
    return useQuery({
        queryKey: [...SKILLS_LIST_QUERY_KEY, params],
        queryFn: () =>
            skillsApi.list({
                page: params.pageIndex,
                size: params.pageSize,
                search: params.search,
                sortBy: params.sort.map((s) => `${s.id}:${s.desc ? 'desc' : 'asc'}`),
            }),
        placeholderData: keepPreviousData,
    });
}

export interface SkillsInfiniteQueryParams {
    pageSize?: number;
    search: string;
    sort: SortingState;
    accessibleOnly?: boolean;
}

export function useSkillsInfiniteQuery(params: SkillsInfiniteQueryParams) {
    const pageSize = params.pageSize ?? SKILLS_PAGE_SIZE;

    return useInfiniteQuery({
        queryKey: [...SKILLS_LIST_QUERY_KEY, 'infinite', { ...params, pageSize }],
        queryFn: ({ pageParam = 0, signal }) =>
            skillsApi.list(
                {
                    page: pageParam as number,
                    size: pageSize,
                    search: params.search,
                    sortBy: params.sort.map((s) => `${s.id}:${s.desc ? 'desc' : 'asc'}`),
                    ...(params.accessibleOnly ? { accessibleOnly: true } : {}),
                },
                { signal },
            ),
        initialPageParam: 0,
        getNextPageParam: (lastPage) => {
            const { page, totalPages } = lastPage.pageInfo;

            return totalPages - page > 1 ? page + 1 : undefined;
        },
    });
}

export function useSkillByIdQuery(id: string | undefined) {
    return useQuery({
        queryKey: [...SKILLS_QUERY_KEY, 'detail', id],
        queryFn: () => skillsApi.getById(id!),
        enabled: !!id,
    });
}

export function useSkillFilesQuery(id: string | undefined, folder: string) {
    return useQuery({
        queryKey: [...SKILLS_QUERY_KEY, 'detail', id, 'files', folder],
        queryFn: () => skillsApi.getFiles(id!, folder),
        enabled: !!id,
    });
}

export function useCreateSkillMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: object) => skillsApi.create(data),
        onSuccess: () => {
            invalidateSkillSurfaces(queryClient);
        },
    });
}

export function useUpdateSkillMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: object }) => skillsApi.update(id, data),
        onSuccess: (updatedSkill, variables) => {
            // PUT /skills/:id answers with a bare formatted skill that omits `globalEnabled`
            // and `preference`, so the response is merged over the cached row rather than
            // replacing it; a wholesale replace would drop enablement state from the cache.
            const mergeInto = (prev: SkillType | undefined) => (prev ? { ...prev, ...updatedSkill } : updatedSkill);

            const replaceInValues = (values: SkillType[]) =>
                values.map((s) => (s._id === updatedSkill._id ? mergeInto(s) : s));

            queryClient.setQueriesData(
                { queryKey: SKILLS_LIST_QUERY_KEY },
                (prev: PagedList<SkillType> | InfiniteData<PagedList<SkillType>> | undefined) => {
                    if (!prev) return prev;

                    if ('pages' in prev) {
                        return {
                            ...prev,
                            pages: prev.pages.map((page) => ({ ...page, values: replaceInValues(page.values) })),
                        };
                    }

                    if ('values' in prev) {
                        return { ...prev, values: replaceInValues(prev.values) };
                    }

                    return prev;
                },
            );

            // The sidebar's personal-skills query uses a different key prefix
            // (['skills', 'sidebar', 'personal', ...]) that the list patch above
            // doesn't reach. Patch it here so a name/description edit is reflected
            // in the sidebar immediately.
            queryClient.setQueriesData(
                { queryKey: ['skills', 'sidebar', 'personal'] },
                (prev: PagedList<SkillType> | undefined) => {
                    if (!prev || !('values' in prev)) return prev;

                    return { ...prev, values: replaceInValues(prev.values) };
                },
            );

            queryClient.setQueryData<SkillType>([...SKILLS_QUERY_KEY, 'detail', variables.id], mergeInto);
            if (updatedSkill._id !== variables.id) {
                queryClient.setQueryData<SkillType>([...SKILLS_QUERY_KEY, 'detail', updatedSkill._id], mergeInto);
            }

            // The patches above only reach the settings-side caches; the chat composer and
            // the agent payload hold their own copies of the same skill.
            void queryClient.invalidateQueries({ queryKey: ['skills', 'composer'] });
            void queryClient.invalidateQueries({ queryKey: ['agent'] });
        },
    });
}

export function useDeleteSkillMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => skillsApi.delete(id),
        onSuccess: (_data, deletedId) => {
            queryClient.removeQueries({ queryKey: [...SKILLS_QUERY_KEY, 'detail', deletedId] });
            // Deliberately not `invalidateSkillSurfaces`: its SKILLS_QUERY_KEY prefix matches the
            // deleted skill's own detail/files queries, which the editor pane still observes until
            // it navigates away — refetching them 404s. These three roots skip that subtree.
            void queryClient.invalidateQueries({ queryKey: SKILLS_LIST_QUERY_KEY });
            void queryClient.invalidateQueries({ queryKey: ['skills'] });
            void queryClient.invalidateQueries({ queryKey: ['agent'] });
        },
    });
}

export function useCreateSkillFileMutation() {
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: object }) => skillsApi.createFile(id, data),
    });
}

export function useCreateSkillFolderMutation() {
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: object }) => skillsApi.createFolder(id, data),
    });
}

export function useEditSkillFileMutation() {
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: object }) => skillsApi.editFile(id, data),
    });
}

export function useRenameSkillFileMutation() {
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: object }) => skillsApi.renameFile(id, data),
    });
}

export function useDeleteSkillFileMutation() {
    return useMutation({
        mutationFn: ({ id, path }: { id: string; path: string }) => skillsApi.deleteFile(id, path),
    });
}

export function useUploadSkillFileMutation() {
    return useMutation({
        mutationFn: ({ id, payload }: { id: string; payload: { fileId: string; path?: string; folder?: string } }) =>
            skillsApi.uploadFile(id, payload),
    });
}

export function useUploadSkillFromZipMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: { fileId: string }) => skillsApi.uploadSkillFromZip(payload),
        onSuccess: () => {
            invalidateSkillSurfaces(queryClient);
        },
    });
}

export function useReplaceSkillFromZipMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, fileId }: { id: string; fileId: string }) => skillsApi.replaceSkillFromZip(id, { fileId }),
        onSuccess: (updatedSkill, variables) => {
            queryClient.setQueryData([...SKILLS_QUERY_KEY, 'detail', variables.id], updatedSkill);
            void queryClient.invalidateQueries({ queryKey: [...SKILLS_QUERY_KEY, 'detail', variables.id, 'files'] });
            invalidateSkillSurfaces(queryClient);
        },
    });
}

export function useDownloadSkillAsZipMutation() {
    return useMutation({
        mutationFn: (id: string) => skillsApi.downloadSkillAsZip(id),
    });
}

export function useCloneSkillMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => skillsApi.clone(id),
        onSuccess: () => {
            invalidateSkillSurfaces(queryClient);
        },
    });
}
