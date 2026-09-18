import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { apiUrl, envelope, rawPaged, server } from '@/test/msw';

import { adminAboutApi } from './about';

interface Row {
    key: string;
}

const rows: Row[] = Array.from({ length: 250 }, (_, index) => ({ key: `key-${index + 1}` }));

const servePagedAbouts = (requestedSizes: number[]) => {
    server.use(
        http.get(apiUrl('/abouts'), ({ request }) => {
            const url = new URL(request.url);
            const page = Number(url.searchParams.get('page') ?? 0);
            const size = Number(url.searchParams.get('size') ?? rows.length);

            requestedSizes.push(size);

            return envelope(
                rawPaged(rows.slice(page * size, page * size + size), {
                    page,
                    totalPages: Math.ceil(rows.length / size),
                    totalCount: rows.length,
                }),
            );
        }),
    );
};

describe('adminAboutApi.listAll', () => {
    it('pages until every row the API reports has been fetched', async () => {
        const requestedSizes: number[] = [];

        servePagedAbouts(requestedSizes);

        const values = await adminAboutApi.listAll<Row>();

        expect(values).toHaveLength(rows.length);
        expect(values.at(-1)).toEqual({ key: 'key-250' });
        expect(requestedSizes.length).toBeGreaterThan(1);
    });

    it('finds a key that sits beyond the first page', async () => {
        servePagedAbouts([]);

        await expect(adminAboutApi.getByKey<Row>('key-250')).resolves.toEqual({ key: 'key-250' });
    });

    it('stops when a page comes back empty', async () => {
        let requestCount = 0;

        server.use(
            http.get(apiUrl('/abouts'), () => {
                requestCount += 1;

                return envelope(rawPaged<Row>([], { page: 0, totalPages: 9, totalCount: 900 }));
            }),
        );

        await expect(adminAboutApi.listAll<Row>()).resolves.toEqual([]);
        expect(requestCount).toBe(1);
    });

    it('surfaces a failed page instead of returning a partial list', async () => {
        server.use(
            http.get(apiUrl('/abouts'), () => HttpResponse.json({ success: false, message: 'boom' }, { status: 500 })),
        );

        await expect(adminAboutApi.listAll<Row>()).rejects.toThrow();
    });
});
