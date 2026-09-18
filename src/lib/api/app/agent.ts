import qs from 'qs';

import type { PagedList, RawPagedList } from '@/types/api-types';

import { uiAxios } from '../../axios';
import { apiClient, type ApiRequestConfig } from '../client';
import { mapPagedList } from '../mappers';

export const appAgentApi = {
    async getAgent<T = unknown>(agentId: string, config?: ApiRequestConfig): Promise<T> {
        return apiClient.get<T>(`/agents/${agentId}?launcher=true`, config);
    },

    /** Full agent record. `getAgent` trims `models`, `defaultModelId` and more out of its launcher payload. */
    async getFullAgent<T = unknown>(agentId: string, config?: ApiRequestConfig): Promise<T> {
        return apiClient.get<T>(`/agents/${agentId}`, config);
    },

    async getAdminConversationMessages<T = unknown>(
        agentId: string,
        conversationId: string,
        params: Record<string, unknown> = {},
        config?: ApiRequestConfig,
    ): Promise<PagedList<T>> {
        const raw = await apiClient.get<RawPagedList<T>>(
            `/agents/${agentId}/conversations/${conversationId}/messages`,
            { ...config, params },
        );

        return mapPagedList(raw);
    },

    async deleteAllConversations<D = unknown>(data: D, config?: ApiRequestConfig): Promise<unknown> {
        return apiClient.delete<unknown>('/conversations', { ...config, data });
    },

    async listFiles<T = unknown>(
        params: Record<string, unknown> = {},
        config?: ApiRequestConfig,
    ): Promise<PagedList<T>> {
        const raw = await apiClient.get<RawPagedList<T>>('/files', {
            ...config,
            params,
            paramsSerializer: (p) => qs.stringify(p, { arrayFormat: 'repeat' }),
        });

        return mapPagedList(raw);
    },

    async deleteFile(fileId: string, config?: ApiRequestConfig): Promise<unknown> {
        return apiClient.delete<unknown>(`/files/${fileId}`, config);
    },

    async getFile<T = unknown>(fileId: string, config?: ApiRequestConfig): Promise<T> {
        return apiClient.get<T>(`/files/${fileId}`, config);
    },

    async updateFile<T = unknown, D = unknown>(fileId: string, data: D, config?: ApiRequestConfig): Promise<T> {
        return apiClient.put<T, D>(`/files/${fileId}`, data, config);
    },

    async listPrompts<T = unknown>(
        params: Record<string, unknown> = {},
        config?: ApiRequestConfig,
    ): Promise<PagedList<T>> {
        const raw = await apiClient.get<RawPagedList<T>>('/prompts', {
            ...config,
            params,
            paramsSerializer: (p) => qs.stringify(p, { arrayFormat: 'repeat' }),
        });

        return mapPagedList(raw);
    },

    async createPrompt<T = unknown, D = unknown>(data: D, config?: ApiRequestConfig): Promise<T> {
        return apiClient.post<T, D>('/prompts', data, config);
    },

    async updatePrompt<T = unknown, D = unknown>(promptId: string, data: D, config?: ApiRequestConfig): Promise<T> {
        return apiClient.put<T, D>(`/prompts/${promptId}`, data, config);
    },

    async getPrompt<T = unknown>(promptId: string, config?: ApiRequestConfig): Promise<T> {
        return apiClient.get<T>(`/prompts/${promptId}`, config);
    },

    async executeChat<T = unknown, D = unknown>(data: D, config?: ApiRequestConfig): Promise<T> {
        const response = await uiAxios.post<T>('/ai/chat', data, config);

        return response.data;
    },

    async downloadBlob(url: string, config?: ApiRequestConfig): Promise<Blob> {
        const response = await uiAxios.get<Blob>(url, { ...config, responseType: 'blob' });

        return response.data;
    },
};
