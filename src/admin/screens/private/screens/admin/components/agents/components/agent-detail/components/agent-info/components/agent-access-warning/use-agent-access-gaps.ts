import { useCallback, useMemo } from 'react';

import { usePermissions } from '@/hooks';
import { useAgentAccessRosterQuery, type AgentAccessRosterUser } from '@/lib/api/admin/agent-access';
import {
    ACCESS_CHECK_IDS_LIMIT,
    capAccessCheckIds,
    useAgentAccessCheckQuery,
    type AccessPrincipalKind,
    type AgentAccessCheck,
    type CapabilityKind,
    type PrincipalAccess,
} from '@/lib/api/admin/agent-access-check';
import type { AgentType } from '@/types/admin';

/**
 * What an admin still has to decide about one capability, per principal.
 *
 * `missing` is the only state that asks for anything: the other three each record a decision
 * already taken, so they are listed for context and to be reversed, never counted as a warning.
 */
export type ItemAccessState = 'granted' | 'missing' | 'revoked' | 'ignored';

export interface GapPrincipal {
    id: string;
    kind: AccessPrincipalKind;
    name: string;
    affectedUserCount?: number;
    totalUserCount?: number;
}

export interface AccessGap {
    itemId: string;
    itemName: string;
    itemKind: CapabilityKind;
    /** From the endpoint when it knows; absent means the UI must fall back to its own role check. */
    canGrant?: boolean;
    principals: GapPrincipal[];
}

export interface PrincipalGapItem {
    itemId: string;
    itemName: string;
    itemKind: CapabilityKind;
    canGrant?: boolean;
    /** Absent means the api did not say; false means an exclusion written here would be ignored. */
    excludable?: boolean;
    state: ItemAccessState;
}

export interface ViaGroup {
    id: string;
    name: string;
}

export interface PrincipalGap {
    id: string;
    name: string;
    /** Either kind of administrator, for the row's label alone — being one gates nothing. */
    isAdmin?: boolean;
    /**
     * Platform admins and owners bypass every ACL, so a grant or revoke on their rows records an
     * entry that changes nothing. The sheet shows their coverage and offers no writes.
     */
    bypassesAccessLists?: boolean;
    /**
     * The included groups this person was reached through. Always empty on the Included Users
     * sheet: what puts them there is direct inclusion, so a group name would misstate the reason
     * even for someone who happens to also be in one.
     */
    viaGroups: ViaGroup[];
    items: PrincipalGapItem[];
    /** Items in the `missing` state — what the warning counts, as opposed to what the sheet lists. */
    needsActionCount: number;
}

export interface GroupGapItem {
    itemId: string;
    itemName: string;
    itemKind: CapabilityKind;
    /** Groups only warn or get dismissed — granted/revoked states exist per person, not per group. */
    state: Extract<ItemAccessState, 'missing' | 'ignored'>;
}

/**
 * One included security group and everything it falls short on, member-first: the groups sheet
 * navigates group → member → capability, because access is granted per person, never per group.
 */
export interface GroupGap {
    id: string;
    name: string;
    items: GroupGapItem[];
    /** Items in the `missing` state, the same needs-action measure the people rows use. */
    needsActionCount: number;
    /** Affected members present in `people`, so the detail view resolves rows from one source. */
    memberIds: string[];
}

/** One dismissed capability-and-principal pair, the unit the ignore route is keyed by. */
export interface IgnoredGap {
    itemId: string;
    itemName: string;
    itemKind: CapabilityKind;
    canGrant?: boolean;
    principalId: string;
    principalKind: AccessPrincipalKind;
    principalName: string;
}

