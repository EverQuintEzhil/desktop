import { z } from 'zod';

import type { LauncherRole, LauncherVisibility, Role } from '@/types/store';

export const LAUNCHER_ROLES: readonly LauncherRole[] = ['admin', 'owner', 'developer', 'user'] as const;

export const LAUNCHER_ROLE_LABELS: Record<LauncherRole, string> = {
    admin: 'Admin',
    owner: 'Owner',
    developer: 'Developer',
    user: 'User',
};

const isLauncherRole = (value: unknown): value is LauncherRole => LAUNCHER_ROLES.includes(value as LauncherRole);

export const launcherVisibilitySchema = z.union([
    z.boolean(),
    z.looseObject({
        hidden: z.boolean().optional().catch(undefined),
        visibleToRoles: z
            .array(z.unknown())
            .optional()
            .catch(undefined)
            .transform((roles) => roles?.filter(isLauncherRole)),
    }),
]);

export type LauncherVisibilityDraft = {
    hidden?: boolean;
    visibleToRoles?: LauncherRole[];
};

/** The object form of a setting, whatever form it arrived in — the shape the editor works on. */
export const toLauncherVisibilityDraft = (value: LauncherVisibility | undefined): LauncherVisibilityDraft => {
    if (value === true) return { hidden: true };
    if (!value) return {};

    return { hidden: value.hidden, visibleToRoles: value.visibleToRoles };
};

/**
 * Collapses a draft to the smallest value that means the same thing: a plain boolean when no role
 * list narrows it, and `hidden: true` whenever the list is empty — an empty list means nobody.
 * The role list is rebuilt from `LAUNCHER_ROLES`, so duplicates cannot inflate its length past the
 * every-role check and let a narrowed setting collapse to visible-to-all.
 */
export const normalizeLauncherVisibility = (draft: LauncherVisibilityDraft): LauncherVisibility => {
    const roles = draft.visibleToRoles && LAUNCHER_ROLES.filter((role) => draft.visibleToRoles?.includes(role));
    const noRolesLeft = roles?.length === 0;
    const hidden = draft.hidden === true || noRolesLeft;
    const visibleToRoles = roles && roles.length > 0 && roles.length < LAUNCHER_ROLES.length ? roles : undefined;

    if (!visibleToRoles) return hidden;

    return { ...(hidden ? { hidden: true } : {}), visibleToRoles };
};

export const parseLauncherVisibility = (raw: unknown): LauncherVisibility => {
    const parsed = launcherVisibilitySchema.safeParse(raw ?? false);

    if (!parsed.success) return false;

    return normalizeLauncherVisibility(toLauncherVisibilityDraft(parsed.data));
};

/**
 * Whether the setting hides the thing from this role. An unknown role is treated as unrestricted:
 * these are launcher affordances with no API enforcement behind them, so a role that has not
 * resolved yet must not blank out an admin's entry points. Usage figures take the opposite,
 * deny-by-default stance in `isUsageVisibleTo` because they disclose cost data.
 */
export const isHiddenForRole = (value: LauncherVisibility | undefined, role: Role): boolean => {
    if (value === true) return true;
    if (!value) return false;
    if (value.hidden) return true;

    const roles = value.visibleToRoles;

    if (!roles) return false;
    if (roles.length === 0) return true;
    if (!role) return false;

    return !roles.includes(role);
};
