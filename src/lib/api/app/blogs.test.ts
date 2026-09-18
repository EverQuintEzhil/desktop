import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { apiUrl, httpError, pagedEnvelope, respond, server } from '@/test/msw';

import { appBlogsApi } from './blogs';

interface TestPost {
    _id: string;
    title: string;
}

const post: TestPost = { _id: 'post-1', title: 'Release notes' };

describe('appBlogsApi.listBlogPosts', () => {
    it('unwraps the success envelope and maps page_info to pageInfo', async () => {
        server.use(
            respond('get', '/blogposts', () => pagedEnvelope([post], { page: 2, totalPages: 5, totalCount: 91 })),
        );

        const result = await appBlogsApi.listBlogPosts<TestPost>();

        expect(result.values).toEqual([post]);
        expect(result.pageInfo).toEqual({ page: 2, totalPages: 5, totalCount: 91 });
    });

    it('serializes array params in repeat format', async () => {
        let requestUrl = '';

        server.use(
            http.get(apiUrl('/blogposts'), ({ request }) => {
                requestUrl = request.url;

                return pagedEnvelope([post]);
            }),
        );

        await appBlogsApi.listBlogPosts<TestPost>({
            tags: ['tag-1', 'tag-2'],
            types: ['announcement'],
            ids: ['post-1', 'post-2'],
            page: 0,
            size: 20,
        });

        const params = new URL(requestUrl).searchParams;

        expect(params.getAll('tags')).toEqual(['tag-1', 'tag-2']);
        expect(params.getAll('types')).toEqual(['announcement']);
        expect(params.getAll('ids')).toEqual(['post-1', 'post-2']);
        expect(requestUrl).not.toContain('tags%5B');
    });

    it('sends categoryId when a category is given', async () => {
        let requestUrl = '';

        server.use(
            http.get(apiUrl('/blogposts'), ({ request }) => {
                requestUrl = request.url;

                return pagedEnvelope([post]);
            }),
        );

        await appBlogsApi.listBlogPosts<TestPost>({ categoryId: 'tag-1' });

        expect(new URL(requestUrl).searchParams.get('categoryId')).toBe('tag-1');
    });

    it('throws with the API message when success is false', async () => {
        server.use(
            respond(
                'get',
                '/blogposts',
                () =>
                    new Response(JSON.stringify({ success: false, message: 'Blog service unavailable', value: null }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    }),
            ),
        );

        await expect(appBlogsApi.listBlogPosts()).rejects.toThrow('Blog service unavailable');
    });

    it('rejects on a non-2xx response', async () => {
        server.use(respond('get', '/blogposts', () => httpError(500)));

        await expect(appBlogsApi.listBlogPosts()).rejects.toThrow();
    });
});
