import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { apiUrl, pagedEnvelope, respond, server } from '@/test/msw';

import { appTagsApi } from './tags';

const category = { _id: 'tag-1', name: 'Getting started', postCount: 12 };

describe('appTagsApi.listBlogCategories', () => {
    it('unwraps the success envelope and maps page_info to pageInfo', async () => {
        server.use(respond('get', '/tags', () => pagedEnvelope([category], { page: 0, totalPages: 1, totalCount: 1 })));

        const result = await appTagsApi.listBlogCategories();

        expect(result.values).toEqual([category]);
        expect(result.pageInfo).toEqual({ page: 0, totalPages: 1, totalCount: 1 });
    });

    it('always asks for the blogpost bucket in sortOrder, non-empty only', async () => {
        let requestUrl = '';

        server.use(
            http.get(apiUrl('/tags'), ({ request }) => {
                requestUrl = request.url;

                return pagedEnvelope([category]);
            }),
        );

        await appTagsApi.listBlogCategories({ search: 'start', page: 1, size: 20 });

        const params = new URL(requestUrl).searchParams;

        expect(params.get('tagFor')).toBe('blogpost');
        expect(params.get('hasPosts')).toBe('true');
        expect(params.get('sortBy')).toBe('sortOrder:asc');
        expect(params.get('search')).toBe('start');
        expect(params.get('page')).toBe('1');
        expect(params.get('size')).toBe('20');
    });

    it('omits an absent search rather than sending it empty', async () => {
        let requestUrl = '';

        server.use(
            http.get(apiUrl('/tags'), ({ request }) => {
                requestUrl = request.url;

                return pagedEnvelope([]);
            }),
        );

        await appTagsApi.listBlogCategories();

        expect(new URL(requestUrl).searchParams.has('search')).toBe(false);
    });

    it('throws with the API message when success is false', async () => {
        server.use(
            respond(
                'get',
                '/tags',
                () =>
                    new Response(JSON.stringify({ success: false, message: 'Tag service down', value: null }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    }),
            ),
        );

        await expect(appTagsApi.listBlogCategories()).rejects.toThrow('Tag service down');
    });
});
