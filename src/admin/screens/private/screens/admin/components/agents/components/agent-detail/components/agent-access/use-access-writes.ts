import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';

import type { AccessActionMode, PlannedAcl } from '@/lib/api/admin/agent-access-check';
import {
    agentWriteKey,
    enqueueWrite,
    useSetAccessIgnoreMutation,
    useSetCapabilityAccessMutation,
} from '@/lib/api/admin/agent-access-check';
import {
    accessBatchSuccessMessage,
    accessErrorMessage,
    accessFailureMessage,
    accessSuccessMessage,
    batchFailure,
    runAccessBatch,
    useAccessCacheWrites,
    withRefreshDeadline,
} from '@/lib/api/admin/agent-access-writes';
import { adminAgentsApi, AGENTS_QUERY_KEY } from '@/lib/api/admin/agents';

import type { UnchangedReason } from './access-coverage';
import { predictState, unchangedNotice, unchangedReason } from './access-coverage';
import type { AccessItem, AccessUser } from './access-types';

interface UserAcl {
    includeIds: string[];
    excludeIds: string[];
}

/** One user and the items a batch should act on for them. */
export interface AccessBatchEntry {
    user: AccessUser;
    items: AccessItem[];
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
    typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;

const readIds = (value: unknown): string[] | null => {
    if (!Array.isArray(value)) {
        return null;
    }

    const ids: string[] = [];

    for (const entry of value) {
        if (typeof entry === 'string') {
            ids.push(entry);
            continue;
        }

        const id = asRecord(entry)?._id;

        if (typeof id !== 'string') {
            return null;
        }

        ids.push(id);
    }

    return ids;
};

/** The agent answers with the populated `includeUsers` shape and omits the id list, and a list that
 *  is simply absent is empty. A key that is present but unreadable is different: these writes send
 *  full replacement arrays, so guessing there would wipe every other user off the agent. */
const readList = (raw: Record<string, unknown>, idsKey: string, entitiesKey: string): string[] | null => {
    if (raw[idsKey] === undefined && raw[entitiesKey] === undefined) return [];

    // Whichever key actually names people wins: a resource can serialise both and leave one of
    // them empty, and preferring the empty one would PUT away everybody on it.
    const fromEntities = readIds(raw[entitiesKey]);
    const fromIds = readIds(raw[idsKey]);

    if (fromEntities?.length) return fromEntities;
    if (fromIds?.length) return fromIds;

    // Both empty, or one unreadable: a present-but-unreadable key must fail loudly, or an empty
    // sibling would stand in for it and the next PUT would wipe the list.
    if (raw[entitiesKey] !== undefined && fromEntities === null) return null;
    if (raw[idsKey] !== undefined && fromIds === null) return null;

    return [];
};

const readUserAcl = (raw: unknown): UserAcl => {
    const record = asRecord(raw);
    const includeIds = record && readList(record, 'includeUserIds', 'includeUsers');
    const excludeIds = record && readList(record, 'excludeUserIds', 'excludeUsers');

    if (!includeIds || !excludeIds) {
        throw new Error('Could not read who currently has access, so nothing was changed.');
    }

    return { includeIds, excludeIds };
};

const withIds = (ids: string[], added: string[]): string[] => [...ids, ...added.filter((id) => !ids.includes(id))];

const withoutIds = (ids: string[], removed: string[]): string[] => ids.filter((id) => !removed.includes(id));

/**
 * Which of a batch's rows are still to do, so a partial failure keeps exactly those ticked. A write
 * that failed before its batch ever ran reports no rows of its own, and then every row it was given
 * is still outstanding.
 */
const outstandingIds = (isOk: boolean, all: string[], failed: string[]): string[] => {
    if (isOk) return [];

    return failed.length > 0 ? failed : all;
};

/**
 * Every write is optimistic: the caches that drive the table are patched first, the request runs
 * behind, and only a failure is announced — the screen snaps back and a toast says why. A success
 * needs no toast because the row already shows it.
 */
export interface AccessWrites {
    grantItem: (user: AccessUser, item: AccessItem) => Promise<boolean>;
    unblockItem: (user: AccessUser, item: AccessItem) => Promise<boolean>;
    /** Takes one capability away from one user by excluding them from it. */
    revokeItem: (user: AccessUser, item: AccessItem) => Promise<boolean>;
    /** Withdraws both halves of the pair and lets the runtime decide again. */
    resetItem: (user: AccessUser, item: AccessItem) => Promise<boolean>;
    /** Dismisses a gap, or brings a dismissed one back. Never touches an access list. */
    setIgnore: (user: AccessUser, item: AccessItem, ignored: boolean) => Promise<boolean>;
    /** Grants several capabilities to one user in a single batch. Resolves the ids that did not
     *  land, so a partial failure can be retried from the same selection. */
    grantItems: (user: AccessUser, items: AccessItem[]) => Promise<string[]>;
    revokeItems: (user: AccessUser, items: AccessItem[]) => Promise<string[]>;
    /** Dismisses several gaps for one user in a single batch. Never touches an access list. */
    ignoreItems: (user: AccessUser, items: AccessItem[]) => Promise<string[]>;
    /** Withdraws both list entries for several capabilities at once. */
    resetItems: (user: AccessUser, items: AccessItem[]) => Promise<string[]>;
    revokeUser: (user: AccessUser) => Promise<boolean>;
    excludeUser: (user: AccessUser) => Promise<boolean>;
    /** Grants the named items to several users as one batch, so the table refreshes once. Resolves
     *  the ids of the users something is still outstanding for. */
    grantMissing: (entries: AccessBatchEntry[]) => Promise<string[]>;
    /** Dismisses the named gaps for several users. Never touches an access list. */
    ignoreMissing: (entries: AccessBatchEntry[]) => Promise<string[]>;
    /** Takes the agent itself away from several users, in a single agent write. */
    excludeUsers: (users: AccessUser[]) => Promise<boolean>;
    /** Resolves false when the write failed, so the caller can keep its dialog open. */
    includeUsers: (userIds: string[]) => Promise<boolean>;
}

/** Who a batch was for, when it was for more than one person. */
const usersSubject = (entries: AccessBatchEntry[]): string =>
    entries.length === 1 ? entries[0].user.name : `${entries.length} users`;

export const useAccessWrites = (agentId: string): AccessWrites => {
    const queryClient = useQueryClient();
    const { run, invalidateAccess } = useAccessCacheWrites();
    const setCapabilityAccess = useSetCapabilityAccessMutation();
    const setAccessIgnore = useSetAccessIgnoreMutation();

    // Bounded like the refresh `run` performs: these writes have already landed, and a read-back
    // stuck behind a proxy would leave the button that started them spinning for ever.
    const invalidateAgent = useCallback(
        () =>
            withRefreshDeadline(
                Promise.all([queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEY }), invalidateAccess()]),
            ),
        [invalidateAccess, queryClient],
    );

    const applyModeToUsers = useCallback(
        (users: AccessUser[], item: AccessItem, mode: AccessActionMode, onPlanned?: (planned: PlannedAcl) => void) =>
            setCapabilityAccess.mutateAsync({
                mode,
                kind: item.kind,
                itemId: item.id,
                itemName: item.name,
                principalKind: 'user',
                principalIds: users.map((user) => user.id),
                onPlanned,
            }),
        [setCapabilityAccess],
    );

    const applyMode = useCallback(
        (user: AccessUser, item: AccessItem, mode: AccessActionMode, onPlanned?: (planned: PlannedAcl) => void) =>
            applyModeToUsers([user], item, mode, onPlanned),
        [applyModeToUsers],
    );

    const runMode = useCallback(
        (user: AccessUser, item: AccessItem, mode: AccessActionMode, onError: (error: unknown) => string) =>
            run(
                async () => {
                    let unchanged: UnchangedReason | null = null;

                    // The lists as they will stand are the only way to tell a removal that frees
                    // the row from one the server accepts and that changes nothing.
                    await applyMode(user, item, mode, (planned) => {
                        if (predictState(user, planned) === item.state) unchanged = unchangedReason(user, planned);
                    });

                    // Only once the write has landed: `onPlanned` runs before the request, and a
                    // refusal there would leave this claiming an outcome that never happened.
                    if (!unchanged) return;

                    toast.info(unchangedNotice(user.name, item.name, unchanged));
                },
                { success: accessSuccessMessage(mode, user.name, item.name), error: onError },
            ),
        [applyMode, run],
    );

    const grantItem = useCallback(
        (user: AccessUser, item: AccessItem) =>
            runMode(user, item, 'grant', (error) =>
                accessErrorMessage(error, item.name, accessFailureMessage('grant', user.name, item.name)),
            ),
        [runMode],
    );

    // `unblock`, not `clear`: an existing include must survive, or a user who was both included and
    // excluded ends up undecided instead of allowed.
    const unblockItem = useCallback(
        (user: AccessUser, item: AccessItem) =>
            runMode(user, item, 'unblock', (error) =>
                accessErrorMessage(error, item.name, accessFailureMessage('unblock', user.name, item.name)),
            ),
        [runMode],
    );

    // An exclusion is the only definitive revoke: the user may be covered by a group or by an open
    // list, and dropping a per-user include would not touch either.
    const revokeItem = useCallback(
        (user: AccessUser, item: AccessItem) =>
            runMode(user, item, 'revoke', (error) =>
                accessErrorMessage(error, item.name, accessFailureMessage('revoke', user.name, item.name)),
            ),
        [runMode],
    );

    const resetItem = useCallback(
        (user: AccessUser, item: AccessItem) =>
            runMode(user, item, 'clear', (error) =>
                accessErrorMessage(error, item.name, accessFailureMessage('clear', user.name, item.name)),
            ),
        [runMode],
    );

    const setIgnore = useCallback(
        (user: AccessUser, item: AccessItem, ignored: boolean) =>
            run(
                async () => {
                    await setAccessIgnore.mutateAsync({
                        agentId,
                        capabilityKind: item.kind,
                        capabilityId: item.id,
                        principalKind: 'user',
                        principalId: user.id,
                        ignored,
                    });
                },
                {
                    success: accessSuccessMessage(ignored ? 'ignore' : 'unignore', user.name, item.name),
                    error: (error) =>
                        accessErrorMessage(
                            error,
                            item.name,
                            accessFailureMessage(ignored ? 'ignore' : 'unignore', user.name, item.name),
                        ),
                },
            ),
        [agentId, run, setAccessIgnore],
    );

    const applyToItems = useCallback(
        async (user: AccessUser, items: AccessItem[], mode: Extract<AccessActionMode, 'grant' | 'revoke'>) => {
            let failedIds: string[] = [];

            const isOk = await run(
                async () => {
                    const { failed, firstError } = await runAccessBatch(items, (item) => applyMode(user, item, mode));

                    failedIds = failed.map((item) => item.id);

                    if (failed.length === 0) return;

                    throw batchFailure(
                        failed.map((item) => item.name),
                        items.length,
                        firstError,
                    );
                },
                {
                    success: accessBatchSuccessMessage(mode, user.name, items.length),
                    error: (error) =>
                        accessErrorMessage(
                            error,
                            'these items',
                            mode === 'grant'
                                ? `Could not give ${user.name} access to those items.`
                                : `Could not exclude ${user.name} from those items.`,
                        ),
                },
            );

            return outstandingIds(
                isOk,
                items.map((item) => item.id),
                failedIds,
            );
        },
        [applyMode, run],
    );

    const grantItems = useCallback(
        (user: AccessUser, items: AccessItem[]) => applyToItems(user, items, 'grant'),
        [applyToItems],
    );

    const revokeItems = useCallback(
        (user: AccessUser, items: AccessItem[]) => applyToItems(user, items, 'revoke'),
        [applyToItems],
    );

    const ignoreItems = useCallback(
        async (user: AccessUser, items: AccessItem[]) => {
            let failedIds: string[] = [];

            const isOk = await run(
                async () => {
                    const { failed, firstError } = await runAccessBatch(items, async (item) => {
                        await setAccessIgnore.mutateAsync({
                            agentId,
                            capabilityKind: item.kind,
                            capabilityId: item.id,
                            principalKind: 'user',
                            principalId: user.id,
                            ignored: true,
                        });
                    });

                    failedIds = failed.map((item) => item.id);

                    if (failed.length === 0) return;

                    throw batchFailure(
                        failed.map((item) => item.name),
                        items.length,
                        firstError,
                    );
                },
                {
                    success: accessBatchSuccessMessage('ignore', user.name, items.length),
                    error: (error) => accessErrorMessage(error, 'these items', 'Could not ignore those gaps.'),
                },
            );

            return outstandingIds(
                isOk,
                items.map((item) => item.id),
                failedIds,
            );
        },
        [agentId, run, setAccessIgnore],
    );

    const resetItems = useCallback(
        async (user: AccessUser, items: AccessItem[]) => {
            let failedIds: string[] = [];

            const isOk = await run(
                async () => {
                    const { failed, firstError } = await runAccessBatch(items, (item) =>
                        applyMode(user, item, 'clear'),
                    );

                    failedIds = failed.map((item) => item.id);

                    if (failed.length === 0) return;

                    throw batchFailure(
                        failed.map((item) => item.name),
                        items.length,
                        firstError,
                    );
                },
                {
                    success: accessBatchSuccessMessage('clear', user.name, items.length),
                    error: (error) =>
                        accessErrorMessage(error, 'these items', `Could not reset ${user.name} on those items.`),
                },
            );

            return outstandingIds(
                isOk,
                items.map((item) => item.id),
                failedIds,
            );
        },
        [applyMode, run],
    );

    const revokeUser = useCallback(
        (user: AccessUser) =>
            run(
                async () => {
                    await enqueueWrite(agentWriteKey(agentId), async () => {
                        const acl = readUserAcl(await adminAgentsApi.getBySlugOrId(agentId));

                        await adminAgentsApi.update(agentId, {
                            includeUserIds: withoutIds(acl.includeIds, [user.id]),
                        });
                    });
                    await invalidateAgent();
                },
                {
                    success: `Removed ${user.name}’s access to this agent.`,
                    error: (error) =>
                        accessErrorMessage(error, user.name, `Could not remove ${user.name}’s access to this agent.`),
                },
            ),
        [agentId, invalidateAgent, run],
    );

    const excludeUser = useCallback(
        (user: AccessUser) =>
            run(
                async () => {
                    await enqueueWrite(agentWriteKey(agentId), async () => {
                        const acl = readUserAcl(await adminAgentsApi.getBySlugOrId(agentId));

                        await adminAgentsApi.update(agentId, {
                            excludeUserIds: withIds(acl.excludeIds, [user.id]),
                        });
                    });
                    await invalidateAgent();
                },
                {
                    success: `Excluded ${user.name} from this agent.`,
                    error: (error) =>
                        accessErrorMessage(error, user.name, `Could not exclude ${user.name} from this agent.`),
                },
            ),
        [agentId, invalidateAgent, run],
    );

    const grantMissing = useCallback(
        async (entries: AccessBatchEntry[]) => {
            // A user is only done once every pair of theirs landed, so one refused item keeps that
            // user ticked for the retry.
            let failedUserIds: string[] = [];

            // One ACL write per capability with every chosen person in it: the write is a
            // read-modify-replace of the whole list, so a write per person would repeat it — and
            // they queue on the same key, so it would repeat it one at a time.
            const byItem = new Map<string, { item: AccessItem; users: AccessUser[] }>();

            entries.forEach(({ user, items }) =>
                items.forEach((item) => {
                    const folded = byItem.get(item.id) ?? { item, users: [] };

                    folded.users.push(user);
                    byItem.set(item.id, folded);
                }),
            );

            const writes = [...byItem.values()];
            const isOk = await run(
                async () => {
                    const { failed, firstError } = await runAccessBatch(writes, ({ item, users }) =>
                        applyModeToUsers(users, item, 'grant'),
                    );

                    // One refused capability leaves every person on that write with something
                    // still to do, so their tick stays.
                    failedUserIds = [...new Set(failed.flatMap(({ users }) => users.map((user) => user.id)))];

                    if (failed.length === 0) return;

                    throw batchFailure(
                        failed.map(({ item }) => item.name),
                        writes.length,
                        firstError,
                    );
                },
                {
                    success: accessBatchSuccessMessage('grant', usersSubject(entries), writes.length),
                    error: (error) =>
                        accessErrorMessage(
                            error,
                            'these users',
                            'Could not give those users access to what they were missing.',
                        ),
                },
            );

            return outstandingIds(
                isOk,
                entries.map(({ user }) => user.id),
                failedUserIds,
            );
        },
        [applyModeToUsers, run],
    );

    const ignoreMissing = useCallback(
        async (entries: AccessBatchEntry[]) => {
            let failedUserIds: string[] = [];

            const pairCount = entries.reduce((count, entry) => count + entry.items.length, 0);
            const isOk = await run(
                async () => {
                    const pairs = entries.flatMap(({ user, items }) => items.map((item) => ({ user, item })));
                    const { failed, firstError } = await runAccessBatch(pairs, async ({ user, item }) => {
                        await setAccessIgnore.mutateAsync({
                            agentId,
                            capabilityKind: item.kind,
                            capabilityId: item.id,
                            principalKind: 'user',
                            principalId: user.id,
                            ignored: true,
                        });
                    });

                    failedUserIds = [...new Set(failed.map(({ user }) => user.id))];

                    if (failed.length === 0) return;

                    throw batchFailure(
                        failed.map(({ user, item }) => `${user.name}: ${item.name}`),
                        pairs.length,
                        firstError,
                    );
                },
                {
                    success: accessBatchSuccessMessage('ignore', usersSubject(entries), pairCount),
                    error: (error) => accessErrorMessage(error, 'these users', 'Could not ignore those gaps.'),
                },
            );

            return outstandingIds(
                isOk,
                entries.map(({ user }) => user.id),
                failedUserIds,
            );
        },
        [agentId, run, setAccessIgnore],
    );

    // One read and one PUT for the whole batch: the agent's exclude list is a full replacement
    // array, so writing it once per user would race every other user out of it.
    const excludeUsers = useCallback(
        (users: AccessUser[]) =>
            run(
                async () => {
                    await enqueueWrite(agentWriteKey(agentId), async () => {
                        const acl = readUserAcl(await adminAgentsApi.getBySlugOrId(agentId));

                        await adminAgentsApi.update(agentId, {
                            excludeUserIds: withIds(
                                acl.excludeIds,
                                users.map((user) => user.id),
                            ),
                        });
                    });
                    await invalidateAgent();
                },
                {
                    success: `Removed ${users.length === 1 ? `${users[0].name}’s` : `${users.length} users’`} access to this agent.`,
                    error: (error) =>
                        accessErrorMessage(error, 'these users', 'Could not remove those users’ access to this agent.'),
                },
            ),
        [agentId, invalidateAgent, run],
    );

    // The dialog stays open until the write lands and closes itself on success.
    const includeUsers = useCallback(
        (userIds: string[]) =>
            run(
                async () => {
                    await enqueueWrite(agentWriteKey(agentId), async () => {
                        const acl = readUserAcl(await adminAgentsApi.getBySlugOrId(agentId));

                        await adminAgentsApi.update(agentId, {
                            includeUserIds: withIds(acl.includeIds, userIds),
                            excludeUserIds: withoutIds(acl.excludeIds, userIds),
                        });
                    });
                    await invalidateAgent();
                },
                {
                    success: `Gave ${userIds.length} ${userIds.length === 1 ? 'user' : 'users'} access to this agent.`,
                    error: (error) =>
                        accessErrorMessage(error, 'this agent', 'Could not give those users access to this agent.'),
                },
            ),
        [agentId, invalidateAgent, run],
    );

    return {
        grantItem,
        unblockItem,
        revokeItem,
        resetItem,
        setIgnore,
        grantItems,
        revokeItems,
        ignoreItems,
        resetItems,
        revokeUser,
        excludeUser,
        grantMissing,
        ignoreMissing,
        excludeUsers,
        includeUsers,
    };
};
