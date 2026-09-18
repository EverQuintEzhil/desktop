import type { AgentAccessItemState } from '@/lib/api/admin/agent-access';
import type { PlannedAcl, PrincipalAcl } from '@/lib/api/admin/agent-access-check';

import type { AccessItem, AccessItemKind, AccessUser } from './access-types';
import { ACCESS_ITEM_KINDS, accessPathOf, ignoreKey } from './access-types';

/** Dismissed capability+user pairs, as `ignoreKey` strings. */
export type IgnoreSet = ReadonlySet<string>;

export const NO_IGNORES: IgnoreSet = new Set<string>();

/** Whether the ignore set can be trusted yet: writes are held while it is not. */
export type IgnoresStatus = 'loading' | 'error' | 'ready';

/** An ignore is a decision about a gap, so it may only ever mask `not-included`. If the roster says
 *  covered or excluded, that verdict wins — a stale ignore row must not hide a real exclusion. */
export type ItemDisplayState = AgentAccessItemState | 'ignored';

export const itemDisplayState = (item: AccessItem, userId: string, ignored: IgnoreSet): ItemDisplayState =>
    item.state === 'not-included' && ignored.has(ignoreKey(item.id, userId)) ? 'ignored' : item.state;

/** Covered, ignored and excluded are all settled: an exclusion is the record that a denial was
 *  deliberate (the api's own gap check says so), so like an ignore it is a decision taken, not
 *  outstanding work. Only `not-included` is a gap. */
const isSettled = (item: AccessItem, userId: string, ignored: IgnoreSet): boolean =>
    itemDisplayState(item, userId, ignored) !== 'not-included';

export interface KindCoverage {
    kind: AccessItemKind;
    covered: number;
    /** Settled but not covered — counted apart so the pill can read green without lying. */
    ignored: number;
    excluded: number;
    total: number;
    /** `total` minus the ignored and excluded ones: the displayed denominator, so the per-kind count
     *  follows the same rule as "N missing" — decided items are not outstanding work. */
    outstanding: number;
}

export interface AccessSummary {
    total: number;
    ready: number;
    withGaps: number;
    viaGroup: number;
    viaAdmin: number;
}

export const isCovered = (item: AccessItem): boolean => item.state === 'covered';

export const gapItems = (user: AccessUser, ignored: IgnoreSet = NO_IGNORES): AccessItem[] =>
    user.items.filter((item) => !isSettled(item, user.id, ignored));

export const isReady = (user: AccessUser, ignored: IgnoreSet = NO_IGNORES): boolean =>
    gapItems(user, ignored).length === 0;

export const coverageFor = (user: AccessUser, kind: AccessItemKind, ignored: IgnoreSet = NO_IGNORES): KindCoverage => {
    const ofKind = user.items.filter((item) => item.kind === kind);

    const covered = ofKind.filter(isCovered).length;
    const dismissed = ofKind.filter((item) => itemDisplayState(item, user.id, ignored) === 'ignored').length;
    const excluded = ofKind.filter((item) => item.state === 'excluded').length;

    return {
        kind,
        covered,
        ignored: dismissed,
        excluded,
        total: ofKind.length,
        outstanding: ofKind.length - dismissed - excluded,
    };
};

export const coverageByKind = (user: AccessUser, ignored: IgnoreSet = NO_IGNORES): KindCoverage[] =>
    ACCESS_ITEM_KINDS.map((kind) => coverageFor(user, kind, ignored));

/** Totals per kind are the same for every user, so the header count is read off the first row. */
export const totalForKind = (users: AccessUser[], kind: AccessItemKind): number =>
    users[0] ? coverageFor(users[0], kind).total : 0;

export const summarise = (users: AccessUser[], ignored: IgnoreSet = NO_IGNORES): AccessSummary => {
    const actual = users;

    return {
        total: actual.length,
        ready: actual.filter((user) => isReady(user, ignored)).length,
        withGaps: actual.filter((user) => !isReady(user, ignored)).length,
        viaGroup: actual.filter((user) => accessPathOf(user) === 'group').length,
        viaAdmin: actual.filter((user) => accessPathOf(user) === 'admin').length,
    };
};

/** Plain-words answer to "why can they see this?", shown in the How they got access column. */
export const accessPathLabel = (user: AccessUser): string => {
    const path = accessPathOf(user);
    const base = (() => {
        switch (path) {
            case 'direct':
                return 'Added directly';
            case 'group':
                return `Via group: ${user.viaGroups.map((group) => group.name).join(', ')}`;
            case 'admin':
                return 'Admin';
            case 'everyone':
                return 'Open to everyone';
            default:
                return 'Has access';
        }
    })();

    // Admin status is orthogonal to the path, so a directly-added platform admin reads
    // "Added directly · Admin" rather than losing one half of the answer.
    return isAdmin(user) && path !== 'admin' ? `${base} · Admin` : base;
};

