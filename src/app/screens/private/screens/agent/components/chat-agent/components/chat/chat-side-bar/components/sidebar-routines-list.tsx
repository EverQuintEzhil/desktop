import { CheckIcon, ExternalLinkIcon, MoreHorizontalIcon, PauseIcon, PlayIcon, ZapIcon } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import ConversationStatusIndicator from '@/app/components/conversation-status-indicator';
import { useNotificationsRoutineRuns } from '@/app/components/routine-runs';
import {
    attentionRunStatusFilter,
    ROUTINE_SORT_PARAM,
    RUN_ATTENTION_ICONS,
    runAttentionLabel,
    runAttentionTone,
    runAttentionTotal,
    type RunStatusFilter,
    runStatusFilterStatuses,
} from '@/app/screens/private/screens/routines/constants';
import { useRunNowToast } from '@/app/screens/private/screens/routines/hooks/use-run-now-toast';
import { routineIcon } from '@/app/screens/private/screens/routines/utils/routine-icon';
import { Button } from '@/components/ui/button';
import {
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRoot,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    useAllRoutineRunsQuery,
    usePauseRoutineMutation,
    useResumeRoutineMutation,
    useRoutinesQuery,
    useRunRoutineNowMutation,
} from '@/lib/api/app/routines';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { cn } from '@/lib/utils';
import {
    EMPTY_RUN_ATTENTION,
    isRunAttentionStatus,
    type RoutineRunStatus,
    type RoutineRunType,
    type RoutineType,
    type RunAttentionCounts,
} from '@/types/routines';
import { showErrorToast } from '@/utils';

const SIDEBAR_ROUTINE_LIMIT = 5;

interface Props {
    id: string;
    agentId: string;
    agentSlug: string;
    isCollapsed: boolean;
    /** `chat/<id>` of the open conversation, so the routine that produced it can be highlighted. */
    activePath?: string;
    onMobileClose?: () => void;
}

interface RoutineFeed {
    unread: number;
    attention: RunAttentionCounts;
    running: boolean;
}

const buildReportPath = (run: RoutineRunType): string | null => {
    const slug = run.routine?.agent?.slug;

    if (run.status !== 'completed' || !run.conversationId || !slug) return null;

    return `/agent/${slug}/chat/${run.conversationId}`;
};

const buildFeed = (runs: readonly RoutineRunType[]): Map<string, RoutineFeed> => {
    const feed = new Map<string, RoutineFeed>();

    for (const run of runs) {
        const current = feed.get(run.routineId) ?? { unread: 0, attention: EMPTY_RUN_ATTENTION, running: false };

        feed.set(run.routineId, {
            unread: run.status === 'running' ? current.unread : current.unread + 1,
            attention: {
                needsReconnect: current.attention.needsReconnect + (run.status === 'needs_reconnect' ? 1 : 0),
                failed: current.attention.failed + (run.status === 'failed' ? 1 : 0),
            },
            running: current.running || run.status === 'running',
        });
    }

    return feed;
};

/**
 * Clicking a routine opens its newest report whether or not it is still unread — the unread feed
 * alone would leave an already-read routine with nowhere to go.
 */
const buildLatestReports = (runs: readonly RoutineRunType[]): Map<string, string> => {
    const paths = new Map<string, string>();

    for (const run of runs) {
        if (paths.has(run.routineId)) continue;

        const path = buildReportPath(run);

        if (path) paths.set(run.routineId, path);
    }

    return paths;
};

// A `running` run has no report yet, so it is never marked read and never counts as unread.
const settledRunIdsOf = (
    runs: readonly RoutineRunType[],
    routineId: string,
    accepts: (status: RoutineRunStatus) => boolean,
): string[] =>
    runs
        .filter((run) => run.routineId === routineId && run.status !== 'running' && accepts(run.status))
        .map((run) => run._id);

