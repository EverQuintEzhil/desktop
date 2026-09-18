import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SortingState } from '@tanstack/react-table';
import qs from 'qs';
import { useCallback } from 'react';

import { appMediaApi } from '@/lib/api/app/media';
import type { ProjectMemberRoleInput, UpdateProjectPayload } from '@/lib/api/app/projects';
import { filesApi } from '@/lib/api/files-client';
import type { PagedList, RawPagedList } from '@/types/api-types';
import {
    mapProject,
    mapProjectActivity,
    mapProjectFile,
    type ProjectActivityType,
    type ProjectFileType,
    type ProjectType,
} from '@/types/project';

import { apiClient, type ApiRequestConfig } from '../client';
import { mapPagedList } from '../mappers';

// Delay before refetching files after an upload/delete — gives the backend time
// to index the change so the fresh list reflects it.
const FILES_REFETCH_DELAY_MS = 3000;

const delay = (ms: number): Promise<void> =>
    new Promise((resolve) => {
        setTimeout(resolve, ms);
    });

export const adminProjectsApi = {
    async list(
        params: { page?: number; size?: number; search?: string; sortBy?: string[]; agentId?: string } = {},
        config?: ApiRequestConfig,
    ): Promise<PagedList<ProjectType>> {
        const raw = await apiClient.get<RawPagedList<unknown>>('/projects', {
            params: { ...params, admin: true },
            paramsSerializer: (p) => qs.stringify(p, { arrayFormat: 'repeat' }),
            ...config,
        });
        const mapped = mapPagedList(raw);

        return {
            ...mapped,
            values: mapped.values.map((value) => mapProject(value as never)),
        };
    },

    async getById(id: string, config?: ApiRequestConfig): Promise<ProjectType> {
        const raw = await apiClient.get<unknown>(`/projects/${id}`, {
            ...config,
            params: { admin: true, ...config?.params },
        });

        return mapProject(raw as never);
    },

    async listFiles(
        projectId: string,
        params: { page?: number; size?: number } = {},
        config?: ApiRequestConfig,
    ): Promise<PagedList<ProjectFileType>> {
        const raw = await apiClient.get<RawPagedList<unknown>>('/files', {
            ...config,
            params: { ...params, projectId },
        });
        const mapped = mapPagedList(raw);

        return {
            ...mapped,
            values: mapped.values.map((value) => mapProjectFile(value as never)),
        };
    },

    async updateProject(
        projectId: string,
        data: UpdateProjectPayload,
        config?: ApiRequestConfig,
    ): Promise<ProjectType> {
        const raw = await apiClient.put<unknown, UpdateProjectPayload>(`/projects/${projectId}`, data, config);

        return mapProject(raw as never);
    },

    async addMember(
        projectId: string,
        data: { userId: string; role: ProjectMemberRoleInput },
        config?: ApiRequestConfig,
    ): Promise<unknown> {
        return apiClient.post<unknown, typeof data>(`/projects/${projectId}/members`, data, config);
    },

    async changeMemberRole(
        projectId: string,
        userId: string,
        data: { role: ProjectMemberRoleInput },
        config?: ApiRequestConfig,
    ): Promise<unknown> {
        return apiClient.put<unknown, typeof data>(`/projects/${projectId}/members/${userId}`, data, config);
    },

    async removeMember(projectId: string, userId: string, config?: ApiRequestConfig): Promise<unknown> {
        return apiClient.delete<unknown>(`/projects/${projectId}/members/${userId}`, config);
    },

    async listActivities(
        projectId: string,
        params: { page?: number; size?: number } = {},
        config?: ApiRequestConfig,
    ): Promise<PagedList<ProjectActivityType>> {
        const raw = await apiClient.get<RawPagedList<unknown>>(`/projects/${projectId}/activities`, {
            ...config,
            params: { ...params, ...config?.params, admin: true },
        });
        const mapped = mapPagedList(raw);

        return {
            ...mapped,
            values: mapped.values.map((value) => mapProjectActivity(value as never)),
        };
    },
};

export const PROJECTS_QUERY_KEY = ['admin', 'projects'] as const;
export const PROJECTS_LIST_QUERY_KEY = [...PROJECTS_QUERY_KEY, 'list'] as const;

export interface ProjectsQueryParams {
    pageIndex: number;
    pageSize: number;
    search: string;
    sort: SortingState;
    agentId?: string;
}

export function useProjectsQuery(params: ProjectsQueryParams) {
    return useQuery({
        queryKey: [...PROJECTS_LIST_QUERY_KEY, params],
        queryFn: ({ signal }) =>
            adminProjectsApi.list(
                {
                    page: params.pageIndex,
                    size: params.pageSize,
                    search: params.search,
                    sortBy: params.sort.map((s) => `${s.id}:${s.desc ? 'desc' : 'asc'}`),
                    ...(params.agentId ? { agentId: params.agentId } : {}),
                },
                { signal },
            ),
        placeholderData: keepPreviousData,
    });
}