/**
 * Someone who reaches the agent only because their platform role bypasses every ACL. They are true,
 * but they are the same 28 people on every agent, so they drown the handful actually granted access.
 */
export const isPlatformAdminOnly = (user: AccessUser): boolean => accessPathOf(user) === 'admin';

/** Either kind of admin, for anything that only needs to say so on the row. */
export const isAdmin = (user: AccessUser): boolean => user.isPlatformAdmin === true || user.isAgentAdmin === true;

/**
 * Whether excluding this person from this item would actually take effect. The api answers it per
 * item, because a person who administers one capability can still be excluded from another; where
 * it does not answer, a platform admin is the one case we can rule out ourselves.
 */
export const canExclude = (user: Pick<AccessUser, 'isPlatformAdmin'>, item: Pick<AccessItem, 'excludable'>): boolean =>
    item.excludable ?? user.isPlatformAdmin !== true;

/**
 * Whether a row is worth ticking for a bulk action. Every state has a verb — a covered row can be
 * excluded or reset, an excluded one granted or reset — so the only genuinely dead row is a covered
 * one the item cannot exclude: Exclude is its only bulk verb, and there it would be stored and
 * ignored. Both surfaces select by this, so a row cannot be pickable on one screen and not the other.
 */
export const isBulkSelectable = (
    canWriteAcl: boolean,
    isCovered: boolean,
    user: Pick<AccessUser, 'isPlatformAdmin'>,
    item: Pick<AccessItem, 'excludable'>,
): boolean => canWriteAcl && !(isCovered && !canExclude(user, item));

/** Excluding someone from the agent itself is ignored for either kind of admin. */
export const canExcludeFromAgent = (user: AccessUser): boolean => !isAdmin(user);

export const ACCESS_PATH_FILTERS = ['direct', 'group', 'admin', 'everyone'] as const;

export const ACCESS_PATH_FILTER_LABEL: Record<(typeof ACCESS_PATH_FILTERS)[number], string> = {
    direct: 'Added directly',
    group: 'Via a security group',
    admin: 'Platform admins',
    everyone: 'Open to everyone',
};

export interface AccessFilters {
    paths: string[];
    /** 'ready' | 'gaps'; empty means both. */
    statuses: string[];
    /** Capability kinds the user is missing at least one of. */
    missingKinds: AccessItemKind[];
}

export const EMPTY_FILTERS: AccessFilters = { paths: [], statuses: [], missingKinds: [] };

export const countActiveFilters = (filters: AccessFilters): number =>
    filters.paths.length + filters.statuses.length + filters.missingKinds.length;

export const matchesFilters = (user: AccessUser, filters: AccessFilters, ignored: IgnoreSet = NO_IGNORES): boolean => {
    if (filters.paths.length && !filters.paths.includes(accessPathOf(user))) return false;

    if (filters.statuses.length) {
        const status = isReady(user, ignored) ? 'ready' : 'gaps';

        if (!filters.statuses.includes(status)) return false;
    }

    // "Missing a connector" means at least one connector is an outstanding gap, not that every one
    // is — and a dismissed one is not outstanding.
    return filters.missingKinds.every((kind) => gapItems(user, ignored).some((item) => item.kind === kind));
};

export const matchesSearch = (user: AccessUser, search: string): boolean => {
    const term = search.trim().toLowerCase();

    if (!term) return true;

    return `${user.name ?? ''} ${user.email ?? ''}`.toLowerCase().includes(term);
};

/** The little of a person the three predictions below read, so the Info tab's review sheet — whose
 *  row shape is its own — can answer with these rules instead of re-deriving them. */
export type CoveragePrincipal = Pick<AccessUser, 'id' | 'isPlatformAdmin' | 'viaGroups'>;

/**
 * The same verdict `hasAclAccess` reaches server-side, from the lists a write is about to send —
 * so a row settles once, on the click, instead of flipping when the refetch lands.
 *
 * `null` means the answer turns on something this screen cannot see: a capability admin list the
 * payload withheld, or membership of a group that does not itself reach the agent. The caller
 * leaves the row alone and lets the refetch answer.
 */
export const predictState = (user: CoveragePrincipal, planned: PlannedAcl): AgentAccessItemState | null => {
    const { includeIds, excludeIds, adminIds, otherIncludeIds, otherExcludeIds } = planned;

    // Platform admins and owners reach every capability by role, before any list is read.
    if (user.isPlatformAdmin) return 'covered';
    if (adminIds === null) return null;
    if (adminIds.includes(user.id)) return 'covered';
    if (excludeIds.includes(user.id)) return 'excluded';
    // A per-user include outranks a group exclusion, so it can be answered without the group lists.
    if (includeIds.includes(user.id)) return 'covered';
    if (otherIncludeIds === null || otherExcludeIds === null) return null;
    // `viaGroups` holds only the groups that reach the agent, so any other group list leaves the
    // verdict open: the user may belong to one of its groups without this screen knowing.
    if (otherExcludeIds.length > 0) return null;
    if (otherIncludeIds.some((groupId) => user.viaGroups.some((group) => group.id === groupId))) return 'covered';
    if (otherIncludeIds.length > 0) return null;

    return includeIds.length === 0 ? 'covered' : 'not-included';
};

