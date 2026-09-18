import { isAxiosError } from 'axios';
import qs from 'qs';

import { uiAxios } from '../../axios';

const FALLBACK_MESSAGE = 'The export could not be generated. Please try again.';

/** Blob error responses hide the JSON envelope — dig the message out for display. */
async function messageFromBlob(data: unknown): Promise<string> {
    if (!(data instanceof Blob)) return FALLBACK_MESSAGE;

    try {
        const parsed: unknown = JSON.parse(await data.text());

        if (parsed && typeof parsed === 'object' && 'message' in parsed && typeof parsed.message === 'string') {
            return parsed.message;
        }
    } catch {
        // fall through to the generic message
    }

    return FALLBACK_MESSAGE;
}

export async function getCsvExportErrorMessage(error: unknown): Promise<string> {
    if (isAxiosError(error)) {
        return error.response?.data instanceof Blob ? messageFromBlob(error.response.data) : FALLBACK_MESSAGE;
    }

    if (error instanceof Error && error.message) {
        return error.message;
    }

    return FALLBACK_MESSAGE;
}

/** Saves a successful blob response, or throws the message behind a JSON-flavoured error. */
async function saveOrThrow(
    response: { data: Blob; headers: Record<string, unknown> },
    fallbackFilename: string,
): Promise<void> {
    const contentType = String(response.headers['content-type'] ?? '').toLowerCase();

    if (contentType.includes('application/json')) {
        throw new Error(await messageFromBlob(response.data));
    }

    const disposition = String(response.headers['content-disposition'] ?? '');
    const filename = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? fallbackFilename;

    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

/** Requests a GET CSV export endpoint and triggers a browser download. */
export async function downloadCsvExport(
    path: string,
    params: Record<string, unknown>,
    fallbackFilename: string,
): Promise<void> {
    const response = await uiAxios.get<Blob>(path, {
        params,
        paramsSerializer: (p) => qs.stringify(p, { arrayFormat: 'repeat' }),
        responseType: 'blob',
    });

    await saveOrThrow(response, fallbackFilename);
}

/** Requests a POST CSV export endpoint (JSON body, blob response) and triggers a download. */
export async function downloadCsvExportPost(
    path: string,
    body: Record<string, unknown>,
    fallbackFilename: string,
): Promise<void> {
    const response = await uiAxios.post<Blob>(path, body, {
        headers: { 'Content-Type': 'application/json' },
        responseType: 'blob',
    });

    await saveOrThrow(response, fallbackFilename);
}