export interface UseAgentAccessGapsResult {
    /**
     * Either read failed outright. Distinct from `droppedCount`, which is a partial read: with
     * this set the lists below are not merely short, they are unfounded, and no view may present
     * them as a clean bill of health.
     */
    hasFailedRead: boolean;
    gaps: AccessGap[];
    /** Group-first shape of the same gaps, what the security-groups sheet actually renders. */
    groups: GroupGap[];
    people: PrincipalGap[];
    /** Dismissed gaps, listed separately so an admin can see and undo what is being hidden. */
    ignored: IgnoredGap[];
    affectedGroupCount: number;
    affectedPeopleCount: number;
    affectedItemCount: number;
    /** Elements of either response we could not read, so the sheet can admit the list is partial. */
    droppedCount: number;
    isLoading: boolean;
    /** Both reads again, so a failed one is retried from the sheet rather than by reloading. */
    refetch: () => void;
}

const EMPTY_RESULT: Omit<UseAgentAccessGapsResult, 'isLoading' | 'refetch'> = {
    hasFailedRead: false,
    gaps: [],
    groups: [],
    people: [],
    ignored: [],
    affectedGroupCount: 0,
    affectedPeopleCount: 0,
    affectedItemCount: 0,
    droppedCount: 0,
};

const idsOf = (entities: { _id: string }[] | undefined): string[] => (entities ?? []).map((entity) => entity._id);

const buildCapabilitySignature = (agent: AgentType): string =>
    [...idsOf(agent.skills), ...idsOf(agent.mcpServers), ...idsOf(agent.dataStores), ...idsOf(agent.tools)]
        .sort()
        .join(',');

const pairKeyOf = (itemId: string, principalId: string): string => `${itemId}:${principalId}`;

/**
 * Which Info-tab row a user belongs under is decided by the agent's own include list, which we
 * hold locally: on it means the Included Users row, off it means they were reached through an
 * included group.
 */
const isGroupMember = (principal: PrincipalAccess, includeUserIds: Set<string>): boolean =>
    principal.kind === 'user' && !includeUserIds.has(principal.id);

const toGapPrincipal = (principal: PrincipalAccess): GapPrincipal => ({
    id: principal.id,
    kind: principal.kind,
    name: principal.name,
    affectedUserCount: principal.affectedUserCount,
    totalUserCount: principal.totalUserCount,
});

/** Items whose principals include a security group, keeping the item-first shape. */
const buildGroupGaps = (data: AgentAccessCheck): AccessGap[] => {
    const gaps: AccessGap[] = [];

    data.items.forEach((item) => {
        const principals = item.principals
            .filter((principal) => principal.kind === 'securityGroup')
            .map(toGapPrincipal);

        if (principals.length === 0) return;

        gaps.push({
            itemId: item.id,
            itemName: item.name,
            itemKind: item.kind,
            canGrant: item.canGrant,
            principals,
        });
    });

    return gaps;
};

/**
 * Inverts the item-first gaps into the group-first shape the sheet navigates: which groups fall
 * short, on what, and which of their members are here to act on. Members come from `people` so a
 * write refreshing the gap check reshapes both levels from the same data.
 */
const buildGroupsFromGaps = (includedGroups: ViaGroup[], gaps: AccessGap[], people: PrincipalGap[]): GroupGap[] => {
    const byId = new Map<string, GroupGap>();

    const groupOf = (id: string, name: string): GroupGap => {
        const existing = byId.get(id);
        const group = existing ?? { id, name, items: [], needsActionCount: 0, memberIds: [] };

        if (!existing) byId.set(id, group);

        return group;
    };

    // Seeded from the agent's own list, not from the gaps: a group that falls short of nothing
    // still belongs on this sheet, where an admin goes to see who it lets in.
    includedGroups.forEach((group) => groupOf(group.id, group.name));

    gaps.forEach((gap) => {
        gap.principals.forEach((principal) => {
            groupOf(principal.id, principal.name).items.push({
                itemId: gap.itemId,
                itemName: gap.itemName,
                itemKind: gap.itemKind,
                state: 'missing',
            });
        });
    });

    return [...byId.values()].map((group) => {
        // `people` is in the roster's order, so member order carries over for free.
        const members = people.filter((person) => person.viaGroups.some((via) => via.id === group.id));

        /**
         * An item counts only when a current member actually lacks it. A group can be off an
         * item's access list while every member reaches it another way, and warning about that
         * sends an admin hunting for rows that do not exist.
         *
         * A platform admin is not such a member: their role reaches every capability, so an ACL
         * that omits them is not a shortfall and nothing here could fix it.
         */
        const shortMembers = members.filter((member) => !member.bypassesAccessLists);

        return {
            ...group,
            needsActionCount: group.items.filter(
                (item) =>
                    item.state === 'missing' &&
                    shortMembers.some((member) =>
                        member.items.some(
                            (memberItem) => memberItem.itemId === item.itemId && memberItem.state === 'missing',
                        ),
                    ),
            ).length,
            memberIds: members.map((member) => member.id),
        };
    });
};

