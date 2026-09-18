import { ArchiveIcon, CheckIcon, PauseIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { RoutineType } from '@/types/routines';

/** A one-shot that has already fired can never fire again, so it reads as finished rather than active. */
export const isSpentRoutine = (routine: RoutineType): boolean => routine.runOnce && Boolean(routine.lastRunAt);

export type RoutineStatusLabel = 'Active' | 'Paused' | 'Done' | 'Archived';

/** `status` only ever says active or paused; archived-ness lives in `archivedAt` or is asserted by the caller. */
export const routineStatusLabel = (routine: RoutineType, isArchived = false): RoutineStatusLabel => {
    if (isArchived || routine.archivedAt) return 'Archived';
    if (isSpentRoutine(routine)) return 'Done';
    if (routine.status === 'paused') return 'Paused';

    return 'Active';
};

const statusIcon = (label: RoutineStatusLabel) => {
    if (label === 'Paused') return PauseIcon;
    if (label === 'Archived') return ArchiveIcon;

    return CheckIcon;
};

interface Props {
    routine: RoutineType;
    isArchived?: boolean;
    className?: string;
}

export const RoutineStatusBadge = ({ routine, isArchived }: Pick<Props, 'routine' | 'isArchived'>) => {
    const label = routineStatusLabel(routine, isArchived);
    const Icon = statusIcon(label);

    return (
        <Badge
            variant="outline"
            className={cn('rounded-full', label === 'Active' && 'border-success/30 bg-success/10 text-success')}
        >
            <Icon aria-hidden="true" className="size-3" />
            {label}
        </Badge>
    );
};

const RoutineStatus = ({ routine, isArchived, className }: Props) => {
    const label = routineStatusLabel(routine, isArchived);
    const Icon = statusIcon(label);
    const isActive = label === 'Active';

    return (
        <span
            className={cn(
                'routine-status flex w-fit items-center gap-1.5 rounded-full text-sm whitespace-nowrap',
                isActive ? 'bg-success/10 px-2 py-0.5 text-success' : 'text-muted-foreground',
                className,
            )}
        >
            <Icon aria-hidden="true" className={cn('size-3.5', isActive ? 'text-success' : 'text-muted-foreground')} />
            {label}
        </span>
    );
};

export default RoutineStatus;
