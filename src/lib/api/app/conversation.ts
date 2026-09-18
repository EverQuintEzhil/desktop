import { isAxiosError, type AxiosResponse } from 'axios';

import type { PagedList, RawPagedList } from '@/types/api-types';
import { makeSafeDownloadFilename } from '@/utils/download-filename';

import { uiAxios } from '../../axios';
import { apiClient, type ApiRequestConfig } from '../client';
import { mapPagedList } from '../mappers';

const CONVERSATIONS_PATH = '/conversations';

/** Page size for the conversation message thread — fetched newest-first and paged upward on scroll. */
export const CONVERSATION_MESSAGES_PAGE_SIZE = 100;

export interface ConversationMessagesList<T> extends PagedList<T> {
    headId?: string | null;
}

export type ConversationExportFormat = 'markdown' | 'json' | 'pdf' | 'docx';

export interface ConversationExportParams {
    conversationId: string;
    agentId: string;
    format: ConversationExportFormat;
    /** Names the file when the response carries no `content-disposition`. */
    title?: string;
}

const EXPORT_FILE_EXTENSIONS: Record<ConversationExportFormat, string> = {
    markdown: 'md',
    json: 'json',
    pdf: 'pdf',
    docx: 'docx',
};

const EXPORT_ERROR_FALLBACK = 'The export could not be generated. Please try again.';

export const appConversationApi = {
    async getConversation<T = unknown>(
        conversationId: string,
        params: Record<string, unknown> = {},
        config?: ApiRequestConfig,
    ): Promise<T> {
        return apiClient.get<T>(`${CONVERSATIONS_PATH}/${conversationId}`, { ...config, params });
    },

    async getConversationMessages<T = unknown>(
        conversationId: string,
        params: Record<string, unknown> = {},
        config?: ApiRequestConfig,
    ): Promise<ConversationMessagesList<T>> {
        const raw = await apiClient.get<RawPagedList<T> & { head_id?: string | null }>(
            `${CONVERSATIONS_PATH}/${conversationId}/messages`,
            { ...config, params },
        );

        return {
            ...mapPagedList(raw),
            ...(raw.head_id !== undefined && { headId: raw.head_id }),
        };
    },

    async getAdminConversationMessages<T = unknown>(
        conversationId: string,
        params: Record<string, unknown> = {},
        config?: ApiRequestConfig,
    ): Promise<ConversationMessagesList<T>> {
        const raw = await apiClient.get<RawPagedList<T> & { head_id?: string | null }>(
            `${CONVERSATIONS_PATH}/${conversationId}/messages/admin`,
            { ...config, params },
        );

        return {
            ...mapPagedList(raw),
            ...(raw.head_id !== undefined && { headId: raw.head_id }),
        };
    },

    async listConversations<T = unknown>(
        params: Record<string, unknown> = {},
        config?: ApiRequestConfig,
    ): Promise<PagedList<T>> {
        const raw = await apiClient.get<RawPagedList<T>>(CONVERSATIONS_PATH, { ...config, params });

        return mapPagedList(raw);
    },

    async listConversationsNew<T = unknown, D = Record<string, unknown>>(
        agentId: string,
        data: D,
        config?: ApiRequestConfig,
    ): Promise<PagedList<T>> {
        const raw = await apiClient.post<RawPagedList<T>, D>(`/agents/${agentId}/conversations/search`, data, config);

        return mapPagedList(raw);
    },

    async deleteConversation(
        conversationId: string,
        params: Record<string, unknown> = {},
        config?: ApiRequestConfig,
    ): Promise<unknown> {
        return apiClient.delete<unknown>(`${CONVERSATIONS_PATH}/${conversationId}`, { ...config, params });
    },

    async deleteAllConversations<D = unknown>(
        data: D,
        params: Record<string, unknown> = {},
        config?: ApiRequestConfig,
    ): Promise<unknown> {
        return apiClient.delete<unknown>(CONVERSATIONS_PATH, { ...config, data, params });
    },

    async updateConversation<T = unknown, D = unknown>(
        conversationId: string,
        data: D,
        params: Record<string, unknown> = {},
        config?: ApiRequestConfig,
    ): Promise<T> {
        return apiClient.put<T, D>(`${CONVERSATIONS_PATH}/${conversationId}`, data, { ...config, params });
    },

    async toggleConversationFavorite<T = unknown>(
        conversationId: string,
        params: Record<string, unknown> = {},
        config?: ApiRequestConfig,
    ): Promise<T> {
        return apiClient.put<T>(`${CONVERSATIONS_PATH}/${conversationId}/favorite`, undefined, { ...config, params });
    },

    async updateMessage<T = unknown, D = unknown>(
        conversationId: string,
        messageId: string,
        data: D,
        params: Record<string, unknown> = {},
        config?: ApiRequestConfig,
    ): Promise<T> {
        return apiClient.put<T, D>(`${CONVERSATIONS_PATH}/${conversationId}/messages/${messageId}`, data, {
            ...config,
            params,
        });
    },

    async branchConversation<T = unknown>(
        conversationId: string,
        messageId: string,
        params: Record<string, unknown> = {},
        config?: ApiRequestConfig,
    ): Promise<T> {
        return apiClient.post<T>(`${CONVERSATIONS_PATH}/${conversationId}/messages/${messageId}/branch`, undefined, {
            ...config,
            params,
        });
    },

    /** Requests the file from `/conversations/:id/export` and triggers a browser download. */
    async exportConversation(params: ConversationExportParams): Promise<void> {
        const { conversationId, agentId, format, title } = params;

        const response = await uiAxios.get<Blob>(`${CONVERSATIONS_PATH}/${conversationId}/export`, {
            params: { format, agentId },
            responseType: 'blob',
        });

        const failure = await exportFailureMessage(response);

        if (failure) throw new Error(failure);

        downloadBlob(response.data, exportFilename(response, format, title));
    },
};

