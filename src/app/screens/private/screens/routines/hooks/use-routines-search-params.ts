import { useSearchParams } from 'react-router-dom';

import {
    ARCHIVED_VIEW_PARAM,
    ARCHIVED_VIEW_VALUE,
    isRoutineSort,
    isRoutineStatusFilter,
    type RoutineSort,
    type RoutineStatusFilter,
} from '../constants';

/** The list's whole url state: every filter read from the search params, and the setters that write them back. */
export const useRoutinesSearchParams = (isAgentScoped: boolean) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const projectId = searchParams.get('projectId') ?? undefined;
    const isArchivedView = searchParams.get(ARCHIVED_VIEW_PARAM) === ARCHIVED_VIEW_VALUE;
    const filterAgentId = isAgentScoped ? null : searchParams.get('agentId');
    const statusParamValue = searchParams.get('status');
    // Off, the url is ignored too, so a stale ?status= from a flipped-back flag cannot 400 the list.
    // The control is hidden in the archived view, so a carried-over ?status= would strand a zero-row list.
    const statusFilter: RoutineStatusFilter =
        !isArchivedView && isRoutineStatusFilter(statusParamValue) ? statusParamValue : 'all';

    const search = searchParams.get('q') ?? '';
    const sortParamValue = searchParams.get('sort');
    const sort: RoutineSort = isRoutineSort(sortParamValue) ? sortParamValue : 'next-run';

    const onSearchChange = (value: string) => {
        const next = new URLSearchParams(searchParams);

        if (value.trim()) next.set('q', value);
        else next.delete('q');

        setSearchParams(next, { replace: true });
    };

    const onSortChange = (nextSort: RoutineSort) => {
        const next = new URLSearchParams(searchParams);

        if (nextSort === 'next-run') next.delete('sort');
        else next.set('sort', nextSort);

        setSearchParams(next, { replace: true });
    };

    const onStatusFilterChange = (status: RoutineStatusFilter) => {
        const next = new URLSearchParams(searchParams);

        if (status === 'all') next.delete('status');
        else next.set('status', status);

        setSearchParams(next, { replace: true });
    };

    const onAgentFilterChange = (agentId: string | null) => {
        const next = new URLSearchParams(searchParams);

        if (agentId) next.set('agentId', agentId);
        else next.delete('agentId');

        setSearchParams(next, { replace: true });
    };

    const openArchivedView = (open: boolean) => {
        const next = new URLSearchParams(searchParams);

        if (open) next.set(ARCHIVED_VIEW_PARAM, ARCHIVED_VIEW_VALUE);
        else next.delete(ARCHIVED_VIEW_PARAM);

        setSearchParams(next);
    };

    return {
        searchParams,
        projectId,
        isArchivedView,
        filterAgentId,
        statusFilter,
        search,
        sort,
        onSearchChange,
        onSortChange,
        onStatusFilterChange,
        onAgentFilterChange,
        openArchivedView,
    };
};
