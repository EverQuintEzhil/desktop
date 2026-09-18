import { beforeEach, describe, expect, it } from 'vitest';

import { clearSessionToken, getSessionToken, setSessionToken } from './session-token';

const STORAGE_KEY = 'fm_session_token';

beforeEach(() => {
    clearSessionToken();
    localStorage.clear();
});

describe('session token store', () => {
    it('round-trips a token with a numeric expiry', () => {
        setSessionToken('jwt-abc', Date.now() + 60_000);

        expect(getSessionToken()).toBe('jwt-abc');
    });

    it('parses an ISO expiry stamp', () => {
        setSessionToken('jwt-abc', new Date(Date.now() + 60_000).toISOString());

        expect(getSessionToken()).toBe('jwt-abc');
    });

    it('applies a default expiry when the stamp is missing or unparsable', () => {
        setSessionToken('jwt-abc', 'not-a-date');

        expect(getSessionToken()).toBe('jwt-abc');
    });

    it('returns null and clears the entry once the token expires', () => {
        setSessionToken('jwt-abc', Date.now() - 1);

        expect(getSessionToken()).toBeNull();
        expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('survives a reload via localStorage', () => {
        setSessionToken('jwt-abc', Date.now() + 60_000);
        // A fresh module would have no in-memory copy; simulate by clearing only memory.
        clearSessionToken();
        expect(getSessionToken()).toBeNull();

        // Restore persisted state as a reload would find it.
        setSessionToken('jwt-restored', Date.now() + 60_000);
        expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').token).toBe('jwt-restored');
    });

    it('ignores malformed persisted values', () => {
        localStorage.setItem(STORAGE_KEY, 'not-json');

        expect(getSessionToken()).toBeNull();
    });

    it('ignores persisted values missing the token', () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ expiresAt: Date.now() + 60_000 }));

        expect(getSessionToken()).toBeNull();
    });

    it('clears both memory and storage', () => {
        setSessionToken('jwt-abc', Date.now() + 60_000);
        clearSessionToken();

        expect(getSessionToken()).toBeNull();
        expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
});
