import {
    ArchiveIcon,
    ArchiveRestoreIcon,
    EllipsisIcon,
    HistoryIcon,
    PauseIcon,
    PencilIcon,
    PinIcon,
    PinOffIcon,
    PlayIcon,
    Trash2Icon,
} from 'lucide-react';
import { useRef } from 'react';

import type { RunReconnectTarget } from '@/app/components/routine-runs';
import { Button } from '@/components/ui/button';
import {
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRoot,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableScrollArea } from '@/components/ui/table';
import { useMediaQuery } from '@/hooks';
import { cn } from '@/lib/utils';
import type { RoutineRunType, RoutineType, RunAttentionCounts } from '@/types/routines';

import { describeScheduleWithZone } from '../utils/cron-schedule';
import { routineIcon } from '../utils/routine-icon';

import RoutineAttentionChip from './routine-attention-chip';
import RoutineStatus from './routine-status';
import {
    formatCreated,
    renderLastRun,
    renderNextRun,
    renderRunningDot,
    renderScheduleCell,
} from './routine-table-cells';
import RoutineUnreadChip from './routine-unread-chip';

interface Props {
    routines: readonly RoutineType[];
    showAgent: boolean;
    unreadCount: (routine: RoutineType) => number;
    attentionCounts: (routine: RoutineType) => RunAttentionCounts;
    /** Where the attention chip points: the routine's history filtered to the very statuses it counted. */
    attentionRunsPath: (routine: RoutineType) => string | null;
    /** The single connector the counted runs are waiting on, where they name one and agree on it. */
    attentionReconnect: (routine: RoutineType) => RunReconnectTarget | null;
    /** The newest run's outcome, from the same capped feed; null where the feed does not reach it. */
    lastRunStatus: (routine: RoutineType) => RoutineRunType['status'] | null;
    isRunning: (routine: RoutineType) => boolean;
    isRunPending: (routine: RoutineType) => boolean;
    isStatusPending: (routine: RoutineType) => boolean;
    isPinPending: (routine: RoutineType) => boolean;
    isUnarchivePending: (routine: RoutineType) => boolean;
    onRunNow: (routine: RoutineType) => void;
    onToggleStatus: (routine: RoutineType) => void;
    canOpen: (routine: RoutineType) => boolean;
    onOpen: (routine: RoutineType) => void;
    onEdit: (routine: RoutineType) => void;
    onPin: (routine: RoutineType) => void;
    onArchive: (routine: RoutineType) => void;
    onUnarchive: (routine: RoutineType) => void;
    onDelete: (routine: RoutineType) => void;
}

/** An archived routine has no schedule and the api rejects a fire on it, so it can only come back. */
const isArchived = (routine: RoutineType): boolean => Boolean(routine.archivedAt);

