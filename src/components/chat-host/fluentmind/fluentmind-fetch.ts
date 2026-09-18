import { authAwareFetch } from '@/lib/auth-aware-fetch';
import { getBrowserTimezone, TIMEZONE_HEADER } from '@/utils/browser-timezone';

export const createCookieFetch = (): typeof fetch => authAwareFetch;

export type TokenSource = string | (() => string | Promise<string>);

// Bearer-token fetch for external <FluentMindChat> hosts; sends no cookies.
// `token` may be a static string OR a resolver called per-request — pass a
// resolver when the token is short-lived so long-lived sessions (e.g. clicking
// like/dislike minutes after the turn) mint a fresh token instead of 401ing on
// an expired one. `headerName` defaults to 'Authorization'; some hosts expect a
// custom header such as 'token'.
export function createTokenFetch(token: TokenSource, headerName = 'Authorization'): typeof fetch {
    return async (input, init) => {
        const headers = new Headers(init?.headers);
        const value = typeof token === 'function' ? await token() : token;

        headers.set(headerName, `Bearer ${value}`);

        if (!headers.has(TIMEZONE_HEADER)) {
            headers.set(TIMEZONE_HEADER, getBrowserTimezone());
        }

        return fetch(input, { ...init, headers, credentials: 'omit' });
    };
}