export function useProjectByIdQuery(id: string | undefined) {
    return useQuery({
        queryKey: [...PROJECTS_QUERY_KEY, 'detail', id],
        queryFn: ({ signal }) => adminProjectsApi.getById(id!, { signal }),
        enabled: !!id,
    });
}

export function useProjectFilesQuery(id: string | undefined) {
    return useQuery({
        queryKey: [...PROJECTS_QUERY_KEY, 'files', id],
        queryFn: ({ signal }) => adminProjectsApi.listFiles(id!, { page: 0, size: 100 }, { signal }),
        enabled: !!id,
    });
}

export function useProjectActivitiesQuery(id: string | undefined) {
    return useQuery({
        queryKey: [...PROJECTS_QUERY_KEY, 'activities', id],
        queryFn: ({ signal }) => adminProjectsApi.listActivities(id!, { page: 0, size: 100 }, { signal }),
        enabled: !!id,
    });
}

interface UploadOptions {
    onProgress?: (file: File, progress: number) => void;
    onError?: (file: File) => void;
    onSuccess?: (file: File) => void;
    getSignal?: (file: File) => AbortSignal | undefined;
}

/**
 * Write actions for a project on the admin detail page: edit instructions,
 * add/remove files, and manage member access. Each action invalidates the
 * relevant admin project queries so the UI reflects the change.
 */
export function useAdminProjectActions(projectId: string | undefined, agentId?: string) {
    const queryClient = useQueryClient();

    const invalidateDetail = useCallback(() => {
        if (!projectId) return;
        void queryClient.invalidateQueries({ queryKey: [...PROJECTS_QUERY_KEY, 'detail', projectId] });
        void queryClient.invalidateQueries({ queryKey: PROJECTS_LIST_QUERY_KEY });
    }, [projectId, queryClient]);

    const invalidateFiles = useCallback(async () => {
        if (!projectId) return;
        await queryClient.invalidateQueries({ queryKey: [...PROJECTS_QUERY_KEY, 'files', projectId] });
        invalidateDetail();
    }, [projectId, queryClient, invalidateDetail]);

    const setInstructions = useCallback(
        async (instructions: string) => {
            if (!projectId) return;
            await adminProjectsApi.updateProject(projectId, { instructions });
            invalidateDetail();
        },
        [projectId, invalidateDetail],
    );

    const setDescription = useCallback(
        async (description: string) => {
            if (!projectId) return;
            await adminProjectsApi.updateProject(projectId, { description });
            invalidateDetail();
        },
        [projectId, invalidateDetail],
    );

    const addMember = useCallback(
        async (userId: string, role: ProjectMemberRoleInput) => {
            if (!projectId) return;
            await adminProjectsApi.addMember(projectId, { userId, role });
            invalidateDetail();
        },
        [projectId, invalidateDetail],
    );

    const changeMemberRole = useCallback(
        async (userId: string, role: ProjectMemberRoleInput) => {
            if (!projectId) return;
            await adminProjectsApi.changeMemberRole(projectId, userId, { role });
            invalidateDetail();
        },
        [projectId, invalidateDetail],
    );

    const removeMember = useCallback(
        async (userId: string) => {
            if (!projectId) return;
            await adminProjectsApi.removeMember(projectId, userId);
            invalidateDetail();
        },
        [projectId, invalidateDetail],
    );

    const uploadFiles = useCallback(
        async (fileList: File[], options?: UploadOptions): Promise<string[]> => {
            if (!projectId || fileList.length === 0) return [];

            const promises = fileList.map(async (file) => {
                const form = new FormData();

                form.append('files', file);
                if (agentId) form.append('agent_id', agentId);
                form.append('project_id', projectId);

                try {
                    await filesApi.upload(form, {
                        onUploadProgress: (progressEvent) => {
                            if (progressEvent.total) {
                                const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);

                                options?.onProgress?.(file, percent);
                            }
                        },
                        signal: options?.getSignal?.(file),
                    });

                    options?.onSuccess?.(file);

                    return 'SUCCESS';
                } catch (e) {
                    if (e instanceof Error && e.name === 'CanceledError') return 'CANCELED';
                    options?.onError?.(file);
                    throw e;
                }
            });

            const results = await Promise.all(promises);

            if (results.filter((r) => r === 'SUCCESS').length > 0) {
                // Give the backend time to index the uploaded file before refetching.
                await delay(FILES_REFETCH_DELAY_MS);
                await invalidateFiles();
            }

            return results;
        },
        [projectId, agentId, invalidateFiles],
    );

    const removeFile = useCallback(
        async (fileId: string) => {
            if (!projectId) return;
            await appMediaApi.deleteFile(fileId);
            await delay(FILES_REFETCH_DELAY_MS);
            await invalidateFiles();
        },
        [projectId, invalidateFiles],
    );

    return {
        setInstructions,
        setDescription,
        addMember,
        changeMemberRole,
        removeMember,
        uploadFiles,
        removeFile,
    };
}