const RoutinesTable = (props: Props) => {
    const { routines, showAgent, onDelete } = props;
    const isCompact = useMediaQuery('(max-width: 639px)');
    // `modal={false}` lets the menu-dismissing click land on the row underneath; holding that row's id (not a flag) swallows exactly that one click.
    const dismissedByRowRef = useRef<string | null>(null);

    const isOpenable = (routine: RoutineType): boolean => !isArchived(routine) && props.canOpen(routine);

    const openRoutine = (routine: RoutineType) => {
        const dismissed = dismissedByRowRef.current;

        dismissedByRowRef.current = null;

        if (isArchived(routine) || dismissed === routine._id) return;

        props.onOpen(routine);
    };

    // A sibling of the open button, never a child: nested interactive elements are invalid.
    const renderPinToggle = (routine: RoutineType) => {
        if (!routine.pinnedAt) return null;

        return (
            <SimpleTooltip content="Unpin" side="bottom">
                <button
                    type="button"
                    aria-label={`Unpin ${routine.name}`}
                    disabled={props.isPinPending(routine)}
                    className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md hover:bg-accent focus-visible:ring-2 focus-visible:ring-(--color-focus-ring) focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
                    onClick={(event) => {
                        event.stopPropagation();
                        props.onPin(routine);
                    }}
                >
                    <PinIcon aria-hidden="true" className="size-3.5 fill-current text-primary" />
                </button>
            </SimpleTooltip>
        );
    };

    // A sibling of the open button, never a child: the chip is a link of its own.
    const renderAttentionChip = (routine: RoutineType) => (
        <RoutineAttentionChip
            counts={props.attentionCounts(routine)}
            routineName={routine.name}
            to={props.attentionRunsPath(routine)}
            reconnect={props.attentionReconnect(routine)}
        />
    );

    const renderName = (routine: RoutineType) => {
        const Icon = routineIcon(routine.icon);
        const content = (
            <>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Icon aria-hidden="true" className="size-4 text-primary" />
                </span>
                {/* A floor, not `min-w-0`: the chips beside the name are all `shrink-0`, so with no floor
                    here the name is the only thing left to give, and it truncated away to nothing. */}
                <span className="flex min-w-20 flex-col">
                    <span className="truncate text-sm font-medium">{routine.name}</span>
                    {/* Under the name rather than in a column: the agent page caps this table at ~890px. */}
                    <span className="truncate text-xs text-text-secondary">{`Created ${formatCreated(routine.createdAt)}`}</span>
                </span>
                <RoutineUnreadChip count={props.unreadCount(routine)} />
            </>
        );

        if (!isOpenable(routine)) {
            return (
                <span className="flex w-full min-w-0 items-center gap-2.5">
                    {content}
                    {renderAttentionChip(routine)}
                    {renderPinToggle(routine)}
                </span>
            );
        }

        return (
            <span className="flex w-full min-w-0 items-center gap-2.5">
                <button
                    type="button"
                    aria-label={`Open ${routine.name}`}
                    // Sized to its content, not the cell: the chips beside it have to read as part of the name.
                    // `min-w-0` so the squeeze reaches the name column inside, which is where the floor is —
                    // without it the button holds its full min-content width and spills over the chip after it.
                    className="flex min-w-0 cursor-pointer items-center gap-2.5 rounded-lg text-left focus-visible:ring-2 focus-visible:ring-(--color-focus-ring) focus-visible:outline-none"
                    onClick={(event) => {
                        // The row carries the same handler; letting this bubble would run it twice.
                        event.stopPropagation();
                        openRoutine(routine);
                    }}
                >
                    {content}
                </button>
                {renderAttentionChip(routine)}
                {renderPinToggle(routine)}
            </span>
        );
    };

    const renderMenuItems = (routine: RoutineType) => {
        if (isArchived(routine)) {
            return (
                <>
                    <DropdownMenuItem
                        className="cursor-pointer"
                        disabled={props.isUnarchivePending(routine)}
                        onSelect={() => props.onUnarchive(routine)}
                    >
                        <ArchiveRestoreIcon aria-hidden="true" className="size-4" />
                        Unarchive
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        variant="destructive"
                        className="cursor-pointer"
                        onSelect={() => onDelete(routine)}
                    >
                        <Trash2Icon aria-hidden="true" className="size-4" />
                        Delete
                    </DropdownMenuItem>
                </>
            );
        }

        const isPaused = routine.status === 'paused';
        const { isRunPending, isStatusPending, isPinPending, onRunNow, onToggleStatus } = props;

        return (
            <>
                <DropdownMenuItem
                    className="cursor-pointer"
                    disabled={isRunPending(routine)}
                    onSelect={() => onRunNow(routine)}
                >
                    <PlayIcon aria-hidden="true" className="size-4" />
                    Run now
                </DropdownMenuItem>
                {isOpenable(routine) ? (
                    <DropdownMenuItem className="cursor-pointer" onSelect={() => props.onOpen(routine)}>
                        <HistoryIcon aria-hidden="true" className="size-4" />
                        Run history
                    </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem
                    className="cursor-pointer"
                    disabled={isStatusPending(routine)}
                    onSelect={() => onToggleStatus(routine)}
                >
                    {isPaused ? (
                        <PlayIcon aria-hidden="true" className="size-4" />
                    ) : (
                        <PauseIcon aria-hidden="true" className="size-4" />
                    )}
                    {isPaused ? 'Resume' : 'Pause'}
                </DropdownMenuItem>
                <DropdownMenuItem
                    className="cursor-pointer"
                    disabled={isPinPending(routine)}
                    onSelect={() => props.onPin(routine)}
                >
                    {routine.pinnedAt ? (
                        <PinOffIcon aria-hidden="true" className="size-4" />
                    ) : (
                        <PinIcon aria-hidden="true" className="size-4" />
                    )}
                    {routine.pinnedAt ? 'Unpin' : 'Pin'}
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" onSelect={() => props.onEdit(routine)}>
                    <PencilIcon aria-hidden="true" className="size-4" />
                    Edit
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" onSelect={() => props.onArchive(routine)}>
                    <ArchiveIcon aria-hidden="true" className="size-4" />
                    Archive
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" className="cursor-pointer" onSelect={() => onDelete(routine)}>
                    <Trash2Icon aria-hidden="true" className="size-4" />
                    Delete
                </DropdownMenuItem>
            </>
        );
    };

    // The whole row opens the routine, so the menu has to keep its own clicks and keys to itself.
    const renderActions = (routine: RoutineType) => (
        <span
            role="presentation"
            className="inline-flex"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
        >
            <DropdownMenuRoot modal={false} onOpenChange={(isOpen) => isOpen && (dismissedByRowRef.current = null)}>
                <DropdownMenuTrigger asChild>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Actions for ${routine.name}`}
                        className="shrink-0 text-(--text-secondary) hover:bg-accent hover:text-(--text-primary)"
                    >
                        <EllipsisIcon aria-hidden="true" className="size-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align="end"
                    className="w-48"
                    onPointerDownOutside={(event) => {
                        // Matches both presentations: table rows and mobile cards carry data-routine-id.
                        const row = (event.detail.originalEvent.target as HTMLElement | null)?.closest(
                            '[data-routine-id]',
                        );

                        dismissedByRowRef.current = row instanceof HTMLElement ? (row.dataset.routineId ?? null) : null;
                    }}
                >
                    {renderMenuItems(routine)}
                </DropdownMenuContent>
            </DropdownMenuRoot>
        </span>
    );

    const rowActivation = (routine: RoutineType) =>
        isOpenable(routine) ? { className: 'cursor-pointer', onClick: () => openRoutine(routine) } : {};

    const renderCard = (routine: RoutineType) => {
        const openable = isOpenable(routine);

        return (
            <li
                key={routine._id}
                data-routine-id={routine._id}
                className={cn(
                    'flex flex-col gap-2 rounded-2xl border border-border bg-card p-4',
                    openable && 'cursor-pointer hover:bg-muted/50',
                )}
                {...(openable ? { onClick: () => openRoutine(routine) } : {})}
            >
                <div className="flex items-center gap-2.5">
                    {renderName(routine)}
                    {renderActions(routine)}
                </div>
                <span className="text-sm text-text-secondary">
                    {describeScheduleWithZone(routine.cron, routine.runOnce, routine.runAt, routine.timezone) || '—'}
                </span>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm">{renderNextRun(routine)}</span>
                    <span className="flex items-center gap-1.5">
                        <RoutineStatus routine={routine} isArchived={isArchived(routine)} />
                        {renderRunningDot(props.isRunning(routine))}
                    </span>
                </div>
                {showAgent ? <span className="text-xs text-text-secondary">{routine.agent?.name ?? '—'}</span> : null}
                {routine.lastRunAt ? (
                    <span className="text-xs">
                        <span className="text-text-secondary">Last run </span>
                        {renderLastRun(routine, props.lastRunStatus(routine))}
                    </span>
                ) : null}
            </li>
        );
    };

    // Branched on the query, not CSS-hidden, so only one presentation exists in the DOM.
    if (isCompact) return <ul className="routines-card-list flex flex-col gap-3">{props.routines.map(renderCard)}</ul>;

    return (
        <div className="rounded-2xl border border-border bg-card">
            <TableScrollArea className="scrollbar-controller scrollbar-horizontal">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-full max-w-0 min-w-72 pl-4 text-xs font-medium text-text-secondary">
                                Routine
                            </TableHead>
                            <TableHead className="text-xs font-medium whitespace-nowrap text-text-secondary">
                                Schedule
                            </TableHead>
                            <TableHead className="text-xs font-medium whitespace-nowrap text-text-secondary">
                                Next run
                            </TableHead>
                            <TableHead className="text-xs font-medium whitespace-nowrap text-text-secondary">
                                Last run
                            </TableHead>
                            <TableHead className="text-xs font-medium whitespace-nowrap text-text-secondary">
                                Status
                            </TableHead>
                            {showAgent ? (
                                <TableHead className="text-xs font-medium whitespace-nowrap text-text-secondary">
                                    Agent
                                </TableHead>
                            ) : null}
                            <TableHead className="w-12 pr-4" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {routines.map((routine) => (
                            <TableRow key={routine._id} data-routine-id={routine._id} {...rowActivation(routine)}>
                                {/* `max-w-0` makes the name truncate instead of widening the table, and the wrapper needs `w-full min-w-0` or it overflows the bounded cell. */}
                                {/* Floored at this cell's own worst case — icon, name, both chips, pin — because all
                                    but the name are `shrink-0`, so a tighter floor is met by them spilling into
                                    Schedule rather than by anything giving way. */}
                                <TableCell className="w-full max-w-0 min-w-72 py-3 pl-4">
                                    {renderName(routine)}
                                </TableCell>
                                {renderScheduleCell(routine)}
                                <TableCell className="py-3 text-sm whitespace-nowrap">
                                    {renderNextRun(routine)}
                                </TableCell>
                                <TableCell className="py-3 text-sm whitespace-nowrap">
                                    {renderLastRun(routine, props.lastRunStatus(routine))}
                                </TableCell>
                                <TableCell className="py-3 text-text-secondary">
                                    <span className="flex items-center gap-1.5">
                                        <RoutineStatus routine={routine} isArchived={isArchived(routine)} />
                                        {renderRunningDot(props.isRunning(routine))}
                                    </span>
                                </TableCell>
                                {showAgent ? (
                                    <TableCell className="py-3 text-sm whitespace-nowrap text-text-secondary">
                                        {routine.agent?.name ?? '—'}
                                    </TableCell>
                                ) : null}
                                <TableCell className="py-3 pr-4 text-right">{renderActions(routine)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableScrollArea>
        </div>
    );
};

export default RoutinesTable;