const SIDEBAR_ICON_BUTTON_CLASS = cn(
    'shrink-0 text-(--sidebar-foreground)',
    'hover:bg-(--sidebar-primary) hover:text-(--sidebar-primary-foreground)',
    'focus-visible:ring-2 focus-visible:ring-(--color-focus-ring) focus-visible:ring-offset-0',
);

const SidebarRoutinesList = ({ id, agentId, agentSlug, isCollapsed, activePath, onMobileClose }: Props) => {
    const navigate = useNavigate();
    // Ordered by the api on the same field the routines page defaults to; re-ordering here on the run feed,
    // which lands after the list, is what made the rows jump as the sidebar opened.
    const { data, isPending } = useRoutinesQuery({
        agentId,
        size: SIDEBAR_ROUTINE_LIMIT + 1,
        sortBy: ROUTINE_SORT_PARAM['next-run'],
        status: 'active',
    });
    const { runs, markRead, isMarkingRead, reconnectTargetByRoutine } = useNotificationsRoutineRuns();
    // Capped, not paged: both lookups below want the newest run per routine, which no filter narrows to.
    const { data: allRunsData } = useAllRoutineRunsQuery();
    const runNowMutation = useRunRoutineNowMutation();
    const runNowToast = useRunNowToast();
    const pauseMutation = usePauseRoutineMutation();
    const resumeMutation = useResumeRoutineMutation();

    const feed = useMemo(() => buildFeed(runs), [runs]);
    const latestReports = useMemo(() => buildLatestReports(allRunsData?.values ?? []), [allRunsData]);
    const values = data?.values ?? [];
    const routines = values.slice(0, SIDEBAR_ROUTINE_LIMIT);
    const isTruncated = values.length > routines.length;

    const activeRoutineId = useMemo(() => {
        if (activePath?.startsWith('routines/')) return activePath.split('/')[1] || null;

        const conversationId = activePath?.startsWith('chat/') ? activePath.slice('chat/'.length) : null;

        if (!conversationId) return null;

        return (allRunsData?.values ?? []).find((run) => run.conversationId === conversationId)?.routineId ?? null;
    }, [activePath, allRunsData]);

    if (isCollapsed) return null;

    const isRoutineBusy = (routineId: string): boolean =>
        (runNowMutation.isPending && runNowMutation.variables === routineId) ||
        (pauseMutation.isPending && pauseMutation.variables === routineId) ||
        (resumeMutation.isPending && resumeMutation.variables === routineId);

    const goToRoutinesPage = () => {
        onMobileClose?.();
        navigate(`/agent/${agentSlug}/routines`);
    };

    // Derived from the counts the chip renders, so the list it lands on always holds those rows.
    const attentionFilterOf = (routineId: string): RunStatusFilter | null => {
        const entry = feed.get(routineId);

        // A run in progress owns the row and renderBadge shows no chip, so nothing may act on one here.
        if (entry?.running) return null;

        return attentionRunStatusFilter(entry?.attention ?? EMPTY_RUN_ATTENTION);
    };

    const routineHref = (routine: RoutineType): string => {
        const filter = attentionFilterOf(routine._id);

        if (filter) return `/agent/${agentSlug}/routines/${routine._id}?runStatus=${filter}`;

        return latestReports.get(routine._id) ?? `/agent/${agentSlug}/routines/${routine._id}`;
    };

    /** The row is a link, so this only carries the side effects the navigation itself cannot. */
    const onOpenRoutine = (routine: RoutineType) => {
        onMobileClose?.();

        const filter = attentionFilterOf(routine._id);

        // Read exactly what the click lands on. The filtered list shows only the attention runs, so
        // clearing an unread report it never displayed would lose news nobody has seen.
        if (filter) {
            const statuses = runStatusFilterStatuses(filter);

            markRead(settledRunIdsOf(runs, routine._id, (status) => statuses.includes(status)));

            return;
        }

        // A report that cannot be opened must not be marked read by a click that goes nowhere. The
        // attention statuses are spared either way: with a run in flight their chip is suppressed, and
        // clearing them here would mean it never appears once that run settles.
        if (latestReports.has(routine._id)) {
            markRead(settledRunIdsOf(runs, routine._id, (status) => !isRunAttentionStatus(status)));
        }
    };

    const markRoutineRead = (routine: RoutineType) => {
        markRead(settledRunIdsOf(runs, routine._id, () => true));
    };

    const runRoutineNow = (routine: RoutineType) => {
        runNowMutation.mutate(routine._id, {
            onError: (error) => runNowToast.showFailure(error, `Could not start ${routine.name}.`),
        });
    };

    const toggleRoutinePaused = (routine: RoutineType) => {
        const mutation = routine.status === 'active' ? pauseMutation : resumeMutation;
        const fallback =
            routine.status === 'active' ? `Could not pause ${routine.name}.` : `Could not resume ${routine.name}.`;

        mutation.mutate(routine._id, {
            onError: (error) => showErrorToast(getApiErrorMessage(error, fallback)),
        });
    };

    const renderReadStateDot = (routine: RoutineType, entry: RoutineFeed | undefined) => {
        // A run in progress owns the left slot; its own dot is the status, so the unread mark waits.
        if (entry?.running) {
            return (
                <span
                    aria-label="Running now"
                    className="flex size-4 shrink-0 items-center justify-center text-(--sidebar-foreground)"
                >
                    <span className="relative flex size-2">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-75" />
                        <span className="relative inline-flex size-2 rounded-full bg-current" />
                    </span>
                </span>
            );
        }

        if (!entry?.unread) return null;

        return (
            <button
                type="button"
                aria-label={`Mark ${routine.name} as read`}
                disabled={isMarkingRead}
                className={cn('cursor-pointer rounded-full', SIDEBAR_ICON_BUTTON_CLASS, 'disabled:opacity-50')}
                onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    markRoutineRead(routine);
                }}
            >
                <ConversationStatusIndicator isUnread collapseWhenEmpty />
            </button>
        );
    };

    const renderBadge = (routineId: string, entry: RoutineFeed | undefined) => {
        if (entry?.running) return null;

        // Attention outranks the news count: it is the one thing on this row that needs the person.
        const attention = entry?.attention ?? EMPTY_RUN_ATTENTION;
        const total = runAttentionTotal(attention);

        if (total > 0) {
            const tone = runAttentionTone(attention);
            const Icon = RUN_ATTENTION_ICONS[tone];
            const reconnect = reconnectTargetByRoutine.get(routineId) ?? null;

            return (
                <span
                    // The ground is SCSS's: it has to survive the row turning white on hover and while active.
                    data-tone={tone}
                    className={cn(
                        'sidebar-routines-list-attention-chip flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                        tone === 'destructive' ? 'text-destructive' : 'text-(--sidebar-foreground)',
                    )}
                >
                    <Icon aria-hidden="true" className="size-3" />
                    {/* The row's name has to survive beside it, and this column is far too narrow for
                        the wording the routines table can afford, so only a reader gets the sentence.
                        The row's link already carries the name, so this must not repeat it.
                        Where every counted run names one connector, the sentence names it too: this
                        column cannot show it, and the routines table chip is where it is seen. */}
                    <span className="sr-only">
                        {reconnect
                            ? `${runAttentionLabel(total)} — reconnect ${reconnect.name}`
                            : runAttentionLabel(total)}
                    </span>
                    <span aria-hidden="true">{total > 9 ? '9+' : total}</span>
                </span>
            );
        }

        if (!entry?.unread) return null;

        return (
            <span className="sidebar-routines-list-new-chip shrink-0 rounded-full px-2 py-0.5 text-[11px] text-(--sidebar-foreground)">
                {entry.unread > 9 ? '9+' : entry.unread} new
            </span>
        );
    };

    const renderMarkAsReadItem = (routine: RoutineType, entry: RoutineFeed | undefined) => {
        if (!entry?.unread) return null;

        return (
            <DropdownMenuItem
                className="cursor-pointer"
                // stopPropagation only: preventDefault would cancel Radix's own select, leaving the menu stuck open.
                onClick={(event) => {
                    event.stopPropagation();
                    markRoutineRead(routine);
                }}
            >
                <CheckIcon className="size-3.5" />
                Mark as read
            </DropdownMenuItem>
        );
    };

    const renderRoutineMenu = (routine: RoutineType, entry: RoutineFeed | undefined) => (
        <DropdownMenuRoot>
            <DropdownMenuTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`More options for ${routine.name}`}
                    className={cn('size-6', SIDEBAR_ICON_BUTTON_CLASS)}
                    onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                    }}
                >
                    <MoreHorizontalIcon aria-hidden="true" className="size-3.5" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
                {renderMarkAsReadItem(routine, entry)}
                <DropdownMenuItem
                    className="cursor-pointer"
                    disabled={isRoutineBusy(routine._id)}
                    onClick={(event) => {
                        event.stopPropagation();
                        runRoutineNow(routine);
                    }}
                >
                    <ZapIcon className="size-3.5" />
                    Run now
                </DropdownMenuItem>
                <DropdownMenuItem
                    className="cursor-pointer"
                    disabled={isRoutineBusy(routine._id)}
                    onClick={(event) => {
                        event.stopPropagation();
                        toggleRoutinePaused(routine);
                    }}
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
                    onClick={(event) => {
                        event.stopPropagation();
                        goToRoutinesPage();
                    }}
                >
                    <ExternalLinkIcon className="size-3.5" />
                    View all routines
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenuRoot>
    );

    const renderRoutineIcon = (routine: RoutineType) => {
        const Icon = routineIcon(routine.icon);

        return <Icon aria-hidden="true" className="size-3.5 shrink-0 text-(--sidebar-foreground)/70" />;
    };

    const renderRoutine = (routine: RoutineType) => {
        const entry = feed.get(routine._id);

        return (
            <li
                key={routine._id}
                className={cn('nav-list-item chat-nav-list-item', routine._id === activeRoutineId && 'active')}
            >
                <Link
                    to={routineHref(routine)}
                    className="flex items-center gap-2 rounded-lg px-2 py-1"
                    onClick={() => onOpenRoutine(routine)}
                >
                    {renderReadStateDot(routine, entry)}
                    {renderRoutineIcon(routine)}
                    <span className="line-clamp-1 min-w-0 flex-1 text-sm">{routine.name}</span>
                    <span className="flex items-center gap-0.5">
                        {renderBadge(routine._id, entry)}
                        {renderRoutineMenu(routine, entry)}
                    </span>
                </Link>
            </li>
        );
    };

    // Active-only is a server filter, so an empty list here still leaves paused routines on the full page.
    const renderEmpty = () => (
        <li className="nav-list-item">
            <Link
                to={`/agent/${agentSlug}/routines`}
                className="block rounded-lg px-2 py-1 text-sm text-(--sidebar-foreground)/60 hover:text-(--sidebar-foreground)"
                onClick={() => onMobileClose?.()}
            >
                Nothing running — see all routines
            </Link>
        </li>
    );

    const renderViewAll = () => {
        if (!isTruncated) return null;

        return (
            <li className="nav-list-item">
                <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="w-full justify-center text-sm text-(--sidebar-foreground) hover:bg-(--sidebar-primary) hover:text-(--sidebar-primary-foreground)"
                >
                    <Link to={`/agent/${agentSlug}/routines`} onClick={() => onMobileClose?.()}>
                        View all routines
                    </Link>
                </Button>
            </li>
        );
    };

    return (
        <ul id={id} className="nav-list ml-2 flex flex-col gap-0.5 border-l border-(--sidebar-foreground)/15 pl-2">
            {routines.length === 0 && !isPending ? renderEmpty() : routines.map(renderRoutine)}
            {renderViewAll()}
        </ul>
    );
};

export default SidebarRoutinesList;
