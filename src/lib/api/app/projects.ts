import type { PagedList, RawPagedList } from '@/types/api-types';

import { apiClient, type ApiRequestConfig } from '../client';
import { mapPagedList } from '../mappers';

const PROJECTS_PATH = '/projects';

export interface CreateProjectPayload {
    name: string;
    agentId: string;
    description?: string;
    instructions?: string;
    adminIds?: string[];
    includeUserIds?: string[];
    excludeUserIds?: string[];
    includeSecurityGroupIds?: string[];
    excludeSecurityGroupIds?: string[];
}

export type UpdateProjectPayload = Partial<Omit<CreateProjectPayload, 'agentId'>> & {
    /** Desktop-only: absolute local folder for space-scoped coding tools; '' clears it. */
    folderPath?: string;
};

export type ProjectMemberRoleInput = 'viewer' | 'editor';

export const appProjectsApi = {
    async listProjects<T = unknown>(
        params: Record<string, unknown> = {},
        config?: ApiRequestConfig,
    ): Promise<PagedList<T>> {
        const raw = await apiClient.get<RawPagedList<T>>(PROJECTS_PATH, { ...config, params });

        return mapPagedList(raw);
    },

    async createProject<T = unknown>(data: CreateProjectPayload, config?: ApiRequestConfig): Promise<T> {
        return apiClient.post<T, CreateProjectPayload>(PROJECTS_PATH, data, config);
    },

    async getProject<T = unknown>(projectId: string, config?: ApiRequestConfig): Promise<T> {
        return apiClient.get<T>(`${PROJECTS_PATH}/${projectId}`, config);
    },

    async updateProject<T = unknown>(
        projectId: string,
        data: UpdateProjectPayload,
        config?: ApiRequestConfig,
    ): Promise<T> {
        return apiClient.put<T, UpdateProjectPayload>(`${PROJECTS_PATH}/${projectId}`, data, config);
    },

    async deleteProject(projectId: string, config?: ApiRequestConfig): Promise<unknown> {
        return apiClient.delete<unknown>(`${PROJECTS_PATH}/${projectId}`, config);
    },

    async pinProject<T = unknown>(projectId: string, config?: ApiRequestConfig): Promise<T> {
        return apiClient.put<T>(`${PROJECTS_PATH}/${projectId}/pin`, undefined, config);
    },

    async listActivities<T = unknown>(
        projectId: string,
        params: Record<string, unknown> = {},
        config?: ApiRequestConfig,
    ): Promise<PagedList<T>> {
        const raw = await apiClient.get<RawPagedList<T>>(`${PROJECTS_PATH}/${projectId}/activities`, {
            ...config,
            params,
        });

        return mapPagedList(raw);
    },

    async listMembers<T = unknown>(projectId: string, config?: ApiRequestConfig): Promise<T> {
        return apiClient.get<T>(`${PROJECTS_PATH}/${projectId}/members`, config);
    },

    async addMember<T = unknown>(
        projectId: string,
        data: { userId: string; role: ProjectMemberRoleInput },
        config?: ApiRequestConfig,
    ): Promise<T> {
        return apiClient.post<T, { userId: string; role: ProjectMemberRoleInput }>(
            `${PROJECTS_PATH}/${projectId}/members`,
            data,
            config,
        );
    },

    async changeMemberRole<T = unknown>(
        projectId: string,
        userId: string,
        data: { role: ProjectMemberRoleInput },
        config?: ApiRequestConfig,
    ): Promise<T> {
        return apiClient.put<T, { role: ProjectMemberRoleInput }>(
            `${PROJECTS_PATH}/${projectId}/members/${userId}`,
            data,
            config,
        );
    },

    async removeMember(projectId: string, userId: string, config?: ApiRequestConfig): Promise<unknown> {
        return apiClient.delete<unknown>(`${PROJECTS_PATH}/${projectId}/members/${userId}`, config);
    },
};
