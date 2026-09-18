import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useNotificationsRoutineRuns, type RunReconnectTarget } from '@/app/components/routine-runs';
import { useStickyHeader } from '@/app/hooks';
import { SearchInput } from '@/components';
import InfiniteScrollTrigger from '@/components/infinite-scroll-trigger';
import { Button } from '@/components/ui/button';
import ConfirmationModal from '@/components/ui/confirmation-modal';
import useInfiniteScroll from '@/hooks/use-infinite-scroll';
import { useAllRoutineRunsQuery, useRoutinesInfiniteQuery, useRoutinesQuery } from '@/lib/api/app/routines';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { cn } from '@/lib/utils';
import { EMPTY_RUN_ATTENTION, type RoutineRunType, type RoutineType, type RunAttentionCounts } from '@/types/routines';

import RoutinesInfoDialog from './components/routines-info-dialog';
import RoutinesListEmpty from './components/routines-list-empty';
import RoutinesListHeader from './components/routines-list-header';
import RoutinesLoadError from './components/routines-load-error';
import RoutinesTable from './components/routines-table';
import RoutinesTableSkeleton from './components/routines-table-skeleton';
import {
    attentionRunStatusFilter,
    ROUTINE_SORT_PARAM,
    type RoutineSort,
    type RoutineStatusFilter,
    runAttentionTotal,
} from './constants';
import { useAgentDetail } from './hooks/use-agent-detail';
import { useRoutinesActions } from './hooks/use-routines-actions';
import { useRoutinesSearchParams } from './hooks/use-routines-search-params';
import { RoutineFormModal } from './routine-form-modal';

const dedupeById = <T extends { _id: string }>(rows: readonly T[]): T[] => [
    ...new Map(rows.map((row) => [row._id, row])).values(),
];

const ARCHIVED_DESCRIPTION =
    'Archived routines stop running and are kept here. Bring one back any time — it stays paused until you resume it.';

interface ListFilters {
    owner: { projectId?: string; agentId?: string };
    isArchivedView: boolean;
    searchTerm: string;
    statusFilter: RoutineStatusFilter;
    sort: RoutineSort;
}

const listQueryParams = ({ owner, isArchivedView, searchTerm, statusFilter, sort }: ListFilters) => {
    // Archived rows have no next run, so ordering on it there is meaningless; last run stands in.
    const effectiveSort = isArchivedView && sort === 'next-run' ? 'last-run' : sort;

    return {
        effectiveSort,
        listParams: {
            ...owner,
            ...(isArchivedView ? { archived: true } : {}),
            ...(searchTerm ? { search: searchTerm } : {}),
            ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
            sortBy: ROUTINE_SORT_PARAM[effectiveSort],
        },
    };
};

const agentFilterLabel = (
    agentName: string | undefined,
    routines: RoutineType[],
    filterAgentId: string | null,
): string | undefined => agentName ?? routines.find((target) => target.agentId === filterAgentId)?.agent?.name;

const confirmName = (routine: RoutineType | null): string => routine?.name ?? '';

interface Props {
    /** Present = scoped to one agent: only its routines, and new ones belong to it. */
    agent?: { _id: string; name: string; slug?: string };
}

/** The detail page owns `runStatus`; a value left over from another routine must not follow the click. */
const routineSearchOf = (params: URLSearchParams): string => {
    const next = new URLSearchParams(params);

    next.delete('runStatus');

    return next.toString();
};

