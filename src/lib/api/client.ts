import type { AxiosRequestConfig, AxiosResponse } from 'axios';

import type { ApiResponse } from '@/types/api-types';

import { uiAxios } from '../axios';

export interface ApiRequestConfig<D = unknown> extends AxiosRequestConfig<D> {
    skipAuthRedirect?: boolean;
}

function assertApiSuccess<T>(response: AxiosResponse<ApiResponse<T>>): T {
    const payload = response.data;

    if (!payload.success) {
        const msg = payload.message ?? 'API request failed';
        const err = new Error(msg) as Error & { response?: AxiosResponse<ApiResponse<T>> };

        err.response = response;

        throw err;
    }

    return payload.value;
}

/** Typed client for JSON responses shaped as `{ success, value }` on the main API host (inbox-ledger style). */
export const apiClient = {
    async get<T>(url: string, config?: ApiRequestConfig): Promise<T> {
        const response = await uiAxios.get<ApiResponse<T>>(url, config);

        return assertApiSuccess(response);
    },

    async post<T, D = unknown>(url: string, data?: D, config?: ApiRequestConfig): Promise<T> {
        const response = await uiAxios.post<ApiResponse<T>>(url, data, config);

        return assertApiSuccess(response);
    },

    async put<T, D = unknown>(url: string, data?: D, config?: ApiRequestConfig): Promise<T> {
        const response = await uiAxios.put<ApiResponse<T>>(url, data, config);

        return assertApiSuccess(response);
    },

    async patch<T, D = unknown>(url: string, data?: D, config?: ApiRequestConfig): Promise<T> {
        const response = await uiAxios.patch<ApiResponse<T>>(url, data, config);

        return assertApiSuccess(response);
    },

    async delete<T>(url: string, config?: ApiRequestConfig): Promise<T> {
        const response = await uiAxios.delete<ApiResponse<T>>(url, config);

        return assertApiSuccess(response);
    },
};
