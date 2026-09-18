import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { apiUrl, envelope, failureEnvelope, httpError, respond, server } from '@/test/msw';

import { appAgentLayoutApi, type AgentLayoutPayload } from './agent-layout';

const LAYOUT_PATH = '/users/me/agentlayout';

/** Captures the body the `PUT` received, so the exact patch keys can be asserted. */
const capturePutBody = (): { read: () => AgentLayoutPayload | undefined } => {
    let body: AgentLayoutPayload | undefined;

    server.use(
        http.put(apiUrl(LAYOUT_PATH), async ({ request }) => {
            body = (await request.json()) as AgentLayoutPayload;

            return envelope(body);
        }),
    );

    return { read: () => body };
};

describe('appAgentLayoutApi.get', () => {
    it('unwraps the envelope and returns the stored layout', async () => {
        server.use(respond('get', LAYOUT_PATH, () => envelope({ my: ['a'], firm: ['b'] })));

        expect(await appAgentLayoutApi.get()).toEqual({ my: ['a'], firm: ['b'] });
    });

    it('returns null when the user has no stored row', async () => {
        server.use(respond('get', LAYOUT_PATH, () => envelope(null)));

        expect(await appAgentLayoutApi.get()).toBeNull();
    });

    it("keeps a customized tab's key absent when the other tab was never customized", async () => {
        server.use(respond('get', LAYOUT_PATH, () => envelope({ my: ['a'] })));

        const layout = await appAgentLayoutApi.get();

        expect(layout).toEqual({ my: ['a'] });
        expect(layout?.firm).toBeUndefined();
    });

    it('returns an empty list rather than an absent key when the user pinned nothing on purpose', async () => {
        server.use(respond('get', LAYOUT_PATH, () => envelope({ firm: [] })));

        expect(await appAgentLayoutApi.get()).toEqual({ firm: [] });
    });

    it('rejects on a failure envelope', async () => {
        server.use(respond('get', LAYOUT_PATH, () => failureEnvelope('Nope')));

        await expect(appAgentLayoutApi.get()).rejects.toThrow('Nope');
    });

    it('rejects on a non-2xx response', async () => {
        server.use(respond('get', LAYOUT_PATH, () => httpError(500)));

        await expect(appAgentLayoutApi.get()).rejects.toThrow();
    });

    it("rejects when the layout is not the authenticated user's", async () => {
        server.use(
            respond('get', LAYOUT_PATH, () =>
                httpError(403, 'Agent layout is only available for the authenticated user.'),
            ),
        );

        await expect(appAgentLayoutApi.get()).rejects.toThrow();
    });
});

describe('appAgentLayoutApi.save', () => {
    it('sends only the scope being written, because the endpoint merges the patch over the row', async () => {
        const captured = capturePutBody();

        await appAgentLayoutApi.save({ firm: ['a', 'b'] });

        expect(captured.read()).toEqual({ firm: ['a', 'b'] });
        expect(Object.keys(captured.read() as object)).toEqual(['firm']);
    });

    it('sends both scopes when both are given', async () => {
        const captured = capturePutBody();

        await appAgentLayoutApi.save({ my: ['a'], firm: ['b'] });

        expect(captured.read()).toEqual({ my: ['a'], firm: ['b'] });
    });

    it('drops a scope held as undefined rather than sending a key the endpoint would reject', async () => {
        const captured = capturePutBody();

        await appAgentLayoutApi.save({ my: undefined, firm: ['a'] });

        expect(Object.keys(captured.read() as object)).toEqual(['firm']);
    });

    it('rejects without a request when the patch carries no scope, which the endpoint answers with a 400', async () => {
        let requests = 0;

        server.use(
            http.put(apiUrl(LAYOUT_PATH), () => {
                requests += 1;

                return envelope({});
            }),
        );

        await expect(appAgentLayoutApi.save({})).rejects.toThrow('at least one scope');
        expect(requests).toBe(0);
    });

    it('sends the order exactly as given rather than a sorted copy', async () => {
        const captured = capturePutBody();

        await appAgentLayoutApi.save({ my: ['c', 'a', 'b'] });

        expect(captured.read()?.my).toEqual(['c', 'a', 'b']);
    });

    it('persists an explicitly empty list', async () => {
        server.use(respond('put', LAYOUT_PATH, () => envelope({ firm: [] })));

        expect(await appAgentLayoutApi.save({ firm: [] })).toEqual({ firm: [] });
    });

    it('rejects when the API refuses the list', async () => {
        server.use(respond('put', LAYOUT_PATH, () => httpError(400, 'A pinned list may contain at most 10 ids.')));

        await expect(appAgentLayoutApi.save({ my: ['a'] })).rejects.toThrow();
    });
});

describe('appAgentLayoutApi.remove', () => {
    it('resolves against the null value the API returns', async () => {
        server.use(respond('delete', LAYOUT_PATH, () => envelope(null)));

        await expect(appAgentLayoutApi.remove()).resolves.toBeUndefined();
    });

    it('rejects on a failure envelope', async () => {
        server.use(respond('delete', LAYOUT_PATH, () => failureEnvelope('Nope')));

        await expect(appAgentLayoutApi.remove()).rejects.toThrow('Nope');
    });
});
