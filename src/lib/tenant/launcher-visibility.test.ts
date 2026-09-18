import { describe, expect, it } from 'vitest';

import {
    isHiddenForRole,
    normalizeLauncherVisibility,
    parseLauncherVisibility,
    toLauncherVisibilityDraft,
} from './launcher-visibility';

describe('parseLauncherVisibility', () => {
    it('reads an absent value as not hidden', () => {
        expect(parseLauncherVisibility(undefined)).toBe(false);
        expect(parseLauncherVisibility(null)).toBe(false);
    });

    it('reads the legacy booleans', () => {
        expect(parseLauncherVisibility(false)).toBe(false);
        expect(parseLauncherVisibility(true)).toBe(true);
    });

    it('reads the object form', () => {
        expect(parseLauncherVisibility({ visibleToRoles: ['admin', 'owner'] })).toEqual({
            visibleToRoles: ['admin', 'owner'],
        });
        expect(parseLauncherVisibility({ hidden: true, visibleToRoles: ['admin'] })).toEqual({
            hidden: true,
            visibleToRoles: ['admin'],
        });
    });

    it('collapses an all-roles list to a plain boolean', () => {
        expect(parseLauncherVisibility({ visibleToRoles: ['admin', 'owner', 'developer', 'user'] })).toBe(false);
        expect(parseLauncherVisibility({ hidden: true, visibleToRoles: ['admin', 'owner', 'developer', 'user'] })).toBe(
            true,
        );
    });

    it('collapses an empty role list to hidden', () => {
        expect(parseLauncherVisibility({ visibleToRoles: [] })).toBe(true);
    });

    it('keeps the known roles when the stored list carries an unknown one', () => {
        expect(parseLauncherVisibility({ visibleToRoles: ['admin', 'superadmin'] })).toEqual({
            visibleToRoles: ['admin'],
        });
    });

    it('reads a list of only unknown roles as hidden from everyone', () => {
        expect(parseLauncherVisibility({ visibleToRoles: ['nobody'] })).toBe(true);
    });

    it('falls back to not hidden on junk', () => {
        expect(parseLauncherVisibility('yes')).toBe(false);
        expect(parseLauncherVisibility(3)).toBe(false);
        expect(parseLauncherVisibility({ visibleToRoles: 'admin' })).toBe(false);
    });

    it('de-duplicates a stored list before deciding it covers every role', () => {
        expect(parseLauncherVisibility({ visibleToRoles: ['admin', 'admin', 'owner', 'owner'] })).toEqual({
            visibleToRoles: ['admin', 'owner'],
        });
    });
});

describe('normalizeLauncherVisibility', () => {
    it('returns false for an empty draft', () => {
        expect(normalizeLauncherVisibility({})).toBe(false);
    });

    it('keeps a partial role list', () => {
        expect(normalizeLauncherVisibility({ visibleToRoles: ['admin'] })).toEqual({ visibleToRoles: ['admin'] });
    });

    it('de-duplicates the role list it stores', () => {
        expect(normalizeLauncherVisibility({ visibleToRoles: ['owner', 'admin', 'admin'] })).toEqual({
            visibleToRoles: ['admin', 'owner'],
        });
    });

    it('treats a duplicated all-roles list as no narrowing at all', () => {
        expect(
            normalizeLauncherVisibility({ visibleToRoles: ['admin', 'admin', 'owner', 'owner', 'developer', 'user'] }),
        ).toBe(false);
    });

    it('keeps the role list alongside the master hide', () => {
        expect(normalizeLauncherVisibility({ hidden: true, visibleToRoles: ['admin'] })).toEqual({
            hidden: true,
            visibleToRoles: ['admin'],
        });
    });
});

describe('toLauncherVisibilityDraft', () => {
    it('turns every stored form into the editable object', () => {
        expect(toLauncherVisibilityDraft(undefined)).toEqual({});
        expect(toLauncherVisibilityDraft(false)).toEqual({});
        expect(toLauncherVisibilityDraft(true)).toEqual({ hidden: true });
        expect(toLauncherVisibilityDraft({ visibleToRoles: ['user'] })).toEqual({
            hidden: undefined,
            visibleToRoles: ['user'],
        });
    });
});

describe('isHiddenForRole', () => {
    it('shows the thing when the setting is off or absent', () => {
        expect(isHiddenForRole(undefined, 'user')).toBe(false);
        expect(isHiddenForRole(false, 'user')).toBe(false);
    });

    it('hides the thing from everyone on the legacy true', () => {
        expect(isHiddenForRole(true, 'admin')).toBe(true);
        expect(isHiddenForRole(true, 'user')).toBe(true);
    });

    it('shows the thing to a listed role and hides it from an unlisted one', () => {
        const setting = { visibleToRoles: ['admin' as const, 'owner' as const] };

        expect(isHiddenForRole(setting, 'admin')).toBe(false);
        expect(isHiddenForRole(setting, 'owner')).toBe(false);
        expect(isHiddenForRole(setting, 'developer')).toBe(true);
        expect(isHiddenForRole(setting, 'user')).toBe(true);
    });

    it('lets the master hide beat the role list, admin included', () => {
        const setting = { hidden: true, visibleToRoles: ['admin' as const] };

        expect(isHiddenForRole(setting, 'admin')).toBe(true);
        expect(isHiddenForRole(setting, 'user')).toBe(true);
    });

    it('behaves like the setting being off when all four roles are listed', () => {
        const setting = { visibleToRoles: ['admin' as const, 'owner' as const, 'developer' as const, 'user' as const] };

        expect(isHiddenForRole(setting, 'user')).toBe(false);
        expect(isHiddenForRole(setting, null)).toBe(false);
    });

    it('hides the thing from nobody-can-see when the role list is empty', () => {
        expect(isHiddenForRole({ visibleToRoles: [] }, 'admin')).toBe(true);
    });

    it('leaves a not-yet-known role unrestricted so an admin never loses an entry point', () => {
        expect(isHiddenForRole({ visibleToRoles: ['admin'] }, null)).toBe(false);
        expect(isHiddenForRole(true, null)).toBe(true);
    });
});
