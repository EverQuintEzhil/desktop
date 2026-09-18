import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    buildWebsiteLoginUrl,
    clearStoredLoginState,
    createLoginState,
    getWebsiteBaseUrl,
    parseWebsiteCallback,
    readStoredLoginState,
    storeLoginState,
} from './website-login';

vi.mock('@/lib/axios', () => ({
    getApiBaseUrl: () => 'https://api.perkinswill.fluentmind.dev',
}));

beforeEach(() => {
    sessionStorage.clear();
});

describe('getWebsiteBaseUrl', () => {
    it('strips the api. prefix off the API origin', () => {
        expect(getWebsiteBaseUrl()).toBe('https://perkinswill.fluentmind.dev');
    });
});

describe('buildWebsiteLoginUrl', () => {
    it('points at /desktop-auth with the state nonce', () => {
        expect(buildWebsiteLoginUrl('nonce-1')).toBe('https://perkinswill.fluentmind.dev/desktop-auth?state=nonce-1');
    });

    it('URL-encodes the state', () => {
        expect(buildWebsiteLoginUrl('a b&c')).toBe('https://perkinswill.fluentmind.dev/desktop-auth?state=a+b%26c');
    });

    it('appends the loopback port when given', () => {
        expect(buildWebsiteLoginUrl('nonce-1', 49512)).toBe(
            'https://perkinswill.fluentmind.dev/desktop-auth?state=nonce-1&port=49512',
        );
    });

    it('omits the port when not given', () => {
        expect(buildWebsiteLoginUrl('nonce-1')).not.toContain('port=');
    });
});

describe('login state nonce', () => {
    it('is unique per attempt', () => {
        expect(createLoginState()).not.toBe(createLoginState());
    });

    it('round-trips through storage', () => {
        storeLoginState('nonce-2');

        expect(readStoredLoginState()).toBe('nonce-2');

        clearStoredLoginState();

        expect(readStoredLoginState()).toBeNull();
    });
});

describe('parseWebsiteCallback', () => {
    it('parses a full callback', () => {
        expect(
            parseWebsiteCallback('fluentmind-desktop://auth?token=tok-1&state=nonce-3&expires_at=2026-09-19T07%3A00%3A00.000Z'),
        ).toEqual({ token: 'tok-1', state: 'nonce-3', expiresAt: '2026-09-19T07:00:00.000Z' });
    });

    it('accepts the no-slash spelling of the same URL', () => {
        expect(parseWebsiteCallback('fluentmind-desktop:auth?token=tok-1&state=nonce-3')).toEqual({
            token: 'tok-1',
            state: 'nonce-3',
            expiresAt: undefined,
        });
    });

    it('parses a loopback callback', () => {
        expect(
            parseWebsiteCallback('http://127.0.0.1:49512/auth?token=tok-9&state=nonce-9&expires_at=2026-09-19T07%3A00%3A00.000Z'),
        ).toEqual({ token: 'tok-9', state: 'nonce-9', expiresAt: '2026-09-19T07:00:00.000Z' });
    });

    it('parses a localhost loopback callback', () => {
        expect(parseWebsiteCallback('http://localhost:8123/auth?token=tok-9&state=nonce-9')).toEqual({
            token: 'tok-9',
            state: 'nonce-9',
            expiresAt: undefined,
        });
    });

    it('rejects a remote http host posing as a callback', () => {
        expect(parseWebsiteCallback('http://evil.example.com/auth?token=tok-1&state=nonce-3')).toBeNull();
    });

    it('rejects a loopback callback on the wrong path', () => {
        expect(parseWebsiteCallback('http://127.0.0.1:49512/steal?token=tok-1&state=nonce-3')).toBeNull();
    });

    it('rejects a foreign scheme', () => {
        expect(parseWebsiteCallback('https://auth?token=tok-1&state=nonce-3')).toBeNull();
    });

    it('rejects a different deep-link host', () => {
        expect(parseWebsiteCallback('fluentmind-desktop://open-agent?id=1')).toBeNull();
    });

    it('rejects a callback without a token', () => {
        expect(parseWebsiteCallback('fluentmind-desktop://auth?state=nonce-3')).toBeNull();
    });

    it('rejects a callback without a state', () => {
        expect(parseWebsiteCallback('fluentmind-desktop://auth?token=tok-1')).toBeNull();
    });

    it('rejects garbage', () => {
        expect(parseWebsiteCallback('not a url')).toBeNull();
    });
});
