import { afterEach, describe, expect, it, vi } from 'vitest';

import { getRedirectTarget } from './redirect';
import { setSurface } from './surface';

afterEach(() => {
    setSurface('app');
});

/**
 * `getRedirectTarget` is the open-redirect guard for the post-login bounce.
 * Anything it returns is handed to `navigate()` or `window.location.href`, so a
 * permissive result here is an account-takeover vector: attacker sends
 * `/accounts?redirect_uri=https://evil.test/steal`, the user signs in, and the
 * app walks them straight there.
 *
 * Under jsdom `window.location.origin` is `http://localhost:3000` and
 * `getApiBaseUrl()` resolves to `https://api.localhost`.
 */
describe('getRedirectTarget — same-origin targets', () => {
    it('accepts a relative path and returns it as internal', () => {
        expect(getRedirectTarget('/agent/agent-1/chat')).toEqual({
            value: '/agent/agent-1/chat',
            fullPageLoad: false,
        });
    });

    it('preserves the query string and hash', () => {
        expect(getRedirectTarget('/library?tab=yours#top')).toEqual({
            value: '/library?tab=yours#top',
            fullPageLoad: false,
        });
    });

    it('strips the origin from an absolute same-origin URL', () => {
        expect(getRedirectTarget('http://localhost:3000/blogs')).toEqual({
            value: '/blogs',
            fullPageLoad: false,
        });
    });
});

describe('getRedirectTarget — the app/admin bundle boundary', () => {
    it('flags an admin target reached from the app bundle', () => {
        setSurface('app');

        expect(getRedirectTarget('/admin/abouts')).toEqual({
            value: '/admin/abouts',
            fullPageLoad: true,
        });
    });

    it('flags an app target reached from the admin bundle', () => {
        setSurface('admin');

        expect(getRedirectTarget('/library')).toEqual({
            value: '/library',
            fullPageLoad: true,
        });
    });

    it('keeps an admin-to-admin hop client-side', () => {
        setSurface('admin');

        expect(getRedirectTarget('/admin/abouts')).toEqual({
            value: '/admin/abouts',
            fullPageLoad: false,
        });
    });

    it('ignores the URL when deciding which bundle is loaded', () => {
        setSurface('admin');
        window.history.replaceState({}, '', '/accounts');

        expect(getRedirectTarget('/admin/abouts')).toEqual({
            value: '/admin/abouts',
            fullPageLoad: false,
        });

        window.history.replaceState({}, '', '/');
    });

    it('does not treat a path merely prefixed with admin as the admin bundle', () => {
        setSurface('app');

        expect(getRedirectTarget('/administration')).toEqual({
            value: '/administration',
            fullPageLoad: false,
        });
    });
});

describe('getRedirectTarget — the trusted API origin', () => {
    it('allows the API origin and marks it external', () => {
        expect(getRedirectTarget('https://api.localhost/oauth/callback?code=1')).toEqual({
            value: 'https://api.localhost/oauth/callback?code=1',
            fullPageLoad: true,
        });
    });
});

describe('getRedirectTarget — rejected targets', () => {
    it('rejects an unrelated external origin', () => {
        expect(getRedirectTarget('https://evil.test/steal')).toBeNull();
    });

    it('rejects a lookalike of the API host', () => {
        expect(getRedirectTarget('https://api.localhost.evil.test/steal')).toBeNull();
    });

    it('rejects a protocol-relative URL pointing off-origin', () => {
        expect(getRedirectTarget('//evil.test/steal')).toBeNull();
    });

    it('rejects a javascript: URL', () => {
        expect(getRedirectTarget('javascript:alert(1)')).toBeNull();
    });

    it('rejects a data: URL', () => {
        expect(getRedirectTarget('data:text/html,<script>alert(1)</script>')).toBeNull();
    });

    it('rejects an http downgrade of the trusted API origin', () => {
        expect(getRedirectTarget('http://api.localhost/oauth/callback')).toBeNull();
    });

    it('returns null rather than throwing on unparseable input', () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

        expect(getRedirectTarget('http://[')).toBeNull();

        consoleError.mockRestore();
    });
});
