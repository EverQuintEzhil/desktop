import { CheckIcon, MinusIcon, PlugZapIcon, XIcon } from 'lucide-react';

import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { TableCell } from '@/components/ui/table';
import type { RoutineRunType, RoutineType } from '@/types/routines';
import { formatRelativeTime } from '@/utils/date';

import { describeScheduleWithZone } from '../utils/cron-schedule';
import { nextRunAt } from '../utils/next-run';

const HOUR_MS = 60 * 60 * 1000;

export const formatCreated = (createdAt: string): string => {
    const created = new Date(createdAt);

    if (Number.isNaN(created.getTime())) return '—';

    return created.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatAbsolute = (next: Date): string =>
    next.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });

const formatUntil = (next: Date, now: Date): string | null => {
    const diffMs = next.getTime() - now.getTime();

    if (diffMs < 0 || diffMs >= 24 * HOUR_MS) return null;

    return `in ${formatRelativeTime(next, false)}`;
};

export const renderNextRun = (routine: RoutineType) => {
    const now = new Date();
    const next = nextRunAt(routine, now);

    if (!next) return '—';

    const until = formatUntil(next, now);

    return (
        <span className="flex flex-col leading-5">
            <span className="text-(--text-primary)">{formatAbsolute(next)}</span>
            {until ? <span className="text-xs text-text-secondary">{until}</span> : null}
        </span>
    );
};

// The outcome is a quiet glyph, not a second red word: the failure chip beside the name is the one loud
// signal a row carries, and this stays behind as the permanent record once that chip has been cleared.
const RUN_OUTCOME: Record<Exclude<RoutineRunType['status'], 'running'>, { Icon: typeof CheckIcon; label: string }> = {
    completed: { Icon: CheckIcon, label: 'Completed' },
    needs_reconnect: { Icon: PlugZapIcon, label: 'Needs reconnect' },
    failed: { Icon: XIcon, label: 'Failed' },
    skipped: { Icon: MinusIcon, label: 'Skipped' },
};

export const renderLastRun = (routine: RoutineType, status: RoutineRunType['status'] | null) => {
    if (!routine.lastRunAt) return '—';

    const last = new Date(routine.lastRunAt);

    if (Number.isNaN(last.getTime())) return '—';

    const when = last.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    const outcome = status && status !== 'running' ? RUN_OUTCOME[status] : null;

    return (
        <span className="flex items-center gap-1.5">
            {outcome ? (
                <SimpleTooltip content={outcome.label} side="bottom">
                    <span className="flex shrink-0 text-text-secondary">
                        <outcome.Icon aria-hidden="true" className="size-3.5" />
                        <span className="sr-only">{outcome.label}</span>
                    </span>
                </SimpleTooltip>
            ) : null}
            <span className="text-(--text-primary)">{when}</span>
        </span>
    );
};

/** Capped and truncated: an hourly-window schedule is long enough to push Status out of view. */
export const renderScheduleCell = (routine: RoutineType) => {
    const schedule = describeScheduleWithZone(routine.cron, routine.runOnce, routine.runAt, routine.timezone) || '—';

    return (
        <TableCell className="py-3 text-sm text-text-secondary">
            <span className="block max-w-40 truncate" title={schedule}>
                {schedule}
            </span>
        </TableCell>
    );
};

export const renderRunningDot = (isRunning: boolean) => {
    if (!isRunning) return null;

    return (
        <SimpleTooltip content="Running now" side="bottom">
            <span aria-label="Running now" className="relative flex size-2 shrink-0 text-primary">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-current" />
            </span>
        </SimpleTooltip>
    );
};
