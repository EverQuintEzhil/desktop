import { ChevronDown, ChevronUp, Globe, ShieldCheck, User, Users } from 'lucide-react';
import type React from 'react';
import { Fragment, useState } from 'react';

import Avatar from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableScrollArea } from '@/components/ui/table';
import { cn } from '@/lib/utils';

import type { IgnoreSet, IgnoresStatus } from '../access-coverage';
import { accessPathLabel, coverageFor, coverageRatio, totalForKind } from '../access-coverage';
import type { AccessItemKind, AccessPath, AccessUser } from '../access-types';
import { ACCESS_ITEM_KIND_PLURAL, accessPathOf } from '../access-types';
import type { AccessWrites } from '../use-access-writes';

import AccessGapBreakdown from './access-gap-breakdown';
import CoverageCounts from './coverage-counts';

interface AccessTableProps {
    users: AccessUser[];
    /** The unfiltered roster: per-kind header totals must not shrink when a filter hides every row. */
    allUsers: AccessUser[];
    ignored: IgnoreSet;
    ignoresStatus: IgnoresStatus;
    kinds: readonly AccessItemKind[];
    canEdit: boolean;
    writes: AccessWrites;
    emptyMessage: string;
    /** Ids of every picked user, across pages; the header box only ever speaks for this page. */
    selectedIds: string[];
    onToggleUser: (userId: string) => void;
    onToggleVisible: (select: boolean) => void;
}

const PATH_ICON: Record<AccessPath, typeof User> = {
    direct: User,
    group: Users,
    admin: ShieldCheck,
    everyone: Globe,
};

const AccessTable = ({
    users,
    allUsers,
    ignored,
    ignoresStatus,
    kinds,
    canEdit,
    writes,
    emptyMessage,
    selectedIds,
    onToggleUser,
    onToggleVisible,
}: AccessTableProps) => {
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const toggle = (userId: string) =>
        setExpandedIds((prev) => {
            const next = new Set(prev);

            if (!next.delete(userId)) next.add(userId);

            return next;
        });

    const selectedVisible = users.filter((user) => selectedIds.includes(user.id));
    const columnCount = kinds.length + (canEdit ? 4 : 3);

    // The whole row toggles on click, so a tick would expand the person as well.
    const stop = (event: React.SyntheticEvent) => event.stopPropagation();

    // The table keeps its natural column widths and the container scrolls: squeezing it instead
    // stacks the header labels.
    return (
        <TableScrollArea className="access-table rounded-lg">
            <Table className="min-w-[780px]">
                <TableHeader>
                    <TableRow>
                        {canEdit && (
                            <TableHead className="w-10">
                                <Checkbox
                                    className="cursor-pointer"
                                    checked={selectedVisible.length > 0 && selectedVisible.length === users.length}
                                    indeterminate={selectedVisible.length > 0 && selectedVisible.length < users.length}
                                    disabled={users.length === 0}
                                    onChange={() => onToggleVisible(selectedVisible.length !== users.length)}
                                    aria-label="Select every user on this page"
                                />
                            </TableHead>
                        )}
                        <TableHead className="whitespace-nowrap">User</TableHead>
                        <TableHead className="whitespace-nowrap">How they got access</TableHead>
                        {kinds.map((kind) => (
                            <TableHead key={kind} className="text-center whitespace-nowrap">
                                {ACCESS_ITEM_KIND_PLURAL[kind]} ({totalForKind(allUsers, kind)})
                            </TableHead>
                        ))}
                        <TableHead className="text-right" />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {users.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={columnCount} className="text-sm text-text-secondary">
                                {emptyMessage}
                            </TableCell>
                        </TableRow>
                    )}
                    {users.map((user) => {
                        const isExpanded = expandedIds.has(user.id);
                        const PathIcon = PATH_ICON[accessPathOf(user)];

                        return (
                            <Fragment key={user.id}>
                                {/* Mouse: the whole row toggles. Keyboard and assistive tech: only the
                                    chevron is the button, because an ARIA button hides every control
                                    nested inside it — and the row now carries a checkbox. */}
                                <TableRow
                                    className={cn('cursor-pointer', isExpanded && 'bg-muted')}
                                    onClick={() => toggle(user.id)}
                                >
                                    {canEdit && (
                                        <TableCell onClick={stop} onKeyDown={stop}>
                                            <Checkbox
                                                className="cursor-pointer"
                                                checked={selectedIds.includes(user.id)}
                                                onChange={() => onToggleUser(user.id)}
                                                aria-label={`Select ${user.name}`}
                                            />
                                        </TableCell>
                                    )}
                                    <TableCell>
                                        <span className="flex items-center gap-2.5">
                                            <Avatar size="sm" src={user.avatar} alt={user.name} />
                                            <span className="flex min-w-0 flex-col">
                                                <span className="truncate font-medium">{user.name}</span>
                                                <span className="truncate text-xs text-text-secondary">
                                                    {user.email}
                                                </span>
                                            </span>
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs whitespace-nowrap text-text-secondary">
                                            <PathIcon className="size-3.5 shrink-0" />
                                            {accessPathLabel(user)}
                                        </span>
                                    </TableCell>
                                    {kinds.map((kind) => {
                                        const coverage = coverageFor(user, kind, ignored);
                                        const { covered, outstanding } = coverage;

                                        return (
                                            <TableCell key={kind} className="text-center">
                                                <SimpleTooltip
                                                    content={<CoverageCounts coverage={coverage} layout="column" />}
                                                >
                                                    {/* Nothing left to decide is neither a win nor a
                                                        problem, so it carries no colour. */}
                                                    <span
                                                        className={cn(
                                                            'font-semibold tabular-nums',
                                                            outstanding === 0 && 'font-normal text-text-secondary',
                                                            outstanding > 0 &&
                                                                (covered < outstanding
                                                                    ? 'text-destructive'
                                                                    : 'text-success'),
                                                        )}
                                                    >
                                                        {coverageRatio(coverage) ?? '—'}
                                                    </span>
                                                </SimpleTooltip>
                                            </TableCell>
                                        );
                                    })}
                                    <TableCell className="text-right whitespace-nowrap">
                                        <button
                                            type="button"
                                            aria-expanded={isExpanded}
                                            aria-label={`${isExpanded ? 'Hide' : 'Show'} what ${user.name} is missing`}
                                            className="flex items-center justify-end rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        >
                                            {isExpanded ? (
                                                <ChevronUp className="size-4 text-text-secondary" />
                                            ) : (
                                                <ChevronDown className="size-4 text-text-secondary" />
                                            )}
                                        </button>
                                    </TableCell>
                                </TableRow>
                                {isExpanded && (
                                    <TableRow>
                                        <TableCell colSpan={columnCount} className="p-0">
                                            <div className="access-expanded px-6 py-3">
                                                <AccessGapBreakdown
                                                    user={user}
                                                    ignored={ignored}
                                                    ignoresStatus={ignoresStatus}
                                                    canEdit={canEdit}
                                                    writes={writes}
                                                />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </Fragment>
                        );
                    })}
                </TableBody>
            </Table>
        </TableScrollArea>
    );
};

export default AccessTable;
