import {
    AlertCircleIcon,
    AlertTriangleIcon,
    CalendarClockIcon,
    CheckCircle2Icon,
    CheckIcon,
    ChevronRightIcon,
    Loader2Icon,
    MinusCircleIcon,
    PlugZapIcon,
    RotateCcwIcon,
} from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import {
    RunFailureActionButton,
    RunReconnectIndicator,
    useNotificationsRoutineRuns,
} from '@/app/components/routine-runs';
import ShowMoreButton from '@/components/show-more-button';
import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { useRoutineRunsInfiniteQuery, useRunRoutineNowMutation } from '@/lib/api/app/routines';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { cn } from '@/lib/utils';
import {
    NEEDS_RECONNECT_RUN_REASON,
    SKIPPED_RUN_REASON,
    type RoutineRunType,
    type RoutineType,
} from '@/types/routines';

import { RUN_STATUS_LABELS, type RunStatusFilter, runStatusFilterLabel, runStatusFilterStatuses } from '../constants';
import { useRunNowToast } from '../hooks/use-run-now-toast';

interface Props {
    routine: RoutineType | null;
    /** Server-side (`GET /routines/:id/runs?status=`): the pages must be filtered, never the loaded rows. */
    statusFilter?: RunStatusFilter;
    /** Present only when the list is inside a dialog that must close before the report opens. */
    onClose?: () => void;
    /** Opens the routine's edit modal, which is where the model, schedule and prompt failures are fixed. */
    onEditRoutine?: () => void;
}

const SKELETON_ROWS = 3;

const ROW_CLASS_NAME =
    'flex w-full items-start gap-3 px-4 py-3 text-left first:rounded-t-2xl last:rounded-b-2xl focus-visible:ring-2 focus-visible:ring-(--color-focus-ring) focus-visible:outline-none';

const statusIcon = (status: RoutineRunType['status']) => {
    if (status === 'failed') return AlertCircleIcon;
    if (status === 'running') return Loader2Icon;
    if (status === 'skipped') return MinusCircleIcon;
    if (status === 'needs_reconnect') return PlugZapIcon;

    return CheckCircle2Icon;
};

const statusTone = (status: RoutineRunType['status']): string => {
    if (status === 'completed') return 'text-success';
    if (status === 'failed') return 'text-destructive';

    return 'text-text-secondary';
};

const TIME_FORMAT: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };

const startOfDay = (date: Date): number => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** Calendar-relative, not "3 days ago": it scans the same way as the Next run column on the list. */
const runWhen = (run: RoutineRunType): string => {
    if (run.status === 'running') return 'Running now';

    const started = new Date(run.startedAt);

    if (Number.isNaN(started.getTime())) return '—';

    const time = started.toLocaleTimeString(undefined, TIME_FORMAT);
    const days = Math.round((startOfDay(new Date()) - startOfDay(started)) / 86_400_000);

    if (days === 0) return `Today, ${time}`;
    if (days === 1) return `Yesterday, ${time}`;

    return `${started.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${time}`;
};

/** The api's reason is shown as written; the id fallback is so a run with no reason is still quotable. */
const runNote = (run: RoutineRunType): string | null => {
    if (run.status === 'failed') {
        if (run.error) return `Run failed — ${run.error}`;

        return `Run failed — we could not determine the cause. Quote run ${run._id} if you ask us to look.`;
    }
    if (run.status === 'needs_reconnect') return run.error || NEEDS_RECONNECT_RUN_REASON;
    if (run.status === 'skipped') return run.error || SKIPPED_RUN_REASON;

    return null;
};

const renderSkeletonRows = () => (
    <ul className="flex flex-col divide-y divide-border">
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <li key={index} className="flex items-start gap-3 px-4 py-3">
                <Skeleton className="mt-0.5 size-4 shrink-0 rounded-full" />
                <Skeleton className="h-5 w-40" />
            </li>
        ))}
    </ul>
);

/** Never the raw enum: `needs_reconnect` is the database's spelling, not a sentence. */
const renderEmpty = (statusFilter: RunStatusFilter) => {
    const isFiltered = statusFilter !== 'all';

    return (
        <div className="routine-runs-empty flex flex-col items-center gap-2 px-4 py-10 text-center">
            <CalendarClockIcon aria-hidden="true" className="size-5 text-text-secondary" />
            <span className="text-sm text-text-secondary">
                {isFiltered ? `No runs under ${runStatusFilterLabel(statusFilter)}` : 'No runs yet'}
            </span>
            <span className="text-xs text-text-secondary">
                {isFiltered
                    ? 'This routine has other runs; switch the filter back to All runs to see them.'
                    : 'Runs appear here after the first schedule fires or you run it manually.'}
            </span>
        </div>
    );
};

