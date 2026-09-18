import { isAxiosError } from 'axios';

import { uiAxios } from '../../axios';

export const USAGE_REPORT_SOURCES = [
    { value: 'chat', label: 'Agent chats' },
    { value: 'incognito', label: 'Incognito chats' },
    { value: 'builder', label: 'Agent Builder chats' },
    { value: 'title', label: 'Conversation title generation' },
    { value: 'image', label: 'Image generation' },
    { value: 'video', label: 'Video generation' },
] as const;

export type UsageReportSource = (typeof USAGE_REPORT_SOURCES)[number]['value'];

export interface UsageReportParams {
    /** Period start, "YYYY-MM-DD", inclusive. */
    from: string;
    /** Period end, "YYYY-MM-DD", exclusive. */
    to: string;
    group_by?: Array<'agent' | 'user'>;
    interval?: 'day' | 'week' | 'month';
    sources?: UsageReportSource[];
}

/** Requests the CSV from the reports service and triggers a browser download. */
export async function downloadUsageReport(params: UsageReportParams): Promise<void> {
    const response = await uiAxios.post<Blob>('/reports/usage/export', params, { responseType: 'blob' });

    const disposition = String(response.headers['content-disposition'] ?? '');
    const filename = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? `usage_${params.from}_${params.to}.csv`;

    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

/** Blob error responses hide the JSON envelope — dig the message out for display. */
export async function usageReportErrorMessage(error: unknown): Promise<string> {
    if (isAxiosError(error) && error.response?.data instanceof Blob) {
        try {
            const parsed: unknown = JSON.parse(await error.response.data.text());

            if (parsed && typeof parsed === 'object' && 'message' in parsed && typeof parsed.message === 'string') {
                return parsed.message;
            }
        } catch {
            // fall through to the generic message
        }
    }

    return 'The report could not be generated. Please try again.';
}
