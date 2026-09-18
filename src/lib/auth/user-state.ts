import { z } from 'zod';

import type { SessionUserinfo } from '@/lib/api/common/session';
import type { Role, UserState } from '@/types/store';

const SESSION_DURATION_MS = 30 * 60 * 1000;

// `.optional()` is load-bearing: in zod v4 a bare `z.unknown()` key is
// REQUIRED, so a payload that merely omits one of these throws and bounces a
// validly authenticated user back to sign-in.
const sessionUserinfoSchema = z.looseObject({
    sub: z.string(),
    avatar: z.string().nullish(),
    name: z.unknown().optional(),
    email: z.string().nullish(),
    role: z.unknown().optional(),
    security_groups: z.unknown().optional(),
});

const storedUserSchema = z.looseObject({
    _id: z.string().nullish(),
    avatar: z.string().nullish(),
    name: z.unknown().optional(),
    email: z.string().nullish(),
    role: z.unknown().optional(),
    security_groups: z.unknown().optional(),
    isAuthenticated: z.boolean().optional(),
    expiry: z.union([z.number(), z.string()]),
});

export const createAnonymousUserState = (): UserState => ({
    _id: null,
    name: {
        first: null,
        last: null,
        middle: null,
    },
    email: null,
    role: null,
    security_groups: null,
    avatar: null,
    isAuthenticated: false,
});

const normalizeName = (name: unknown): UserState['name'] => {
    if (typeof name === 'string') {
        const [first = '', ...lastParts] = name.trim().split(/\s+/);
        const last = lastParts.join(' ');

        return {
            first: first || null,
            last: last || null,
            middle: null,
        };
    }

    if (name && typeof name === 'object') {
        const userName = name as Partial<Record<'first' | 'last' | 'middle', unknown>>;

        return {
            first: typeof userName.first === 'string' ? userName.first : null,
            last: typeof userName.last === 'string' ? userName.last : null,
            middle: typeof userName.middle === 'string' ? userName.middle : null,
        };
    }

    return {
        first: null,
        last: null,
        middle: null,
    };
};

const normalizeRole = (role: unknown): Role => {
    if (role === 'admin' || role === 'owner' || role === 'developer' || role === 'user') {
        return role;
    }

    return null;
};

const normalizeSecurityGroups = (securityGroups: unknown): UserState['security_groups'] => {
    if (!Array.isArray(securityGroups)) {
        return null;
    }

    return securityGroups.filter((securityGroup): securityGroup is string => typeof securityGroup === 'string');
};

const toUserState = (value: {
    _id: string | null;
    avatar?: string | null;
    name: unknown;
    email?: string | null;
    role: unknown;
    security_groups: unknown;
    isAuthenticated: boolean;
}): UserState => ({
    _id: value._id,
    avatar: value.avatar ?? null,
    name: normalizeName(value.name),
    email: value.email ?? null,
    role: normalizeRole(value.role),
    security_groups: normalizeSecurityGroups(value.security_groups),
    isAuthenticated: value.isAuthenticated,
});

export const mapSessionUserinfoToUserState = (userinfo: SessionUserinfo): UserState => {
    const parsed = sessionUserinfoSchema.parse(userinfo);

    return toUserState({
        _id: parsed.sub,
        avatar: parsed.avatar,
        name: parsed.name,
        email: parsed.email,
        role: parsed.role,
        security_groups: parsed.security_groups,
        isAuthenticated: true,
    });
};

export const createStoredUserState = (user: UserState): UserState & { expiry: number } => ({
    ...user,
    expiry: Date.now() + SESSION_DURATION_MS,
});

export const parseStoredUserState = (value: unknown): UserState | null => {
    const parsed = storedUserSchema.safeParse(value);

    if (!parsed.success) {
        return null;
    }

    const expiry = typeof parsed.data.expiry === 'string' ? Number(parsed.data.expiry) : parsed.data.expiry;

    if (!Number.isFinite(expiry) || expiry <= Date.now()) {
        return null;
    }

    return toUserState({
        _id: parsed.data._id ?? null,
        avatar: parsed.data.avatar,
        name: parsed.data.name,
        email: parsed.data.email,
        role: parsed.data.role,
        security_groups: parsed.data.security_groups,
        isAuthenticated: true,
    });
};
