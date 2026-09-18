import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { apiUrl, envelope, pagedEnvelope, respond, server } from '@/test/msw';

import { tagsApi } from './tags';

const tag = { _id: 'tag-1', name: 'Getting started' };

describe('tagsApi.list', () => {
    it('unwraps the success envelope and maps page_info to pageInfo', async () => {
        server.use(respond('get', '/tags', () => pagedEnvelope([tag], { page: 0, totalPages: 1, totalCount: 1 })));

        const result = await tagsApi.list();

        expect(result.values).toEqual([tag]);
        expect(result.pageInfo).toEqual({ page: 0, totalPages: 1, totalCount: 1 });
    });

    it('repeats tagFor and sortBy on the query string', async () => {
        let requestUrl = '';

        server.use(
            http.get(apiUrl('/tags'), ({ request }) => {
                requestUrl = request.url;

                return pagedEnvelope([tag]);
            }),
        );

        await tagsApi.list({ tagFor: 'blogpost', sortBy: 'name:asc', page: 0, size: 20 });

        const params = new URL(requestUrl).searchParams;

        expect(params.get('tagFor')).toBe('blogpost');
        expect(params.get('sortBy')).toBe('name:asc');
        expect(params.get('page')).toBe('0');
        expect(params.get('size')).toBe('20');
    });
});

describe('tagsApi.getById', () => {
    it('unwraps the tag', async () => {
        server.use(respond('get', '/tags/tag-1', () => envelope(tag)));

        await expect(tagsApi.getById('tag-1')).resolves.toEqual(tag);
    });

    it('throws with the API message when success is false', async () => {
        server.use(
            respond(
                'get',
                '/tags/tag-1',
                () =>
                    new Response(JSON.stringify({ success: false, message: 'Tag not found', value: null }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    }),
            ),
        );

        await expect(tagsApi.getById('tag-1')).rejects.toThrow('Tag not found');
    });
});
