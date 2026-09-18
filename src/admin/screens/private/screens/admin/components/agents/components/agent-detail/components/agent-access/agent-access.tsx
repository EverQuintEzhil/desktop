import { isAxiosError } from 'axios';
import { CircleAlert, UserPlus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import QueryStateBoundary from '@/admin/components/query-state-boundary';
import SearchInput from '@/components/search-input';
import Pagination from '@/components/table/components/pagination';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useAgentAccessRosterQuery } from '@/lib/api/admin/agent-access';
import {
    ACCESS_CHECK_IDS_LIMIT,
    capAccessCheckIds,
    useAgentAccessCheckQuery,
} from '@/lib/api/admin/agent-access-check';
import type { AgentType } from '@/types/admin';

import type { AccessFilters as AccessFiltersValue } from './access-coverage';
import type { IgnoresStatus } from './access-coverage';
import {
    canExcludeFromAgent,
    EMPTY_FILTERS,
    gapItems,
    matchesFilters,
    matchesSearch,
    NO_IGNORES,
    summarise,
    userCount,
} from './access-coverage';
import type { AccessItem, AccessUser } from './access-types';
import { ACCESS_ITEM_KINDS, accessPathOf, ignoreKey } from './access-types';
import AccessFilters from './components/access-filters';
import AccessSummary from './components/access-summary';
import AccessTable from './components/access-table';
import IncludeUserDialog from './components/include-user-dialog';
import type { AccessBatchEntry } from './use-access-writes';
import { useAccessWrites } from './use-access-writes';

const PAGE_SIZE = 25;

interface AgentAccessProps {
    agent: AgentType;
    canUserEdit: boolean;
}

