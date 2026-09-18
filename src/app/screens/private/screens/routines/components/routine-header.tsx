import {
    ArchiveIcon,
    ArchiveRestoreIcon,
    MoreHorizontalIcon,
    PauseIcon,
    PencilIcon,
    PinIcon,
    PinOffIcon,
    PlayIcon,
    Trash2Icon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRoot,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { RoutineType } from '@/types/routines';

import { nextRunAt } from '../utils/next-run';
import { routineIcon } from '../utils/routine-icon';

import { RoutineStatusBadge } from './routine-status';

interface Props {
    routine: RoutineType;
    isRunPending: boolean;
    isStatusPending: boolean;
    isPinPending: boolean;
    isArchivePending: boolean;
    onRunNow: () => void;
    onToggleStatus: () => void;
    onTogglePin: () => void;
    onToggleArchive: () => void;
    onEdit: () => void;
    onDelete: () => void;
}

const formatNextRun = (next: Date): string =>
    next.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });

const renderNextRunLine = (routine: RoutineType) => {
    const next = nextRunAt(routine);

    return (
        <div className="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
            <span>{next ? `Next run ${formatNextRun(next)}` : 'No further runs scheduled'}</span>
        </div>
    );
};

const renderMoreActionsMenu = (routine: RoutineType, actions: Omit<Props, 'routine' | 'isRunPending' | 'onRunNow'>) => {
    const isArchived = Boolean(routine.archivedAt);
    const isPinned = Boolean(routine.pinnedAt);

    return (
        <DropdownMenuRoot>
            <Tooltip>
                <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label="More actions"
                            className="shrink-0 rounded-full"
                        >
                            <MoreHorizontalIcon className="size-3.5" />
                        </Button>
                    </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom">More actions</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" side="bottom">
                {/* An archived routine is stopped and unpinned by definition, so it can only come back. */}
                {isArchived ? null : (
                    <>
                        <DropdownMenuItem className="cursor-pointer" onClick={actions.onEdit}>
                            <PencilIcon className="size-3.5" />
                            Edit routine
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            className="cursor-pointer"
                            disabled={actions.isStatusPending}
                            onClick={actions.onToggleStatus}
                        >
                            {routine.status === 'active' ? (
                                <PauseIcon className="size-3.5" />
                            ) : (
                                <PlayIcon className="size-3.5" />
                            )}
                            {routine.status === 'active' ? 'Pause' : 'Resume'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            className="cursor-pointer"
                            disabled={actions.isPinPending}
                            onClick={actions.onTogglePin}
                        >
                            {isPinned ? <PinOffIcon className="size-3.5" /> : <PinIcon className="size-3.5" />}
                            {isPinned ? 'Unpin' : 'Pin'}
                        </DropdownMenuItem>
                    </>
                )}
                <DropdownMenuItem
                    className="cursor-pointer"
                    disabled={actions.isArchivePending}
                    onClick={actions.onToggleArchive}
                >
                    {isArchived ? <ArchiveRestoreIcon className="size-3.5" /> : <ArchiveIcon className="size-3.5" />}
                    {isArchived ? 'Unarchive' : 'Archive'}
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" className="cursor-pointer" onClick={actions.onDelete}>
                    <Trash2Icon className="size-3.5" />
                    Delete routine
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenuRoot>
    );
};

const renderIconTile = (routine: Props['routine']) => {
    const Icon = routineIcon(routine.icon);

    return (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Icon aria-hidden="true" className="size-5 text-primary" />
        </span>
    );
};

const RoutineHeader = ({ routine, isRunPending, onRunNow, ...actions }: Props) => (
    <div className="routine-detail-header flex flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
                {renderIconTile(routine)}
                <h1 className="line-clamp-2 text-2xl font-semibold tracking-tight">{routine.name}</h1>
                <RoutineStatusBadge routine={routine} />
            </div>
            <div className="flex shrink-0 items-center gap-2">
                {/* The api rejects firing an archived routine. */}
                {routine.archivedAt ? null : (
                    <Button
                        type="button"
                        size="xs"
                        className="shrink-0 rounded-full"
                        disabled={isRunPending}
                        onClick={onRunNow}
                    >
                        <PlayIcon className="size-3.5" />
                        Run now
                    </Button>
                )}
                {renderMoreActionsMenu(routine, actions)}
            </div>
        </div>
        {renderNextRunLine(routine)}
    </div>
);

export default RoutineHeader;
