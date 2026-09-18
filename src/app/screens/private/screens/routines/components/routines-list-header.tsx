import { ArrowLeftIcon, InfoIcon, PlusIcon } from 'lucide-react';

import type { AgentRef } from '@/components/agent-chat/agent-name-link';
import AgentTitlePrefix from '@/components/agent-chat/agent-title-prefix';
import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { cn } from '@/lib/utils';

import {
    ROUTINE_SORT_OPTIONS,
    ROUTINE_STATUS_FILTER_OPTIONS,
    type RoutineSort,
    type RoutineStatusFilter,
} from '../constants';

import RoutineAgentFilter from './routine-agent-filter';
import RoutineFilterMenu from './routine-filter-menu';
import RoutineSortMenu from './routine-sort-menu';

interface Props {
    agent?: AgentRef | null;
    isSettings: boolean;
    isArchivedView: boolean;
    description: string;
    /** Absent = the list is scoped to one agent, so a per-agent filter would be redundant. */
    showAgentFilter: boolean;
    filterAgentId: string | null;
    filterAgentName?: string;
    statusFilter: RoutineStatusFilter;
    sort: RoutineSort;
    onAgentFilterChange: (agentId: string | null) => void;
    onStatusFilterChange: (status: RoutineStatusFilter) => void;
    onSortChange: (sort: RoutineSort) => void;
    onCloseArchivedView: () => void;
    onOpenInfo: () => void;
    onCreate: () => void;
}

const RoutinesListHeader = ({
    agent,
    isSettings,
    isArchivedView,
    description,
    showAgentFilter,
    filterAgentId,
    filterAgentName,
    statusFilter,
    sort,
    onAgentFilterChange,
    onStatusFilterChange,
    onSortChange,
    onCloseArchivedView,
    onOpenInfo,
    onCreate,
}: Props) => (
    <div className="routines-list-header flex w-full flex-wrap items-start justify-between gap-3">
        {/* basis-0: flex wraps on the hypothetical size, so a text-sized title would push the toolbar down. */}
        <div className="flex min-w-32 flex-1 basis-0 flex-col">
            {isArchivedView ? (
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="-ml-2 w-fit rounded-full px-2 text-text-secondary hover:text-primary"
                    onClick={onCloseArchivedView}
                >
                    <ArrowLeftIcon aria-hidden="true" className="size-4" />
                    Routines
                </Button>
            ) : null}
            <div className="routines-list-header-title flex min-h-8 min-w-0 items-center gap-1.5">
                <AgentTitlePrefix agent={agent} />
                <h1 className={cn('line-clamp-1 shrink-0', isSettings ? 'text-lg font-semibold' : 'text-xl font-bold')}>
                    {isArchivedView ? 'Archived' : 'Routines'}
                </h1>
                {isArchivedView ? null : (
                    <SimpleTooltip content="Info" side="bottom">
                        <Button
                            variant="ghost"
                            size="icon-xs"
                            className="shrink-0 rounded-full"
                            aria-label="What are Routines?"
                            onClick={onOpenInfo}
                        >
                            <InfoIcon className="size-4 text-primary" />
                        </Button>
                    </SimpleTooltip>
                )}
            </div>
            <p
                className={cn(
                    'line-clamp-1',
                    isSettings ? 'text-xs text-muted-foreground' : 'text-sm text-text-secondary',
                )}
            >
                {description}
            </p>
        </div>
        <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
            {showAgentFilter ? (
                <RoutineAgentFilter
                    value={filterAgentId}
                    selectedName={filterAgentName}
                    onChange={onAgentFilterChange}
                />
            ) : null}
            {/* Archived rows are all paused, so a status filter there would be a lie with one answer. */}
            {!isArchivedView ? (
                <RoutineFilterMenu
                    value={statusFilter}
                    options={ROUTINE_STATUS_FILTER_OPTIONS}
                    onChange={onStatusFilterChange}
                    label="All statuses"
                />
            ) : null}
            <RoutineSortMenu
                sort={sort}
                options={
                    isArchivedView
                        ? ROUTINE_SORT_OPTIONS.filter((option) => option.value !== 'next-run')
                        : ROUTINE_SORT_OPTIONS
                }
                onChange={onSortChange}
            />
            {isArchivedView ? null : (
                <Button type="button" size="sm" className="rounded-full" onClick={onCreate}>
                    <PlusIcon aria-hidden="true" className="size-4" />
                    New routine
                </Button>
            )}
        </div>
    </div>
);

export default RoutinesListHeader;
