import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { apiUrl, envelope, httpError, pagedEnvelope, respond, server } from '@/test/msw';

import { appAgentsApi } from './agents';

interface TestLauncher {
    _id: string;
    name: string;
}

const launcher: TestLauncher = { _id: 'launcher-1', name: 'Research Assistant' };

describe('appAgentsApi.listLaunchers', () => {
    it('unwraps the success envelope and maps page_info to pageInfo', async () => {
        server.use(
            respond('get', '/launchers', () => pagedEnvelope([launcher], { page: 1, totalPages: 3, totalCount: 47 })),
        );

        const result = await appAgentsApi.listLaunchers<TestLauncher>();

        expect(result.values).toEqual([launcher]);
        expect(result.pageInfo).toEqual({ page: 1, totalPages: 3, totalCount: 47 });
    });

    it('omits params that were not provided', async () => {
        let requestUrl = '';

        server.use(
            http.get(apiUrl('/launchers'), ({ request }) => {
                requestUrl = request.url;

                return pagedEnvelope([launcher]);
            }),
        );

        await appAgentsApi.listLaunchers<TestLauncher>({ size: 20, page: 0 });

        const params = new URL(requestUrl).searchParams;

        expect(params.get('size')).toBe('20');
        expect(params.get('page')).toBe('0');
        expect(params.get('search')).toBeNull();
        expect(params.get('tags')).toBeNull();
    });

    it('throws with the API message when success is false', async () => {
        server.use(
            respond(
                'get',
                '/launchers',
                () =>
                    new Response(JSON.stringify({ success: false, message: 'Launchers unavailable', value: null }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    }),
            ),
        );

        await expect(appAgentsApi.listLaunchers()).rejects.toThrow('Launchers unavailable');
    });

    it('rejects on a non-2xx response', async () => {
        server.use(respond('get', '/launchers', () => httpError(500)));

        await expect(appAgentsApi.listLaunchers()).rejects.toThrow();
    });
});

describe('appAgentsApi.listAgents', () => {
    it('maps page_info and forwards mineOnly', async () => {
        let requestUrl = '';

        server.use(
            http.get(apiUrl('/agents'), ({ request }) => {
                requestUrl = request.url;

                return pagedEnvelope([launcher], { page: 0, totalPages: 2, totalCount: 25 });
            }),
        );

        const result = await appAgentsApi.listAgents<TestLauncher>({ mineOnly: true, size: 20, page: 0 });

        expect(result.pageInfo).toEqual({ page: 0, totalPages: 2, totalCount: 25 });
        expect(new URL(requestUrl).searchParams.get('mineOnly')).toBe('true');
    });
});

describe('appAgentsApi.listTags', () => {
    it('returns the unwrapped values object without paged mapping', async () => {
        server.use(respond('get', '/tags', () => envelope({ values: [{ _id: 'tag-1', name: 'Design' }] })));

        const result = await appAgentsApi.listTags<{ _id: string; name: string }>();

        expect(result.values).toEqual([{ _id: 'tag-1', name: 'Design' }]);
    });

    it('rejects on a non-2xx response', async () => {
        server.use(respond('get', '/tags', () => httpError(503)));

        await expect(appAgentsApi.listTags()).rejects.toThrow();
    });
});