const renderLoadError = (message: string, onRetry: () => void) => (
    <div className="routine-runs-error flex flex-col items-center gap-2 px-4 py-10 text-center">
        <AlertTriangleIcon aria-hidden="true" className="size-5 text-destructive" />
        <span className="text-sm text-text-secondary">This history could not be loaded</span>
        <span className="max-w-md text-xs text-text-secondary">{message}</span>
        <Button type="button" size="sm" variant="outline" className="mt-1" onClick={onRetry}>
            Try again
        </Button>
    </div>
);

const RoutineRunsBody = ({ routine, statusFilter = 'all', onClose, onEditRoutine }: Props) => {
    const routineId = routine?._id ?? null;
    const { unreadRunIds, markRead } = useNotificationsRoutineRuns();
    const runNowMutation = useRunRoutineNowMutation();
    const runNowToast = useRunNowToast();
    const statuses = useMemo(() => runStatusFilterStatuses(statusFilter), [statusFilter]);
    const { data, isLoading, isError, error, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } =
        useRoutineRunsInfiniteQuery(routineId, { status: statuses });

    // Offset paging plus polling can hand the same run back on two pages, which would duplicate a React key.
    const runs = useMemo(
        () => [...new Map((data?.pages ?? []).flatMap((page) => page.values).map((run) => [run._id, run])).values()],
        [data],
    );

    // Any run with a conversation opens: the api mints it before the run starts, so a run in flight
    // streams its answer and a failed one carries the reason. A skipped run never started.
    const reportPath = (run: RoutineRunType): string | null => {
        if (run.status === 'skipped') return null;
        if (!run.conversationId || !routine?.agent?.slug) return null;

        return `/agent/${routine.agent.slug}/chat/${run.conversationId}`;
    };

    const onRetry = async () => {
        if (!routine) return;
        try {
            await runNowMutation.mutateAsync(routine._id);
            runNowToast.showStarted();
        } catch (err) {
            runNowToast.showFailure(err);
        }
    };

    // A retry is a fresh run of the routine, so one in-flight retry disables them all.
    const renderRetryButton = () => (
        <SimpleTooltip content="Run again" side="bottom">
            <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Run again"
                className="-my-0.5 shrink-0 rounded-full text-text-secondary hover:bg-accent hover:text-(--text-primary)"
                disabled={runNowMutation.isPending}
                // A failed row is a link to its conversation, and this button sits inside it.
                onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void onRetry();
                }}
            >
                <RotateCcwIcon aria-hidden="true" className="size-3.5" />
            </Button>
        </SimpleTooltip>
    );

    /**
     * A run that never minted a conversation cannot be opened, and opening is what normally clears the
     * unread mark — without this its routine would carry a failure chip nobody can ever dismiss.
     */
    const renderMarkReadButton = (run: RoutineRunType) => (
        <SimpleTooltip content="Mark as read" side="bottom">
            <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Mark as read"
                className="-my-0.5 shrink-0 rounded-full text-text-secondary hover:bg-accent hover:text-(--text-primary)"
                onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    markRead([run._id]);
                }}
            >
                <CheckIcon aria-hidden="true" className="size-3.5" />
            </Button>
        </SimpleTooltip>
    );

    const renderRunBody = (run: RoutineRunType, isLink: boolean) => {
        const Icon = statusIcon(run.status);
        const note = runNote(run);

        return (
            <>
                <SimpleTooltip
                    content={run.status === 'failed' ? run.error : null}
                    className="max-w-72 break-words whitespace-normal"
                >
                    <span className="flex w-5 shrink-0 justify-center">
                        <Icon
                            aria-hidden="true"
                            className={cn(
                                'mt-0.5 size-4',
                                statusTone(run.status),
                                run.status === 'running' && 'animate-spin',
                            )}
                        />
                    </span>
                </SimpleTooltip>
                <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-medium text-(--text-primary)">
                        {/* The icon is aria-hidden, so this is the row's only status text. */}
                        <span className="sr-only">{`${RUN_STATUS_LABELS[run.status]}: `}</span>
                        {runWhen(run)}
                        <span className="font-normal text-text-secondary">
                            {' · '}
                            {run.trigger === 'manual' ? 'Manual' : 'Scheduled'}
                        </span>
                    </span>
                    {note ? (
                        <span
                            className={cn(
                                'flex items-start gap-1 text-xs',
                                run.status === 'failed' ? 'text-destructive' : 'text-text-secondary',
                            )}
                            title={note}
                        >
                            <RunReconnectIndicator run={run} />
                            {/* Wrapped, not truncated: a reason nobody can finish reading is not a reason. */}
                            <span className="line-clamp-2">{note}</span>
                        </span>
                    ) : null}
                    <RunFailureActionButton run={run} onEditRoutine={onEditRoutine} />
                </span>
                {run.status === 'failed' ? renderRetryButton() : null}
                {!isLink && unreadRunIds.has(run._id) ? renderMarkReadButton(run) : null}
                {/* Two reserved slots, not one: the dot and the hover chevron can both be showing, and a
                    shared cell squeezed them together on hover, which read as the dot jumping. The
                    chevron fades rather than toggling display, so neither box changes size on hover. */}
                <span className="mt-0.5 flex shrink-0 items-center gap-1.5">
                    <span className="flex w-2 shrink-0 items-center justify-center">
                        {unreadRunIds.has(run._id) ? (
                            <span aria-label="Unread report" className="size-2 rounded-full bg-primary" />
                        ) : null}
                    </span>
                    <span className="flex w-4 shrink-0 items-center justify-center">
                        {isLink ? (
                            <ChevronRightIcon
                                aria-hidden="true"
                                className="size-4 text-text-secondary opacity-0 group-hover:opacity-100"
                            />
                        ) : null}
                    </span>
                </span>
            </>
        );
    };

    const renderRun = (run: RoutineRunType) => {
        const path = reportPath(run);

        if (!path) {
            return (
                <li key={run._id} className={ROW_CLASS_NAME}>
                    {renderRunBody(run, false)}
                </li>
            );
        }

        return (
            <li key={run._id} className="routine-run-row">
                <Link
                    to={path}
                    className={cn('group text-(--text-primary) no-underline hover:bg-muted/50', ROW_CLASS_NAME)}
                    onClick={() => {
                        // Opening the report is reading it, which is what clears its dot and the routine's chip.
                        if (unreadRunIds.has(run._id)) markRead([run._id]);
                        onClose?.();
                    }}
                >
                    {renderRunBody(run, true)}
                </Link>
            </li>
        );
    };

    if (isLoading) return renderSkeletonRows();

    // A rejected query has an empty list too, and the empty state asserts the routine HAS other runs —
    // a claim about data nobody managed to fetch. Any 400/500/offline read as that sentence before this.
    // Gated on having nothing to show: react-query keeps the last good pages on error, and a dropped
    // poll or a failed Show more must not replace rows the reader is part-way through.
    if (isError && runs.length === 0) {
        return renderLoadError(getApiErrorMessage(error, 'The run history could not be loaded.'), () => void refetch());
    }

    if (runs.length === 0) return renderEmpty(statusFilter);

    // Rows are kept, so the only thing left to say is that the next page did not arrive. Without this a
    // failed Show more stops the spinner, adds nothing and says nothing, and the button invites a retry
    // that looks identical to the click that just failed.
    const renderMoreFooter = () => {
        if (isError) {
            return (
                <li className="routine-runs-more-error flex list-none items-center justify-center gap-2 px-4 py-3 text-xs text-text-secondary">
                    <AlertTriangleIcon aria-hidden="true" className="size-3.5 text-destructive" />
                    More runs could not be loaded.
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-auto px-1 py-0 text-xs"
                        onClick={() => void fetchNextPage()}
                    >
                        Try again
                    </Button>
                </li>
            );
        }

        return (
            <li className="list-none">
                <ShowMoreButton
                    hasMore
                    isLoading={isFetchingNextPage}
                    className="rounded-t-none rounded-b-2xl"
                    onClick={() => void fetchNextPage()}
                />
            </li>
        );
    };

    return (
        <ul className="flex flex-col divide-y divide-border">
            {runs.map(renderRun)}
            {hasNextPage ? renderMoreFooter() : null}
        </ul>
    );
};

export default RoutineRunsBody;
