import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { apiUrl, envelope, failureEnvelope, httpError, respond, server } from '@/test/msw';

import { tablePreferencesApi, type TablePreference } from './table-preferences';

const TABLE_KEY = 'admin:users-table';
/** The colon is percent-encoded on the wire; express decodes it back before matching. */
const LAYOUT_PATH = '/users/me/tablepreferences/admin%3Ausers-table';

const preference: TablePreference = {
    tableKey: TABLE_KEY,
    layout: { order: ['email', 'name'], widths: { email: 320 } },
};

describe('tablePreferencesApi.get', () => {
    it('unwraps the envelope and returns the stored layout', async () => {
        server.use(respond('get', LAYOUT_PATH, () => envelope(preference)));

        expect(await tablePreferencesApi.get(TABLE_KEY)).toEqual(preference.layout);
    });

    it('returns null when the user has never customised the table', async () => {
        server.use(respond('get', LAYOUT_PATH, () => envelope(null)));

        expect(await tablePreferencesApi.get(TABLE_KEY)).toBeNull();
    });

    it('percent-encodes the table key rather than splitting the path on its colon', async () => {
        let requestUrl = '';

        server.use(
            http.get(apiUrl(LAYOUT_PATH), ({ request }) => {
                requestUrl = request.url;

                return envelope(null);
            }),
        );

        await tablePreferencesApi.get(TABLE_KEY);

        expect(requestUrl).toContain('/users/me/tablepreferences/admin%3Ausers-table');
    });

    it('rejects a key the API would reject, without issuing a request', async () => {
        let called = false;

        server.use(
            http.get(apiUrl('/users/me/tablepreferences/*'), () => {
                called = true;

                return envelope(null);
            }),
        );

        await expect(tablePreferencesApi.get('admin table!')).rejects.toThrow(/Invalid table layout key/);
        expect(called).toBe(false);
    });

    it('surfaces a failure envelope as an error', async () => {
        server.use(respond('get', LAYOUT_PATH, () => failureEnvelope('Nope')));

        await expect(tablePreferencesApi.get(TABLE_KEY)).rejects.toThrow('Nope');
    });
});

describe('tablePreferencesApi.save', () => {
    it('puts the layout as the request body and returns the stored result', async () => {
        let body: unknown;

        server.use(
            http.put(apiUrl(LAYOUT_PATH), async ({ request }) => {
                body = await request.json();

                return envelope(preference);
            }),
        );

        const result = await tablePreferencesApi.save(TABLE_KEY, { order: ['email', 'name'] });

        expect(body).toEqual({ order: ['email', 'name'] });
        expect(result).toEqual(preference.layout);
    });

    it('falls back to the sent layout when the API answers without one', async () => {
        server.use(respond('put', LAYOUT_PATH, () => envelope(null)));

        expect(await tablePreferencesApi.save(TABLE_KEY, { widths: { email: 200 } })).toEqual({
            widths: { email: 200 },
        });
    });
});

describe('tablePreferencesApi.remove', () => {
    it('deletes the row', async () => {
        let called = false;

        server.use(
            http.delete(apiUrl(LAYOUT_PATH), () => {
                called = true;

                return envelope(null);
            }),
        );

        await tablePreferencesApi.remove(TABLE_KEY);

        expect(called).toBe(true);
    });

    it('surfaces an HTTP error', async () => {
        server.use(respond('delete', LAYOUT_PATH, () => httpError(500)));

        await expect(tablePreferencesApi.remove(TABLE_KEY)).rejects.toThrow();
    });
});

describe('tablePreferencesApi.removeThenSave', () => {
    it('deletes before putting, so the API cannot merge the old widths back in', async () => {
        const calls: string[] = [];

        server.use(
            http.delete(apiUrl(LAYOUT_PATH), () => {
                calls.push('delete');

                return envelope(null);
            }),
            http.put(apiUrl(LAYOUT_PATH), () => {
                calls.push('put');

                return envelope(preference);
            }),
        );

        await tablePreferencesApi.removeThenSave(TABLE_KEY, { order: ['email', 'name'] });

        expect(calls).toEqual(['delete', 'put']);
    });

    it('does not put when the delete fails', async () => {
        const calls: string[] = [];

        server.use(
            http.delete(apiUrl(LAYOUT_PATH), () => httpError(500)),
            http.put(apiUrl(LAYOUT_PATH), () => {
                calls.push('put');

                return envelope(preference);
            }),
        );

        await expect(tablePreferencesApi.removeThenSave(TABLE_KEY, { order: ['email'] })).rejects.toThrow();
        expect(calls).toEqual([]);
    });

    it('works when called as a bare reference, not only off the object', async () => {
        server.use(
            respond('delete', LAYOUT_PATH, () => envelope(null)),
            respond('put', LAYOUT_PATH, () => envelope(preference)),
        );

        const { removeThenSave } = tablePreferencesApi;

        expect(await removeThenSave(TABLE_KEY, { order: ['email', 'name'] })).toEqual(preference.layout);
    });
});
