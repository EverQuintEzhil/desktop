import type { PagedList, RawPagedList } from '@/types/api-types';

import { uiAxios } from '../../axios';
import { apiClient, type ApiRequestConfig } from '../client';
import { mapPagedList } from '../mappers';

export const appMediaApi = {
    async listFiles<T = unknown>(
        params: Record<string, unknown> = {},
        config?: ApiRequestConfig,
    ): Promise<PagedList<T>> {
        const raw = await apiClient.get<RawPagedList<T>>('/files', { ...config, params });

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

    async listJobs<T = unknown>(
        params: Record<string, unknown> = {},
        config?: ApiRequestConfig,
    ): Promise<{ values: T[]; pageInfo: { page: number; totalPages: number } }> {
        const raw = await apiClient.get<RawPagedList<T>>('/jobs', { ...config, params });

        return {
            values: raw.values,
            pageInfo: {
                page: raw.page_info.page,
                totalPages: raw.page_info.total_pages,
            },
        };
    },

    async cancelJob(jobId: string, config?: ApiRequestConfig): Promise<unknown> {
        return apiClient.post<unknown>(`/jobs/${jobId}/kill`, undefined, config);
    },

    async requeueJob(jobIds: string[], prompt?: string, config?: ApiRequestConfig): Promise<unknown> {
        const payload = prompt ? { jobIds, prompt } : { jobIds };

        return apiClient.post<unknown>('/ai/job/requeue', payload, config);
    },

    async generateImage<D = unknown>(data: D, config?: ApiRequestConfig): Promise<unknown> {
        return apiClient.post<unknown, D>('/ai/image', data, config);
    },

    async generateVideo<D = unknown>(data: D, config?: ApiRequestConfig): Promise<unknown> {
        return apiClient.post<unknown, D>('/ai/video', data, config);
    },

    async downloadBlob(url: string, config?: ApiRequestConfig): Promise<Blob> {
        const response = await uiAxios.get<Blob>(url, { ...config, responseType: 'blob' });

        return response.data;
    },
};
