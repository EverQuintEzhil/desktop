import type { AxiosRequestConfig, AxiosResponse } from 'axios';

import { filesHttp } from '../axios';

export interface FileUploadResult {
    _id: string;
    name?: string;
    url: string;
    location?: string;
    size?: number;
    mimeType?: string;
}

export interface FilesApiUploadResponse {
    success: boolean;
    /** Present on a refusal — a rejected mime type, a file over the size cap. */
    message?: string;
    value: {
        values: FileUploadResult[];
    } | null;
}

/**
 * Files service (`files.` host) — uploads and binary traffic.
 * Use `filesApi.upload(...)` instead of calling `filesHttp` directly from screens.
 */
export const filesApi = {
    upload(formData: FormData, config?: AxiosRequestConfig): Promise<AxiosResponse<FilesApiUploadResponse>> {
        return filesHttp.post<FilesApiUploadResponse>('/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            ...config,
        });
    },
};
