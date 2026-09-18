import { HttpResponse } from 'msw';

import type { RawPagedList } from '@/types/api-types';

/**
 * Every JSON endpoint on the main API host answers with the
 * `{ success, value }` envelope that `assertApiSuccess` unwraps. These helpers
 * build responses in that shape so tests never hand-write the envelope and the
 * real unwrapping / error-mapping code in `src/lib/api/client.ts` runs for real.
 */
export const envelope = <T>(value: T): Response => HttpResponse.json({ success: true, value });

export const failureEnvelope = (message: string, status = 200): Response =>
    HttpResponse.json({ success: false, message, value: null }, { status });

export const httpError = (status: number, message = 'Request failed'): Response =>
    HttpResponse.json({ success: false, message, value: null }, { status });

interface PagedOptions {
    page?: number;
    totalPages?: number;
    totalCount?: number;
}

/** Snake-cased `page_info` exactly as the API sends it, before `mapPagedList`. */
export const rawPaged = <T>(values: T[], options: PagedOptions = {}): RawPagedList<T> => ({
    values,
    page_info: {
        page: options.page ?? 0,
        total_pages: options.totalPages ?? 1,
        total_count: options.totalCount ?? values.length,
    },
});

export const pagedEnvelope = <T>(values: T[], options?: PagedOptions): Response => envelope(rawPaged(values, options));
