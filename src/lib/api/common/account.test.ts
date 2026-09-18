import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { apiUrl, envelope, httpError, pagedEnvelope, respond, server } from '@/test/msw';

import { accountApi, type LoginActivityGroup, type McpConnection, type MeProfile } from './account';

const profile = {
    _id: 'user-1',
    name: { first: 'Ada', last: 'Lovelace' },
    role: 'user',
    avatar: '',
    email: 'ada@example.com',
    otherEmails: [],
    mobile: null,
    defaultLanguage: 'en',
    timezone: null,
    timezoneOffset: null,
    tags: [],
    portalAccessEnabled: true,
    preferences: null,
    createdAt: '2026-01-01T00:00:00.000Z',
} as unknown as MeProfile;

const activityGroup = {
    requestId: 'req-1',
    activities: [
        {
            _id: 'act-1',
            type: 'cookie',
            provider: 'OTP',
            email: 'ada@example.com',
            requestId: 'req-1',
            ipAddr: '10.0.0.1',
            userAgent: 'Chrome',
            status: 'success',
            reason: 'otp matched',
            expiresAt: null,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
        },
    ],
} as LoginActivityGroup;

const connection = {
    _id: 'conn-1',
    mcpServerId: 'srv-1',
    userId: 'user-1',
    status: 'connected',
    tokenExpiry: null,
    mcpServerName: 'Google Drive',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
} as McpConnection;

describe('accountApi.getMe', () => {
    it('unwraps the success envelope', async () => {
        server.use(respond('get', '/users/me', () => envelope(profile)));

        await expect(accountApi.getMe()).resolves.toEqual(profile);
    });

    it('throws with the API message when success is false', async () => {
        server.use(
            respond(
                'get',
                '/users/me',
                () =>
                    new Response(JSON.stringify({ success: false, message: 'Profile unavailable', value: null }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    }),
            ),
        );

        await expect(accountApi.getMe()).rejects.toThrow('Profile unavailable');
    });

    it('rejects on a non-2xx response', async () => {
        server.use(respond('get', '/users/me', () => httpError(500)));

        await expect(accountApi.getMe()).rejects.toThrow();
    });
});

describe('accountApi.updateMe', () => {
    it('sends the patch as the PUT body and returns the updated profile', async () => {
        let body: unknown;

        server.use(
            http.put(apiUrl('/users/me'), async ({ request }) => {
                body = await request.json();

                return envelope({ ...profile, defaultLanguage: 'fr' });
            }),
        );

        const result = await accountApi.updateMe({ preferences: { keyboard: { enabled: false } } as never });

        expect(body).toEqual({ preferences: { keyboard: { enabled: false } } });
        expect(result.defaultLanguage).toBe('fr');
    });

    it('rejects on a non-2xx response', async () => {
        server.use(respond('put', '/users/me', () => httpError(422)));

        await expect(accountApi.updateMe({})).rejects.toThrow();
    });
});

describe('accountApi.listLoginActivities', () => {
    it('maps page_info to pageInfo', async () => {
        server.use(
            respond('get', '/users/me/loginactivities', () =>
                pagedEnvelope([activityGroup], { page: 1, totalPages: 4, totalCount: 70 }),
            ),
        );

        const result = await accountApi.listLoginActivities();

        expect(result.values).toEqual([activityGroup]);
        expect(result.pageInfo).toEqual({ page: 1, totalPages: 4, totalCount: 70 });
    });

    it('forwards page and size params', async () => {
        let requestUrl = '';

        server.use(
            http.get(apiUrl('/users/me/loginactivities'), ({ request }) => {
                requestUrl = request.url;

                return pagedEnvelope([activityGroup]);
            }),
        );

        await accountApi.listLoginActivities({ page: 2, size: 10 });

        const params = new URL(requestUrl).searchParams;

        expect(params.get('page')).toBe('2');
        expect(params.get('size')).toBe('10');
    });

    it('rejects on a non-2xx response', async () => {
        server.use(respond('get', '/users/me/loginactivities', () => httpError(500)));

        await expect(accountApi.listLoginActivities()).rejects.toThrow();
    });
});

describe('accountApi.listMcpConnections', () => {
    it('maps page_info to pageInfo', async () => {
        server.use(
            respond('get', '/users/me/mcpconnections', () =>
                pagedEnvelope([connection], { page: 0, totalPages: 1, totalCount: 1 }),
            ),
        );

        const result = await accountApi.listMcpConnections();

        expect(result.values).toEqual([connection]);
        expect(result.pageInfo).toEqual({ page: 0, totalPages: 1, totalCount: 1 });
    });

    it('throws with the API message when success is false', async () => {
        server.use(
            respond(
                'get',
                '/users/me/mcpconnections',
                () =>
                    new Response(JSON.stringify({ success: false, message: 'Connections unavailable', value: null }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    }),
            ),
        );

        await expect(accountApi.listMcpConnections()).rejects.toThrow('Connections unavailable');
    });
});