const countNeedsAction = (items: PrincipalGapItem[]): number => items.filter((item) => item.state === 'missing').length;

/**
 * Only the platform role reads through every capability ACL, so an ACL that omits one of these
 * people is not a shortfall: nothing can be granted or excluded for them, and counting their rows
 * makes the warning demand work that cannot be done. An agent admin is deliberately not here —
 * capability ACLs do apply to them, so their item rows are genuinely actionable.
 */
const bypassesAccessLists = (user: AgentAccessRosterUser): boolean =>
    user.isPlatformAdmin === true || user.path === 'admin';

/** Both kinds are an administrator to a reader, so both earn the label; neither earns a gate. */
const isAdminUser = (user: AgentAccessRosterUser): boolean => user.isAgentAdmin === true || bypassesAccessLists(user);

/**
 * The users sheet lists every capability the agent uses, not only the ones that fall short, so it
 * is built from the roster rather than the gap check. The gap check still supplies which pairs
 * have been dismissed — the roster reports what the runtime decides and knows nothing about an
 * ignore, which changes no ACL.
 */
const toPersonFromRoster = (user: AgentAccessRosterUser, ignoredKeys: Set<string>): PrincipalGap => {
    const items = user.items.map((item): PrincipalGapItem => {
        const fromRoster = (
            {
                covered: 'granted',
                excluded: 'revoked',
                'not-included': 'missing',
            } as const
        )[item.state];
        // An ignore only ever hides a warning, so it may mask `missing` and nothing else. Once
        // the ACL actually decides the row, that decision is the truth — the ignore is a stale
        // note about a gap that no longer exists.
        const state: ItemAccessState =
            fromRoster === 'missing' && ignoredKeys.has(pairKeyOf(item.id, user.id)) ? 'ignored' : fromRoster;

        return {
            itemId: item.id,
            itemName: item.name,
            itemKind: item.kind,
            canGrant: item.canGrant,
            excludable: item.excludable,
            state,
        };
    });

    const isUnwritable = bypassesAccessLists(user);

    return {
        id: user.id,
        name: user.name,
        isAdmin: isAdminUser(user),
        bypassesAccessLists: isUnwritable,
        viaGroups: user.viaGroups,
        // The roster's own order — kind, then name — kept as it came, so a capability sits in the
        // same place here as it does on the Access tab.
        items,
        needsActionCount: isUnwritable ? 0 : countNeedsAction(items),
    };
};

/**
 * Flat, one row per dismissed pair: the ignore route is keyed by capability *and* principal, so
 * an item dismissed for one person and still warning for another has to be undoable per person.
 */
const buildIgnored = (data: AgentAccessCheck, belongsHere: (principal: PrincipalAccess) => boolean): IgnoredGap[] =>
    data.ignoredItems.flatMap((item) =>
        item.principals.filter(belongsHere).map((principal) => ({
            itemId: item.id,
            itemName: item.name,
            itemKind: item.kind,
            canGrant: item.canGrant,
            principalId: principal.id,
            principalKind: principal.kind,
            principalName: principal.name,
        })),
    );

/**
 * Capabilities a person actually lacks. Deliberately not the gap check's own item list: a group
 * can be off an item's access list while every member reaches it another way, and counting that
 * inflates the warning with work nobody can do.
 */
