import { http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearSessionToken, getSessionToken, setSessionToken } from '@/lib/auth/session-token';
import { apiUrl, envelope, httpError, respond, server } from '@/test/msw';

import { authApi } from './authentication';

beforeEach(() => {
    clearSessionToken();
});

interface OtpRequestBody {
    type?: string;
    email?: string;
}

interface OtpVerifyBody {
    email?: string;
    otp?: string;
}

/**
 * The backend rejects bad OTPs with a 403 carrying a `{ success: false, message }`
 * body (see `api/schemas/Authentication/post_request_id.js`), so these assert the
 * real failure shapes rather than a generic throw.
 */
describe('authApi.requestOtp', () => {
    it('defaults the login type to jwt so the verify step returns the desktop bearer session', async () => {
        let body: OtpRequestBody = {};

        server.use(
            http.post(apiUrl('/authentication'), async ({ request }) => {
                body = (await request.json()) as OtpRequestBody;

                return envelope({ requestId: 'req-1' });
            }),
        );

        const result = await authApi.requestOtp({ email: 'ada@example.com' });

        expect(body).toEqual({ type: 'jwt', email: 'ada@example.com' });
        expect(result.requestId).toBe('req-1');
    });

    it('honours an explicit cookie login type', async () => {
        let body: OtpRequestBody = {};

        server.use(
            http.post(apiUrl('/authentication'), async ({ request }) => {
                body = (await request.json()) as OtpRequestBody;

                return envelope({ requestId: 'req-2' });
            }),
        );

        await authApi.requestOtp({ email: 'ada@example.com', type: 'cookie' });

        expect(body.type).toBe('cookie');
    });

    it('rejects when the user does not exist', async () => {
        server.use(respond('post', '/authentication', () => httpError(404, 'User not found')));

        await expect(authApi.requestOtp({ email: 'nobody@example.com' })).rejects.toThrow();
    });

    /**
     * `authRequest` sets `skipAuthRedirect: true`. Without it a 401 on the login
     * endpoint would trip `handleSessionExpired` and bounce the user to
     * `/accounts` from `/accounts` — a redirect loop on the sign-in screen.
     */
    it('does not trigger the session-expiry redirect on a 401', async () => {
        server.use(respond('post', '/authentication', () => httpError(401, 'Unauthorized')));

        await expect(authApi.requestOtp({ email: 'ada@example.com' })).rejects.toThrow();
        expect(sessionStorage.getItem('deep_link')).toBeNull();
    });
});

describe('authApi.verifyOtp', () => {
    it('posts the email and otp and returns the bearer session', async () => {
        let body: OtpVerifyBody = {};
        let path = '';

        server.use(
            http.post(apiUrl('/authentication/:requestId'), async ({ request }) => {
                path = new URL(request.url).pathname;
                body = (await request.json()) as OtpVerifyBody;

                return envelope({ token: 'jwt-session', expiresAt: 1757000000000 });
            }),
        );

        const session = await authApi.verifyOtp('req-1', { email: 'ada@example.com', otp: '483920' });

        expect(path).toBe('/authentication/req-1');
        expect(body).toEqual({ email: 'ada@example.com', otp: '483920' });
        expect(session).toEqual({ token: 'jwt-session', expiresAt: 1757000000000 });
    });

    it('rejects an invalid otp', async () => {
        server.use(
            respond('post', '/authentication/req-1', () =>
                httpError(403, 'The otp "000000" is invalid for the request "req-1".'),
            ),
        );

        await expect(authApi.verifyOtp('req-1', { email: 'ada@example.com', otp: '000000' })).rejects.toThrow();
    });

    it('rejects once the attempt limit is hit', async () => {
        server.use(respond('post', '/authentication/req-1', () => httpError(403, 'Too many failed attempts.')));

        await expect(authApi.verifyOtp('req-1', { email: 'ada@example.com', otp: '111111' })).rejects.toThrow();
    });

    it('rejects an expired otp', async () => {
        server.use(
            respond('post', '/authentication/req-1', () =>
                httpError(403, 'The otp for the request "req-1" is expired.'),
            ),
        );

        await expect(authApi.verifyOtp('req-1', { email: 'ada@example.com', otp: '483920' })).rejects.toThrow();
    });

    it('rejects a request that was already consumed', async () => {
        server.use(
            respond('post', '/authentication/req-1', () => httpError(403, 'This request is already processed.')),
        );

        await expect(authApi.verifyOtp('req-1', { email: 'ada@example.com', otp: '483920' })).rejects.toThrow();
    });
});

describe('authApi.initiateIdp', () => {
    it('returns the provider redirect url', async () => {
        server.use(
            respond('post', '/authentication/idp/azure', () =>
                envelope({ redirect_url: 'https://login.microsoftonline.com/authorize' }),
            ),
        );

        const result = await authApi.initiateIdp('azure');

        expect(result.redirect_url).toBe('https://login.microsoftonline.com/authorize');
    });

    it('rejects when the provider is unknown', async () => {
        server.use(respond('post', '/authentication/idp/nope', () => httpError(404)));

        await expect(authApi.initiateIdp('nope')).rejects.toThrow();
    });
});

describe('authApi.completeIdp', () => {
    it('posts the callback payload to the state-scoped endpoint', async () => {
        let path = '';
        let body: Record<string, unknown> = {};

        server.use(
            http.post(apiUrl('/authentication/idp/:idpId/:state'), async ({ request }) => {
                path = new URL(request.url).pathname;
                body = (await request.json()) as Record<string, unknown>;

                return envelope({});
            }),
        );

        await authApi.completeIdp('azure', 'state-abc', { code: 'auth-code-1' });

        expect(path).toBe('/authentication/idp/azure/state-abc');
        expect(body).toEqual({ code: 'auth-code-1' });
    });

    it('rejects when the state does not match', async () => {
        server.use(respond('post', '/authentication/idp/azure/bad-state', () => httpError(403, 'Invalid state')));

        await expect(authApi.completeIdp('azure', 'bad-state', {})).rejects.toThrow();
    });
});

describe('authApi.logout', () => {
    it('posts an empty body to the logout endpoint and clears the stored session token', async () => {
        let body: unknown;
        let path = '';

        setSessionToken('jwt-session', Date.now() + 60_000);
        server.use(
            http.post(apiUrl('/authentication/logout'), async ({ request }) => {
                path = new URL(request.url).pathname;
                body = await request.json();

                return envelope({});
            }),
        );

        await authApi.logout();

        expect(path).toBe('/authentication/logout');
        expect(body).toEqual({});
        expect(getSessionToken()).toBeNull();
    });

    /** A 401 means the session is already gone server-side — that is a completed logout. */
    it('treats a 401 as an already-ended session', async () => {
        setSessionToken('jwt-session', Date.now() + 60_000);
        server.use(respond('post', '/authentication/logout', () => httpError(401, 'Invalid Authentication')));

        await expect(authApi.logout()).resolves.toBeUndefined();
        expect(getSessionToken()).toBeNull();
    });

    it('rejects when the server fails to end the session, but still stops sending the token', async () => {
        setSessionToken('jwt-session', Date.now() + 60_000);
        server.use(respond('post', '/authentication/logout', () => httpError(500)));

        await expect(authApi.logout()).rejects.toThrow();
        expect(getSessionToken()).toBeNull();
    });
});