/**
 * A rejected request still answers 200 with a `{ success: false }` envelope on
 * this host, which `responseType: 'blob'` hands back as a file — so the envelope
 * has to be opened before anything is saved to disk.
 */
async function exportFailureMessage(response: AxiosResponse<Blob>): Promise<string | null> {
    const contentType = String(response.headers['content-type'] ?? '').toLowerCase();

    if (!contentType.includes('application/json')) return null;

    const envelope = await parseBlobJson(response.data);

    if (envelope?.success === false) {
        return envelope.message?.trim() || EXPORT_ERROR_FALLBACK;
    }

    return null;
}

async function parseBlobJson(data: unknown): Promise<{ success?: boolean; message?: string } | null> {
    if (!(data instanceof Blob)) return null;

    try {
        const parsed: unknown = JSON.parse(await data.text());

        if (parsed && typeof parsed === 'object') {
            return parsed as { success?: boolean; message?: string };
        }
    } catch {
        // Not an envelope — the body is the exported file itself.
    }

    return null;
}

function exportFilename(response: AxiosResponse<Blob>, format: ConversationExportFormat, title?: string): string {
    const disposition = String(response.headers['content-disposition'] ?? '');
    const serverFilename = /filename="?([^";]+)"?/.exec(disposition)?.[1]?.trim();

    if (serverFilename) return serverFilename;

    return makeSafeDownloadFilename(title, {
        extension: EXPORT_FILE_EXTENSIONS[format],
        fallbackBaseName: 'conversation',
    });
}

function downloadBlob(data: Blob, filename: string): void {
    const url = URL.createObjectURL(data);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

/** Blob error responses hide the JSON envelope — dig the message out for display. */
export async function getConversationExportErrorMessage(error: unknown): Promise<string> {
    if (isAxiosError(error)) {
        const envelope = await parseBlobJson(error.response?.data);

        return envelope?.message?.trim() || EXPORT_ERROR_FALLBACK;
    }

    if (error instanceof Error && error.message) {
        return error.message;
    }

    return EXPORT_ERROR_FALLBACK;
}