const countAffectedItems = (people: PrincipalGap[]): number =>
    new Set(
        people
            // Their role reaches everything, so an omitted ACL entry is not a gap to count.
            .filter((person) => !person.bypassesAccessLists)
            .flatMap((person) => person.items.filter((item) => item.state === 'missing').map((item) => item.itemId)),
    ).size;

/**
 * Reads one kind of principal's standing against everything the agent uses. Both Info-tab rows
 * call this with the same agent, and react-query serves them from a single pair of requests.
 */
export const useAgentAccessGaps = (agent: AgentType, principalKind: AccessPrincipalKind): UseAgentAccessGapsResult => {
    const { canAccessible } = usePermissions();
    // Same gate as the admin agents route, which admits developers as well as admins and
    // owners: role alone would both admit a role the route rejects and hide the warning
    // from one it allows.
    const canViewAgents = canAccessible('agents', 'get');

    const userIds = useMemo(() => idsOf(agent.includeUsers), [agent.includeUsers]);
    const securityGroupIds = useMemo(() => idsOf(agent.includeSecurityGroups), [agent.includeSecurityGroups]);
    const includedGroups = useMemo<ViaGroup[]>(
        () => (agent.includeSecurityGroups ?? []).map((group) => ({ id: group._id, name: group.name })),
        [agent.includeSecurityGroups],
    );
    const capabilitySignature = useMemo(() => buildCapabilitySignature(agent), [agent]);

    const hasPrincipals = userIds.length > 0 || securityGroupIds.length > 0;
    const isGroupSheet = principalKind === 'securityGroup';
    // Empty include lists mean the agent is open to every user, so the users sheet reviews the
    // whole roster. The groups sheet has nothing to review until a group is actually included.
    const isEnabled = canViewAgents && (hasPrincipals || !isGroupSheet);

    // Both sheets need it: the users sheet lists every capability from it, and the groups sheet
    // reads a group's full membership from it — the gap check only reports people who fall short.
    const {
        data: roster,
        isLoading: isRosterLoading,
        isError: isRosterError,
        refetch: refetchRoster,
    } = useAgentAccessRosterQuery({
        agentId: agent._id,
        principalSignature: [...userIds, ...securityGroupIds].sort().join(','),
        capabilitySignature,
        enabled: isEnabled,
    });

    /**
     * The check is asked about the roster's own users, never only the include list: a person
     * reached through an included group is on the roster and can be ignored from either surface,
     * and an id the check was not asked about has no `ignoredItems` entry — the dismissal would
     * simply not exist here. Capped because the backend hard-rejects lists over the limit rather
     * than truncating them.
     */
    const checkRequest = useMemo(
        () =>
            capAccessCheckIds({
                // The include list stays in: a listed user the roster could not read still has to
                // be asked about, or a dropped row would also lose its ignores.
                userIds: [...new Set([...userIds, ...(roster?.users ?? []).map((user) => user.id)])],
                securityGroupIds,
            }),
        [userIds, securityGroupIds, roster],
    );

    const {
        data,
        isLoading,
        isError,
        refetch: refetchCheck,
    } = useAgentAccessCheckQuery({
        agentId: agent._id,
        userIds: checkRequest.userIds,
        securityGroupIds: checkRequest.securityGroupIds,
        capabilitySignature,
        // The ids come from the roster, so the check waits for it; asking with empty lists gets the
        // short-circuit answer and caches it.
        enabled:
            isEnabled &&
            roster !== undefined &&
            (checkRequest.userIds.length > 0 || checkRequest.securityGroupIds.length > 0),
    });

    const refetch = useCallback(() => {
        void refetchRoster();
        void refetchCheck();
    }, [refetchCheck, refetchRoster]);

    return useMemo(() => {
        // Both payloads decide every count below, so a verdict formed while one is still in
        // flight is a guess that flips a second later.
        const loading = isLoading || isRosterLoading || (isEnabled && !roster);
        // A read that failed is not a read that found nothing: every count below is derived from
        // these two payloads, so without them silence would be indistinguishable from all-clear.
        const hasFailedRead = isEnabled && (isError || isRosterError);

        // Nothing is computed until both reads land: a partial payload yields zeroes, and zero
        // gaps is exactly what a clean bill of health looks like.
        if (!canViewAgents || !data || loading) {
            return { ...EMPTY_RESULT, hasFailedRead, isLoading: loading, refetch };
        }

        const includeUserIds = new Set(userIds);
        // Open to everyone only when BOTH include lists are empty. An agent with only groups
        // included is not open: its users belong to the groups sheet, not this one.
        const isOpenAccess = userIds.length === 0 && securityGroupIds.length === 0;
        // Same test the people list uses, or an ignore recorded on a sheet would be filtered
        // straight back out of it — which is what happened to every ignore on an open-access
        // agent, whose include list is empty by definition.
        const ownsIgnore = (principal: PrincipalAccess): boolean => {
            if (isGroupSheet) {
                return principal.kind === 'securityGroup' || isGroupMember(principal, includeUserIds);
            }

            return principal.kind === 'user' && (isOpenAccess || includeUserIds.has(principal.id));
        };
        const ignored = buildIgnored(data, ownsIgnore);
        const ignoredKeys = new Set(ignored.map((gap) => pairKeyOf(gap.itemId, gap.principalId)));

        const gaps = isGroupSheet ? buildGroupGaps(data) : [];
        /**
         * Both sheets draw their people from the roster, which reports every capability's state
         * rather than only the shortfalls: a group has to be able to list all of its members, not
         * just the ones who fall short. Which sheet a person belongs to is decided by the agent's
         * own include list — on it means directly included, off it means reached through a group.
         *
         * Someone who reaches the agent only through their platform role is dropped: the role
         * bypasses every ACL, so nothing here can be granted, revoked or warned about, and it is
         * the same admins on every agent.
         */
        const belongsToSheet = (user: AgentAccessRosterUser): boolean => {
            // A group lists its real membership, admins included: they are genuinely in it, and
            // their row says Admin rather than offering writes.
            if (isGroupSheet) return user.viaGroups.length > 0;

            if (bypassesAccessLists(user)) return false;

            return isOpenAccess || includeUserIds.has(user.id);
        };

        // People with gaps lead the list for the same reason their gap rows lead their items.
        const people = (roster?.users ?? [])
            .filter(belongsToSheet)
            .map((user) => toPersonFromRoster(user, ignoredKeys))
            .sort((a, b) => Number(b.needsActionCount > 0) - Number(a.needsActionCount > 0));

        const groups = isGroupSheet ? buildGroupsFromGaps(includedGroups, gaps, people) : [];

        return {
            hasFailedRead,
            gaps,
            groups,
            people,
            ignored,
            affectedGroupCount: groups.filter((group) => group.needsActionCount > 0).length,
            affectedPeopleCount: people.filter((person) => person.needsActionCount > 0).length,
            affectedItemCount: countAffectedItems(people),
            // Both reads feed both sheets now, so an unreadable roster user — which silently
            // shortens a group's member list — has to be admitted on the groups sheet too.
            // A capped request never asked about the users past the limit, so their pairs are
            // missing from the answer the same way an unreadable element is: admit it.
            refetch,
            droppedCount:
                data.droppedCount +
                (roster?.droppedCount ?? 0) +
                (checkRequest.isCapped ? Math.max(0, (roster?.users.length ?? 0) - ACCESS_CHECK_IDS_LIMIT) : 0),
            isLoading: loading,
        };
    }, [
        data,
        roster,
        canViewAgents,
        isLoading,
        isRosterLoading,
        isGroupSheet,
        userIds,
        securityGroupIds,
        includedGroups,
        isEnabled,
        isError,
        isRosterError,
        checkRequest,
        refetch,
    ]);
};