/**
 * Why this person already reaches this item, in the server's own order of precedence, as a phrase
 * that finishes "Has access because …".
 *
 * `null` where the answer turns on something this screen cannot see — a list the payload withheld,
 * or membership of a group that does not itself reach the agent — because a guess here would be
 * read as the reason Reset is about to fail.
 */
export const coverageReason = (user: CoveragePrincipal, acl: PrincipalAcl): string | null => {
    const { includeIds, excludeIds, adminIds, otherIncludeIds, otherExcludeIds } = acl;

    if (user.isPlatformAdmin) return 'their role reaches every item';
    if (adminIds === null) return null;
    if (adminIds.includes(user.id)) return 'they administer this item';
    // An exclusion outranks every include below it, so a covered row that carries one is being held
    // open by something this screen is not reading.
    if (excludeIds.includes(user.id)) return null;
    if (includeIds.includes(user.id)) return 'they are named on this item';
    if (otherIncludeIds === null || otherExcludeIds === null) return null;
    if (otherExcludeIds.length > 0) return null;
    if (otherIncludeIds.some((groupId) => user.viaGroups.some((group) => group.id === groupId))) {
        return 'a group they belong to is on this item';
    }
    if (otherIncludeIds.length > 0) return null;

    return includeIds.length === 0 ? 'this item is open to everyone' : null;
};

/**
 * Why a write that succeeded would leave the row exactly as it was. Taking someone off a list
 * changes nothing when the item carries no list at all, or when a group still reaches them — and a
 * silent no-op reads as a broken button, so callers say which of the two it is.
 *
 * This is about the capability, never the agent: someone added directly to the agent still has
 * nothing to remove on a tool that is open to everyone.
 */
export type UnchangedReason = 'open-to-everyone' | 'group-allows';

/** What a write that changed nothing has to say for itself, in one wording for both surfaces: a
 *  silent no-op reads as a broken button wherever it is clicked. */
export const unchangedNotice = (userName: string, itemName: string, reason: UnchangedReason): string => {
    const because = reason === 'open-to-everyone' ? 'it is open to everyone' : 'a group still allows it';

    return `${userName} still has access to \u201C${itemName}\u201D because ${because}.`;
};

/** Why a control is dead, in one wording for the tab and the review sheet alike. Both are about the
 *  capability's own access list: the agent-level right is not what either of them is short of. */
export const NO_ACL_RIGHT_REASON = 'You do not have permission to change this item\u2019s access list.';

export const COVERED_ADMIN_REASON =
    'Excluding this person from this item would be stored and ignored, so it cannot be changed here.';

/** Always \u201Clist\u201D: a capability section, a people list and a group\u2019s members are all one thing to a
 *  reader ticking boxes down them, and three nouns for it read as three different controls. */
export const NOTHING_SELECTABLE_REASON = 'Nothing in this list can be selected.';

export const unchangedReason = (user: CoveragePrincipal, planned: PlannedAcl): UnchangedReason | null => {
    const { includeIds, otherIncludeIds } = planned;

    if (otherIncludeIds === null || includeIds.includes(user.id)) return null;
    if (includeIds.length === 0 && otherIncludeIds.length === 0) return 'open-to-everyone';
    if (otherIncludeIds.some((groupId) => user.viaGroups.some((group) => group.id === groupId))) {
        return 'group-allows';
    }

    return null;
};

/** Buttons name their unit, because a bare number next to a person's row reads as a count of people. */
export const itemCount = (count: number): string => `${count} ${count === 1 ? 'item' : 'items'}`;

export const userCount = (count: number): string => `${count} ${count === 1 ? 'user' : 'users'}`;

/** Every number behind a section's ratio, always all four and always in this order: a row that
 *  drops its zeroes stops lining up with the row above it. */
export const coverageParts = (coverage: KindCoverage): { label: string; value: number }[] => [
    { label: 'granted', value: coverage.covered },
    { label: 'excluded', value: coverage.excluded },
    { label: 'ignored', value: coverage.ignored },
    { label: 'total', value: coverage.total },
];

/** What the ratio should read. The denominator is the work still to decide, except once that work
 *  is done: then it falls back to the total, so a wholly excluded kind says `0/6` rather than the
 *  meaningless `0/0`. With no items at all there is no ratio to show. */
export const coverageRatio = (coverage: KindCoverage): string | null => {
    const { covered, outstanding, total } = coverage;

    if (total === 0) return null;

    return `${covered}/${outstanding === 0 ? total : outstanding}`;
};
