import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SessionUserinfo } from '@/lib/api/common/session';

import {
    createAnonymousUserState,
    createStoredUserState,
    mapSessionUserinfoToUserState,
    parseStoredUserState,
} from './user-state';

const NOW = new Date('2026-07-27T12:00:00.000Z').getTime();
const THIRTY_MINUTES = 30 * 60 * 1000;

const userinfo = (overrides: Record<string, unknown> = {}): SessionUserinfo =>
    ({
        sub: 'user-1',
        avatar: 'avatar.png',
        name: { first: 'Ada', last: 'Lovelace' },
        email: 'ada@example.com',
        role: 'user',
        security_groups: ['engineering'],
        ...overrides,
    }) as unknown as SessionUserinfo;

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
});

afterEach(() => {
    vi.useRealTimers();
});

describe('createAnonymousUserState', () => {
    it('is unauthenticated with every field emptied', () => {
        expect(createAnonymousUserState()).toEqual({
            _id: null,
            name: { first: null, last: null, middle: null },
            email: null,
            role: null,
            security_groups: null,
            avatar: null,
            isAuthenticated: false,
        });
    });
});

describe('mapSessionUserinfoToUserState', () => {
    it('maps sub to _id and marks the user authenticated', () => {
        const state = mapSessionUserinfoToUserState(userinfo());

        expect(state._id).toBe('user-1');
        expect(state.isAuthenticated).toBe(true);
        expect(state.email).toBe('ada@example.com');
    });

    it('splits a string name into first and last', () => {
        const state = mapSessionUserinfoToUserState(userinfo({ name: 'Ada  Lovelace' }));

        expect(state.name).toEqual({ first: 'Ada', last: 'Lovelace', middle: null });
    });

    it('keeps only the first token when a string name has no surname', () => {
        const state = mapSessionUserinfoToUserState(userinfo({ name: 'Ada' }));

        expect(state.name).toEqual({ first: 'Ada', last: null, middle: null });
    });

    it('falls back to an empty name when the value is neither string nor object', () => {
        const state = mapSessionUserinfoToUserState(userinfo({ name: 42 }));

        expect(state.name).toEqual({ first: null, last: null, middle: null });
    });

    /** A role the app does not know must not be trusted through to the store. */
    it('nulls an unrecognised role rather than passing it through', () => {
        expect(mapSessionUserinfoToUserState(userinfo({ role: 'superadmin' })).role).toBeNull();
    });

    it.each(['admin', 'owner', 'developer', 'user'])('accepts the %s role', (role) => {
        expect(mapSessionUserinfoToUserState(userinfo({ role })).role).toBe(role);
    });

    it('drops non-string entries from security groups', () => {
        const state = mapSessionUserinfoToUserState(userinfo({ security_groups: ['engineering', 7, null, 'design'] }));

        expect(state.security_groups).toEqual(['engineering', 'design']);
    });

    it('nulls security groups that are not an array', () => {
        expect(mapSessionUserinfoToUserState(userinfo({ security_groups: 'engineering' })).security_groups).toBeNull();
    });

    it('throws when the payload has no subject', () => {
        expect(() => mapSessionUserinfoToUserState(userinfo({ sub: undefined }))).toThrow();
    });
});

describe('createStoredUserState', () => {
    it('stamps a 30-minute expiry', () => {
        const stored = createStoredUserState(createAnonymousUserState());

        expect(stored.expiry).toBe(NOW + THIRTY_MINUTES);
    });
});

describe('parseStoredUserState — the boot-as-authenticated gate', () => {
    const valid = {
        _id: 'user-1',
        avatar: 'avatar.png',
        name: { first: 'Ada', last: 'Lovelace' },
        email: 'ada@example.com',
        role: 'user',
        security_groups: ['engineering'],
        expiry: NOW + THIRTY_MINUTES,
    };

    it('restores a live session', () => {
        const state = parseStoredUserState(valid);

        expect(state?._id).toBe('user-1');
        expect(state?.isAuthenticated).toBe(true);
    });

    it('rejects an expired session', () => {
        expect(parseStoredUserState({ ...valid, expiry: NOW - 1 })).toBeNull();
    });

    it('rejects a session expiring exactly now', () => {
        expect(parseStoredUserState({ ...valid, expiry: NOW })).toBeNull();
    });

    it('accepts a numeric expiry stored as a string', () => {
        expect(parseStoredUserState({ ...valid, expiry: String(NOW + THIRTY_MINUTES) })).not.toBeNull();
    });

    it('rejects a non-numeric expiry string', () => {
        expect(parseStoredUserState({ ...valid, expiry: 'never' })).toBeNull();
    });

    it('rejects a blob with no expiry at all', () => {
        const { expiry, ...withoutExpiry } = valid;

        void expiry;

        expect(parseStoredUserState(withoutExpiry)).toBeNull();
    });

    it.each([
        ['null', null],
        ['undefined', undefined],
        ['a bare string', 'nonsense'],
        ['a number', 42],
        ['an array', []],
    ])('rejects %s', (_label, value) => {
        expect(parseStoredUserState(value)).toBeNull();
    });

    /** A tampered blob must not be able to grant itself a role the app honours. */
    it('nulls an unrecognised role from stored state', () => {
        expect(parseStoredUserState({ ...valid, role: 'superadmin' })?.role).toBeNull();
    });

    /** `isAuthenticated: false` in the blob must not survive as a trusted value. */
    it('always marks a surviving stored session as authenticated', () => {
        expect(parseStoredUserState({ ...valid, isAuthenticated: false })?.isAuthenticated).toBe(true);
    });
});