const AgentAccess = ({ agent, canUserEdit }: AgentAccessProps) => {
    const [search, setSearch] = useState('');
    const [filters, setFilters] = useState<AccessFiltersValue>(EMPTY_FILTERS);
    const [page, setPage] = useState(1);
    const [isIncludeOpen, setIsIncludeOpen] = useState(false);
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    /** The bulk verb currently on the wire, so the toolbar can show it and refuse a second click. */
    const [pendingBulk, setPendingBulk] = useState<string | null>(null);

    const writes = useAccessWrites(agent._id);

    // The roster is derived server-side from the agent's own lists, so they belong in the cache key:
    // without them an include-list edit serves a roster from before it.
    const includeUserIds = useMemo(() => (agent.includeUsers ?? []).map((user) => user._id), [agent.includeUsers]);
    const includeGroupIds = useMemo(
        () => (agent.includeSecurityGroups ?? []).map((group) => group._id),
        [agent.includeSecurityGroups],
    );
    const capabilitySignature = useMemo(
        () =>
            [...(agent.skills ?? []), ...(agent.mcpServers ?? []), ...(agent.dataStores ?? []), ...(agent.tools ?? [])]
                .map((item) => item._id)
                .sort()
                .join(','),
        [agent],
    );

    const {
        data: roster,
        isLoading,
        isError,
        refetch,
    } = useAgentAccessRosterQuery({
        agentId: agent._id,
        principalSignature: [...includeUserIds, ...includeGroupIds].sort().join(','),
        capabilitySignature,
        enabled: true,
    });

    const users = useMemo(() => roster?.users ?? [], [roster]);

    // Gaps an admin dismissed on the Info tab's review sheet. Without them this tab would call a
    // pair settled there a red gap here — one agent with two verdicts.
    const checkRequest = useMemo(
        () => capAccessCheckIds({ userIds: users.map((user) => user.id), securityGroupIds: [] }),
        [users],
    );
    const {
        data: check,
        error: checkError,
        isError: isCheckError,
        refetch: refetchCheck,
    } = useAgentAccessCheckQuery({
        agentId: agent._id,
        userIds: checkRequest.userIds,
        securityGroupIds: checkRequest.securityGroupIds,
        capabilitySignature,
        enabled: users.length > 0,
    });

    // Until the check has answered, a dismissed pair looks like a live gap — and a Grant on it would
    // override a decision the admin already took. Writes wait for it.
    // A 404 is a tenant whose api has no ignore feature yet: there is nothing to protect, so it
    // is `ready`, not an error.
    const isCheckMissing = isAxiosError(checkError) && checkError.response?.status === 404;
    const ignoresStatus: IgnoresStatus = (() => {
        if (isCheckError) return isCheckMissing ? 'ready' : 'error';
        if (users.length > 0 && !check) return 'loading';

        return 'ready';
    })();

    // A partial read must say so: a dismissed pair dropped from the payload would otherwise look
    // like a live gap, and a Grant on it would override a decision the UI never showed.
    const droppedCount = (roster?.droppedCount ?? 0) + (check?.droppedCount ?? 0);

    const ignored = useMemo(() => {
        if (!check) return NO_IGNORES;

        return new Set(
            check.ignoredItems.flatMap((item) =>
                item.principals.filter((p) => p.kind === 'user').map((p) => ignoreKey(item.id, p.id)),
            ),
        );
    }, [check]);

    // Agent-level writes (include, revoke, exclude) ride the agent PUT permission; per-item Grant
    // and Unblock are gated separately on the item's own `canGrant`, which the API sets per caller.
    const canEdit = canUserEdit;

    // Platform admins are opt-in: they reach every agent by role, so listing them by default buries
    // the handful of people actually granted access. Ticking their filter brings them back.
    const showAdmins = filters.paths.includes('admin');

    const matched = useMemo(
        () =>
            users
                .filter((user) => showAdmins || accessPathOf(user) !== 'admin')
                .filter((user) => matchesSearch(user, search))
                .filter((user) => matchesFilters(user, filters, ignored)),
        [users, search, filters, showAdmins, ignored],
    );

    // Hiding admins is invisible in the toolbar, so an agent reached only by them would otherwise
    // read as "No users match" against a summary that counts every one of them.
    const isHidingOnlyAdmins =
        !showAdmins && matched.length === 0 && users.every((user) => accessPathOf(user) === 'admin');

    const pageCount = Math.max(1, Math.ceil(matched.length / PAGE_SIZE));
    const visibleUsers = matched.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    // A narrowed list can leave the reader on a page that no longer exists, showing an empty table
    // while the count says otherwise.
    useEffect(() => {
        setPage((current) => Math.min(current, pageCount));
    }, [pageCount]);

    const summary = useMemo(() => summarise(users, ignored), [users, ignored]);

    const pathCounts = useMemo(
        () =>
            users.reduce<Record<string, number>>((counts, user) => {
                const path = accessPathOf(user);

                counts[path] = (counts[path] ?? 0) + 1;

                return counts;
            }, {}),
        [users],
    );

    // Resolved against the filtered list rather than the raw roster: a pick a filter has since
    // hidden must not be acted on by a button whose count cannot show it.
    const selectedUsers = useMemo(
        () => matched.filter((user) => selectedUserIds.includes(user.id)),
        [matched, selectedUserIds],
    );

    const toggleUser = (userId: string) =>
        setSelectedUserIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));

    const toggleVisible = (select: boolean) =>
        setSelectedUserIds((prev) => {
            const ids = visibleUsers.map((user) => user.id);
            const rest = prev.filter((id) => !ids.includes(id));

            return select ? [...rest, ...ids] : rest;
        });

    // A dismissed gap is a decision already taken, so neither batch reopens one: these counts read
    // the same as the "N missing" pill on the row.
    const entriesOf = (only: (item: AccessItem) => boolean): AccessBatchEntry[] =>
        selectedUsers
            .map((user) => ({ user, items: gapItems(user, ignored).filter(only) }))
            .filter((entry) => entry.items.length > 0);

    // An item the api refuses this caller is skipped rather than failing the batch, so a button
    // only appears when it has something to do.
    const toGrant = entriesOf((item) => item.canGrant !== false);
    // Ignoring is agent-scoped, so it needs only the agent-edit right the toolbar already has.
    const toIgnore = entriesOf(() => true);
    const toRemove = selectedUsers.filter(canExcludeFromAgent);

    const isLocked = ignoresStatus !== 'ready';

    // Only the users the batch actually finished lose their tick — a pick it skipped, and a pick a
    // partial failure left outstanding, is still someone's pending work to retry.
    const runBatch = (label: string, covered: AccessUser[], write: Promise<string[]>) => {
        setPendingBulk(label);
        void write
            .then((outstanding) => {
                const done = covered.map((user) => user.id).filter((id) => !outstanding.includes(id));

                setSelectedUserIds((prev) => prev.filter((id) => !done.includes(id)));
            })
            .finally(() => setPendingBulk(null));
    };

    /** One agent write lands whole or not at all, so its outcome names either nobody or everybody. */
    const allOrNothing = (users: AccessUser[], write: Promise<boolean>): Promise<string[]> =>
        write.then((isOk) => (isOk ? [] : users.map((user) => user.id)));

    // One batch at a time: while it runs every verb on the toolbar is dead, and the one that
    // started it says so — nothing on the rows moves until the server has answered.
    const renderBulkAction = (
        label: string,
        users: AccessUser[],
        write: () => Promise<string[]>,
        className?: string,
    ) => {
        if (users.length === 0) return null;

        return (
            <Button
                size="xs"
                variant={label === 'Grant all' ? 'default' : 'outline'}
                className={className}
                disabled={isLocked || pendingBulk !== null}
                onClick={() => runBatch(label, users, write())}
            >
                {pendingBulk === label && <Spinner className="size-3.5" />}
                {label}
            </Button>
        );
    };

    const renderBulkActions = () => (
        <>
            <span className="text-xs whitespace-nowrap text-text-secondary">
                {userCount(selectedUsers.length)} selected
            </span>
            <span className="ml-auto flex flex-wrap items-center gap-2">
                {renderBulkAction(
                    'Grant all',
                    toGrant.map((entry) => entry.user),
                    () => writes.grantMissing(toGrant),
                )}
                {renderBulkAction(
                    'Ignore all',
                    toIgnore.map((entry) => entry.user),
                    () => writes.ignoreMissing(toIgnore),
                    'text-text-secondary',
                )}
                {renderBulkAction(
                    'Exclude all',
                    toRemove,
                    () => allOrNothing(toRemove, writes.excludeUsers(toRemove)),
                    'text-destructive hover:bg-destructive/10',
                )}
                <Button
                    size="xs"
                    variant="ghost"
                    className="text-text-secondary"
                    disabled={pendingBulk !== null}
                    onClick={() => setSelectedUserIds([])}
                >
                    Clear
                </Button>
            </span>
        </>
    );

    const renderFilterActions = () => (
        <>
            <SearchInput
                search={search}
                onChange={setSearch}
                placeholder="Search users…"
                className="max-w-[240px] flex-1"
                inputClassName="h-6! text-xs shadow-none! focus:border-primary focus:ring-0!"
                searchOnChange
                autoFocus={false}
            />
            <span className="ml-auto flex items-center gap-2">
                <AccessFilters value={filters} onChange={setFilters} pathCounts={pathCounts} />
                {canEdit && (
                    <Button size="xs" className="rounded-full" onClick={() => setIsIncludeOpen(true)}>
                        <UserPlus className="size-4" />
                        Include users
                    </Button>
                )}
            </span>
        </>
    );

    return (
        <div className="tab-content agent-tab agent-access flex flex-col gap-4">
            <QueryStateBoundary
                isError={isError}
                hasData={roster !== undefined}
                isLoading={isLoading}
                onRetry={() => refetch()}
                errorMessage="Could not load who has access to this agent."
            >
                <AccessSummary summary={summary} />
                {/* Both rows are the same height and share this container, so a tick swaps the
                    controls without moving anything below them. */}
                {/* One fixed height for both toolbars: ticking a user swaps their contents, and a
                    row that grew or shrank would shift the whole table under the pointer. */}
                <div className="access-toolbar flex min-h-6 items-center gap-3">
                    {selectedUsers.length > 0 ? renderBulkActions() : renderFilterActions()}
                </div>
                {ignoresStatus === 'error' && (
                    <span className="access-check-error flex items-center gap-2 text-sm text-destructive">
                        <CircleAlert className="size-4 shrink-0" />
                        Could not load which gaps were ignored, so changes are paused until it can.
                        <Button size="xs" variant="outline" onClick={() => void refetchCheck()}>
                            Retry
                        </Button>
                    </span>
                )}
                {droppedCount > 0 && (
                    <span className="access-dropped-notice text-sm text-text-secondary">
                        {droppedCount} {droppedCount === 1 ? 'entry' : 'entries'} could not be read and{' '}
                        {droppedCount === 1 ? 'is' : 'are'} not shown here.
                    </span>
                )}
                {checkRequest.isCapped && (
                    <span className="access-cap-notice text-sm text-text-secondary">
                        Ignored gaps are loaded for the first {ACCESS_CHECK_IDS_LIMIT} users only; later rows may show a
                        dismissed gap as missing.
                    </span>
                )}
                {users.length === 0 ? (
                    <span className="text-sm text-text-secondary">
                        Nobody can reach this agent yet. Include a user to get started.
                    </span>
                ) : (
                    <AccessTable
                        users={visibleUsers}
                        allUsers={users}
                        ignored={ignored}
                        ignoresStatus={ignoresStatus}
                        kinds={ACCESS_ITEM_KINDS}
                        canEdit={canEdit}
                        writes={writes}
                        selectedIds={selectedUserIds}
                        onToggleUser={toggleUser}
                        onToggleVisible={toggleVisible}
                        emptyMessage={
                            isHidingOnlyAdmins
                                ? 'Only platform admins can reach this agent. Filter by platform admins to see them.'
                                : 'No users match.'
                        }
                    />
                )}
                {matched.length > PAGE_SIZE && (
                    <div className="access-pagination flex items-center justify-between gap-3">
                        <span className="text-sm text-text-secondary tabular-nums">
                            {`${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, matched.length)} of ${matched.length}`}
                        </span>
                        <Pagination count={pageCount} page={page} onChange={setPage} />
                    </div>
                )}
            </QueryStateBoundary>
            {canEdit && (
                <IncludeUserDialog
                    isOpen={isIncludeOpen}
                    existingUserIds={users.map((user) => user.id)}
                    onClose={() => setIsIncludeOpen(false)}
                    onInclude={writes.includeUsers}
                />
            )}
        </div>
    );
};

export default AgentAccess;
