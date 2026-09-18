import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { apiUrl, envelope, httpError, respond, server } from '@/test/msw';

import { appBlogApi } from './blog';

interface TestPost {
    _id: string;
    title: string;
}

const post: TestPost = { _id: 'post-1', title: 'Release notes' };

describe('appBlogApi.getBlogPost', () => {
    it('unwraps the success envelope', async () => {
        server.use(respond('get', '/blogposts/post-1', () => envelope(post)));

        await expect(appBlogApi.getBlogPost<TestPost>('post-1')).resolves.toEqual(post);
    });

    it('puts the identifier in the request path', async () => {
        let requestUrl = '';

        server.use(
            http.get(apiUrl('/blogposts/:blogPostId'), ({ request }) => {
                requestUrl = request.url;

                return envelope(post);
            }),
        );

        await appBlogApi.getBlogPost<TestPost>('announcing-fluent-mind-v2');

        expect(new URL(requestUrl).pathname).toBe('/blogposts/announcing-fluent-mind-v2');
    });

    it('throws with the API message when success is false', async () => {
        server.use(
            respond(
                'get',
                '/blogposts/post-1',
                () =>
                    new Response(JSON.stringify({ success: false, message: 'Blog post not published', value: null }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    }),
            ),
        );

        await expect(appBlogApi.getBlogPost('post-1')).rejects.toThrow('Blog post not published');
    });

    it('rejects on a 404', async () => {
        server.use(respond('get', '/blogposts/missing', () => httpError(404, 'Not found')));

        await expect(appBlogApi.getBlogPost('missing')).rejects.toThrow();
    });
});