const Routines = ({ agent }: Props) => {
    // A Space's card lists every member's routines, so opening one has to widen this list past the caller's
    // own — otherwise the row it was opened from is not in it.
    const navigate = useNavigate();
    const params = useRoutinesSearchParams(Boolean(agent));
    const { searchParams, projectId, isArchivedView, filterAgentId, statusFilter, search, sort } = params;

    const ownerParams = (): { projectId?: string; agentId?: string } => {
        if (projectId) return { projectId };
        if (agent) return { agentId: agent._id };
        if (filterAgentId) return { agentId: filterAgentId };

        return {};
    };
    const searchTerm = search.trim();
    const { effectiveSort, listParams } = listQueryParams({
        owner: ownerParams(),
        isArchivedView,
        searchTerm,
        statusFilter,
        sort,
    });
    const { data, isLoading, isError, error, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } =
        useRoutinesInfiniteQuery(listParams);
    const { unreadByRoutine, unreadAttentionByRoutine, reconnectTargetByRoutine } = useNotificationsRoutineRuns();
    // The same capped recent-runs feed the sidebar reads; a routine it does not cover shows no hint.
    const { data: recentRunsData } = useAllRoutineRunsQuery(projectId ? { projectId, size: 100 } : { size: 100 });

    const { runningIds, lastRunStatuses } = useMemo(() => {
        const running = new Set<string>();
        const statuses = new Map<string, RoutineRunType['status']>();

        // Newest first, so the first run met per routine is its latest.
        for (const run of recentRunsData?.values ?? []) {
            if (run.status === 'running') running.add(run.routineId);
            // The outcome is only recorded for a settled run: the Last run column labels the routine's
            // `lastRunAt`, which is a finished run's clock and cannot carry an in-flight run's status.
            if (run.status !== 'running' && !statuses.has(run.routineId)) statuses.set(run.routineId, run.status);
        }

        return { runningIds: running, lastRunStatuses: statuses };
    }, [recentRunsData]);
    // One row is enough: only `total_count` is wanted, and it decides whether the link is offered at all.
    const { data: archivedPage, isPending: isArchivedCountPending } = useRoutinesQuery(
        { ...ownerParams(), archived: true, size: 1 },
        { poll: false },
    );
    // Only the agent record can name a filter restored from the url, before any row has loaded.
    const { data: filterAgent } = useAgentDetail(filterAgentId ?? '');
    const actions = useRoutinesActions();

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isInfoOpen, setIsInfoOpen] = useState(false);
    const [editingRoutine, setEditingRoutine] = useState<RoutineType | null>(null);
    // The agent route lets the window scroll (same shell as Library), so the header tracks window scroll.
    const containerRef = useRef<HTMLDivElement | null>(null);
    const isSticky = useStickyHeader(containerRef);

    // Offset paging plus polling can hand the same row back on two pages, which would duplicate a React key.
    const routines = useMemo(() => dedupeById((data?.pages ?? []).flatMap((page) => page.values)), [data]);

    const { loadMoreRef } = useInfiniteScroll({
        loading: isLoading,
        showMoreLoading: isFetchingNextPage,
        hasMore: Boolean(hasNextPage),
        itemsLength: routines.length,
        onLoadMore: fetchNextPage,
    });

    // The agent detail route exists only where the agent has Routines on, so a row opens only under its own agent.
    const routinePath = (routine: RoutineType): string | null => {
        if (!agent) return `/settings/routines/${routine._id}`;
        if (routine.agentId !== agent._id || !agent.slug) return null;

        return `/agent/${agent.slug}/routines/${routine._id}`;
    };

    const canOpenRoutine = (routine: RoutineType): boolean => routinePath(routine) !== null;

    const attentionCounts = (routine: RoutineType): RunAttentionCounts =>
        unreadAttentionByRoutine.get(routine._id) ?? EMPTY_RUN_ATTENTION;

    const attentionReconnect = (routine: RoutineType): RunReconnectTarget | null =>
        reconnectTargetByRoutine.get(routine._id) ?? null;

    // Carries the list's own params like a row click does, or Back would land on an unfiltered list.
    const attentionRunsPath = (routine: RoutineType): string | null => {
        const path = routinePath(routine);
        const filter = attentionRunStatusFilter(attentionCounts(routine));

        if (!path || !filter) return null;

        const search = new URLSearchParams(routineSearchOf(searchParams));

        search.set('runStatus', filter);

        // A comma is a legal query sub-delimiter, so it is decoded back: `%2C` is not a shareable URL,
        // and the sidebar builds the same link by hand with a literal comma.
        return `${path}?${search.toString().replaceAll('%2C', ',')}`;
    };

    const openRoutine = (routine: RoutineType) => {
        const path = routinePath(routine);

        // The list's params ride along so the detail page's back link can restore this exact view.
        if (path) navigate({ pathname: path, search: routineSearchOf(searchParams) });
    };

    const describeScope = (): string => {
        const spaceName = routines.find((routine) => routine.projectId === projectId)?.project?.name;

        if (projectId) return `Every routine reporting into ${spaceName ?? 'this space'}, from anyone on it.`;
        if (agent) return `Run research on a schedule with ${agent.name}, or whenever you need it.`;

        return 'Run research on a schedule, or whenever you need it.';
    };

    const description = describeScope();

    // A Space holds more than one agent's routines, so two rows can share a name and differ only by agent.
    const showAgent = !agent || Boolean(projectId);

    const renderRoutines = () => {
        if (isLoading) return <RoutinesTableSkeleton />;
        if (isError) {
            return (
                <RoutinesLoadError
                    message={getApiErrorMessage(
                        error,
                        isArchivedView
                            ? 'Your archived routines could not be loaded.'
                            : 'Your routines could not be loaded.',
                    )}
                    onRetry={() => void refetch()}
                />
            );
        }
        if (routines.length === 0) {
            return (
                <RoutinesListEmpty
                    searchTerm={searchTerm}
                    isArchivedView={isArchivedView}
                    statusFilter={statusFilter}
                    onCreate={() => setIsCreateOpen(true)}
                />
            );
        }

        return (
            <RoutinesTable
                routines={routines}
                showAgent={showAgent}
                unreadCount={(target) =>
                    (unreadByRoutine.get(target._id) ?? 0) - runAttentionTotal(attentionCounts(target))
                }
                attentionCounts={attentionCounts}
                attentionRunsPath={attentionRunsPath}
                attentionReconnect={attentionReconnect}
                lastRunStatus={(target) => lastRunStatuses.get(target._id) ?? null}
                isRunning={(target) => runningIds.has(target._id)}
                isRunPending={actions.isRunPending}
                isStatusPending={actions.isStatusPending}
                isPinPending={actions.isPinPending}
                isUnarchivePending={actions.isUnarchivePending}
                onRunNow={(target) => void actions.onRunNow(target)}
                onToggleStatus={(target) => void actions.onToggleStatus(target)}
                canOpen={canOpenRoutine}
                onOpen={openRoutine}
                onEdit={setEditingRoutine}
                onPin={(target) => void actions.onTogglePin(target)}
                onArchive={actions.setArchivingRoutine}
                onUnarchive={(target) => void actions.onUnarchive(target)}
                onDelete={actions.setDeletingRoutine}
            />
        );
    };

    const filterAgentName = agentFilterLabel(filterAgent?.name, routines, filterAgentId);

    const renderArchivedLink = () => {
        const archivedCount = archivedPage?.pageInfo.totalCount ?? 0;

        if (isArchivedView || isLoading || isError) return null;
        if (isArchivedCountPending || archivedCount === 0) return null;

        return (
            <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-fit self-center rounded-full text-sm font-normal text-text-secondary hover:text-primary"
                onClick={() => params.openArchivedView(true)}
            >
                {`View archived (${archivedPage?.pageInfo.totalCount ?? 0})`}
            </Button>
        );
    };

    // Two hosts, two shells: the settings layout already scrolls and pads, the agent route does not.
    const isSettings = !agent;

    const renderHeader = () => (
        <>
            <RoutinesListHeader
                agent={agent}
                isSettings={isSettings}
                isArchivedView={isArchivedView}
                description={isArchivedView ? ARCHIVED_DESCRIPTION : description}
                showAgentFilter={!agent}
                filterAgentId={filterAgentId}
                filterAgentName={filterAgentName}
                statusFilter={statusFilter}
                sort={effectiveSort}
                onAgentFilterChange={params.onAgentFilterChange}
                onStatusFilterChange={params.onStatusFilterChange}
                onSortChange={params.onSortChange}
                onCloseArchivedView={() => params.openArchivedView(false)}
                onOpenInfo={() => setIsInfoOpen(true)}
                onCreate={() => setIsCreateOpen(true)}
            />

            <SearchInput
                search={search}
                onChange={params.onSearchChange}
                searchOnChange
                debounceWait={400}
                autoFocus={false}
                placeholder="Search routines"
                className="max-w-full"
                {...(isSettings ? {} : { inputClassName: 'rounded-3xl border-0 shadow-surface text-base h-[45px]' })}
            />
        </>
    );

    return (
        <div
            ref={containerRef}
            className={cn(
                'flex flex-col',
                isSettings ? 'gap-4' : 'relative min-h-svh w-full bg-background max-lg:pt-[50px]',
            )}
        >
            {isSettings ? (
                <div className="flex w-full flex-col gap-4">{renderHeader()}</div>
            ) : (
                <div
                    className={cn('routines-list-sticky sticky top-0 z-1 w-full bg-background py-4', {
                        'shadow-sm': isSticky,
                    })}
                >
                    <div className="mx-auto flex w-full max-w-[928px] flex-col gap-4 px-4">{renderHeader()}</div>
                </div>
            )}

            <div className={cn('flex w-full flex-col gap-6', isSettings ? '' : 'mx-auto max-w-[928px] px-4 pt-2 pb-6')}>
                {renderRoutines()}

                <InfiniteScrollTrigger
                    loadMoreRef={loadMoreRef}
                    hasMore={Boolean(hasNextPage)}
                    isLoading={isFetchingNextPage}
                />

                {renderArchivedLink()}
            </div>

            <RoutinesInfoDialog open={isInfoOpen} onOpenChange={setIsInfoOpen} />

            {isCreateOpen ? (
                <RoutineFormModal open onOpenChange={(isOpen) => !isOpen && setIsCreateOpen(false)} agent={agent} />
            ) : null}

            {editingRoutine ? (
                <RoutineFormModal
                    open
                    onOpenChange={(isOpen) => !isOpen && setEditingRoutine(null)}
                    routine={editingRoutine}
                    agent={agent}
                />
            ) : null}

            <ConfirmationModal
                isOpen={Boolean(actions.archivingRoutine)}
                title="Archive routine?"
                message={`"${confirmName(actions.archivingRoutine)}" stops running and moves to Archived. Bringing it back leaves it paused until you resume it.`}
                confirmButtonText="Archive"
                isButtonLoading={actions.isArchivePending}
                onConfirm={() => void actions.onArchive()}
                onClose={() => actions.setArchivingRoutine(null)}
            />

            <ConfirmationModal
                isOpen={Boolean(actions.deletingRoutine)}
                title="Delete routine?"
                message={`"${confirmName(actions.deletingRoutine)}" will stop running. Past research conversations are kept.`}
                confirmButtonText="Delete"
                isButtonLoading={actions.isDeletePending}
                onConfirm={() => void actions.onDelete()}
                onClose={() => actions.setDeletingRoutine(null)}
            />
        </div>
    );
};

export default Routines;
