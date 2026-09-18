import qs from 'qs';

import type { DataStoreCollection, DataStoreType, ToolType } from '@/types/admin';
import type { PagedList, RawPagedList } from '@/types/api-types';

import { apiClient, type ApiRequestConfig } from '../../client';
import { filesApi, type FileUploadResult } from '../../files-client';
import { mapPagedList } from '../../mappers';

import type {
    DataStoreFileRecord,
    WeblinkSpec,
    WizardConnectionSecretVerifyResult,
    WizardExploreResult,
    WizardFieldsResult,
    WizardTemplate,
} from './types';

export const adminDataStoresApi = {
    async list(
        params: { page?: number; size?: number; search?: string; sortBy?: string[]; provider?: string } = {},
        config?: ApiRequestConfig,
    ): Promise<PagedList<DataStoreType>> {
        const raw = await apiClient.get<RawPagedList<DataStoreType>>('/datastores', {
            params,
            paramsSerializer: (p) => qs.stringify(p, { arrayFormat: 'repeat' }),
            ...config,
        });

        return mapPagedList(raw);
    },

    async getById(id: string, config?: ApiRequestConfig): Promise<DataStoreType> {
        return apiClient.get<DataStoreType>(`/datastores/${id}`, config);
    },

    async create(data: object, config?: ApiRequestConfig): Promise<DataStoreType> {
        return apiClient.post<DataStoreType>('/datastores', data, config);
    },

    async update(id: string, data: object, config?: ApiRequestConfig): Promise<DataStoreType> {
        return apiClient.put<DataStoreType>(`/datastores/${id}`, data, config);
    },

    async delete(id: string, config?: ApiRequestConfig): Promise<unknown> {
        return apiClient.delete<unknown>(`/datastores/${id}`, config);
    },

    async wizardCreate(data: object, config?: ApiRequestConfig): Promise<DataStoreType> {
        return apiClient.post<DataStoreType>('/datastores/wizard', data, config);
    },

    async wizardGetFields(id: string): Promise<WizardFieldsResult> {
        return apiClient.get<WizardFieldsResult>(`/datastores/wizard/${id}/fields`);
    },

    async wizardSaveFields(id: string, data: object): Promise<unknown> {
        return apiClient.put(`/datastores/wizard/${id}/fields`, data);
    },

    async wizardGetConnection(id: string): Promise<unknown> {
        return apiClient.get(`/datastores/wizard/${id}/connection`);
    },

    async wizardSaveConnection(id: string, data: object): Promise<DataStoreType> {
        return apiClient.put<DataStoreType>(`/datastores/wizard/${id}/connection`, data);
    },

    async wizardSendConnectionSecretOtp(id: string): Promise<unknown> {
        return apiClient.post(`/datastores/wizard/${id}/secret/otp`, undefined, { skipAuthRedirect: true });
    },

    async wizardVerifyConnectionSecretOtp(id: string, otp: string): Promise<WizardConnectionSecretVerifyResult> {
        return apiClient.post<WizardConnectionSecretVerifyResult>(
            `/datastores/wizard/${id}/secret/verify`,
            { otp },
            { skipAuthRedirect: true },
        );
    },

    async wizardGetConnectionSecret(id: string): Promise<unknown> {
        return apiClient.get(`/datastores/wizard/${id}/secret/`, {
            skipAuthRedirect: true,
        });
    },

    async wizardGetTemplates(id: string): Promise<WizardTemplate[]> {
        return apiClient.get<WizardTemplate[]>(`/datastores/wizard/${id}/templates`);
    },

    async wizardSaveTemplates(id: string, data: object): Promise<unknown> {
        return apiClient.put(`/datastores/wizard/${id}/templates`, data);
    },

    async wizardGetTools(id: string): Promise<unknown> {
        return apiClient.get(`/datastores/wizard/${id}/tools`);
    },

    async wizardSaveTools(id: string, data: object): Promise<DataStoreType> {
        return apiClient.post<DataStoreType>(`/datastores/wizard/${id}/tools`, data);
    },

    async wizardSaveEmbeddingConfig(id: string, data: object): Promise<DataStoreType> {
        return apiClient.put<DataStoreType>(`/datastores/wizard/${id}/embedding-config`, data);
    },

    async wizardGetEmbeddingJob(id: string): Promise<unknown> {
        return apiClient.get(`/datastores/wizard/${id}/embedding-job`);
    },

    async wizardStartEmbeddingJob(id: string): Promise<unknown> {
        return apiClient.post(`/datastores/wizard/${id}/embedding-job`);
    },

    async wizardDeleteEmbeddingJob(id: string): Promise<unknown> {
        return apiClient.delete(`/datastores/wizard/${id}/embedding-job`);
    },

    async wizardGetEmbeddingJobRuns<T = unknown>(
        id: string,
        params?: { page?: number; size?: number; sortBy?: string[] },
        config?: ApiRequestConfig,
    ): Promise<RawPagedList<T>> {
        return apiClient.get<RawPagedList<T>>(`/datastores/wizard/${id}/embedding-job/runs`, {
            params,
            paramsSerializer: (p) => qs.stringify(p, { arrayFormat: 'repeat' }),
            ...config,
        });
    },

    async wizardGetExplore(id: string): Promise<WizardExploreResult> {
        return apiClient.get<WizardExploreResult>(`/datastores/wizard/${id}/explore`);
    },

    async wizardExplore(id: string, data: object): Promise<WizardExploreResult> {
        return apiClient.post<WizardExploreResult>(`/datastores/wizard/${id}/explore`, data);
    },

    async wizardSaveCron(id: string, data: object): Promise<DataStoreType> {
        return apiClient.put<DataStoreType>(`/datastores/wizard/${id}/cron`, data);
    },

    async wizardSaveWeblinks(id: string, data: { links: WeblinkSpec[] }): Promise<DataStoreType> {
        return apiClient.put<DataStoreType>(`/datastores/wizard/${id}/weblinks`, data);
    },

    async regenerateOkf(id: string, config?: ApiRequestConfig): Promise<unknown> {
        return apiClient.post(`/datastores/wizard/${id}/okf/regenerate`, undefined, config);
    },

    async wizardListCollections(
        wizardId: string,
        params: { page?: number; size?: number; search?: string },
        connection: object,
        config?: ApiRequestConfig,
    ): Promise<PagedList<DataStoreCollection>> {
        const raw = await apiClient.post<RawPagedList<DataStoreCollection>>(
            `/datastores/wizard/${wizardId}/collections`,
            { connection },
            {
                ...config,
                params,
                paramsSerializer: (p) => qs.stringify(p, { arrayFormat: 'repeat' }),
            },
        );

        return mapPagedList(raw);
    },

    async listCollections(
        params: { page?: number; size?: number; search?: string },
        data: { provider: string; connection: object },
        config?: ApiRequestConfig,
    ): Promise<PagedList<DataStoreCollection>> {
        const raw = await apiClient.post<RawPagedList<DataStoreCollection>>('/datastores/collections', data, {
            ...config,
            params,
            paramsSerializer: (p) => qs.stringify(p, { arrayFormat: 'repeat' }),
        });

        return mapPagedList(raw);
    },

    async createTool(data: object, config?: ApiRequestConfig): Promise<ToolType> {
        return apiClient.post<ToolType>('/tools', data, config);
    },

    async wizardListFiles(
        id: string,
        params?: { page?: number; size?: number },
        config?: ApiRequestConfig,
    ): Promise<{
        values: DataStoreFileRecord[];
        page_info?: { page?: number; size?: number; total_pages?: number; total_count?: number };
    }> {
        const result = await apiClient.post<{
            page_info?: { page?: number; size?: number; total_pages?: number; total_count?: number };
            values?: DataStoreFileRecord[];
        }>(`/datastores/wizard/${id}/explore`, { page: params?.page ?? 0, size: params?.size ?? 10 }, config);

        return { values: result.values ?? [], page_info: result.page_info };
    },

    async wizardUploadFile(id: string, formData: FormData, config?: ApiRequestConfig): Promise<DataStoreFileRecord> {
        return apiClient.put<DataStoreFileRecord>(`/datastores/wizard/${id}/files`, formData, config);
    },

    async wizardDeleteFiles(id: string, fileIds: string[], config?: ApiRequestConfig): Promise<unknown> {
        return apiClient.put<unknown>(`/datastores/wizard/${id}/files`, { deleteFileIds: fileIds }, config);
    },

    async wizardRemoveFiles(id: string, fileIds: string[], config?: ApiRequestConfig): Promise<unknown> {
        return apiClient.put<unknown>(`/datastores/wizard/${id}/files`, { removeFileIds: fileIds }, config);
    },

    async wizardAddFileIds(id: string, fileIds: string[], config?: ApiRequestConfig): Promise<DataStoreFileRecord[]> {
        return apiClient.put<DataStoreFileRecord[]>(`/datastores/wizard/${id}/files`, { addFileIds: fileIds }, config);
    },

    async wizardUploadAllFiles(formData: FormData, config?: ApiRequestConfig): Promise<FileUploadResult[]> {
        const response = await filesApi.upload(formData, config);

        return response.data?.value?.values ?? [];
    },
};
