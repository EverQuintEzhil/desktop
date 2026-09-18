import { useMemo } from 'react';

import { useMarkRoutineRunsReadMutation, useUnreadRoutineRunsQuery } from '@/lib/api/app/routines';
import {
    EMPTY_RUN_ATTENTION,
    isRunAttentionStatus,
    type RoutineRunType,
    type RunAttentionCounts,
} from '@/types/routines';

import { runReconnectConnector, type RunReconnectTarget } from './run-failure-actions';

export const useNotificationsRoutineRuns = (options: { enabled?: boolean } = {}) => {
    const query = useUnreadRoutineRunsQuery(options);
    const markReadMutation = useMarkRoutineRunsReadMutation();

    const runs = useMemo<RoutineRunType[]>(() => query.data?.values ?? [], [query.data]);
    const settledRuns = useMemo(() => runs.filter((run) => run.status !== 'running'), [runs]);

    const unreadRunIds = useMemo(() => new Set(settledRuns.map((run) => run._id)), [settledRuns]);

    const unreadByRoutine = useMemo(() => {
        const counts = new Map<string, number>();

        for (const run of settledRuns) counts.set(run.routineId, (counts.get(run.routineId) ?? 0) + 1);

        return counts;
    }, [settledRuns]);

    /**
     * A blocked run needs a reconnect and never ran; a failed one ran and broke. They are tallied
     * apart because every surface that shows them needs its own word and colour for each.
     */
    const unreadAttentionByRoutine = useMemo(() => {
        const counts = new Map<string, RunAttentionCounts>();

        for (const run of settledRuns) {
            if (!isRunAttentionStatus(run.status)) continue;

            const current = counts.get(run.routineId) ?? EMPTY_RUN_ATTENTION;

            counts.set(run.routineId, {
                needsReconnect: current.needsReconnect + (run.status === 'needs_reconnect' ? 1 : 0),
                failed: current.failed + (run.status === 'failed' ? 1 : 0),
            });
        }

        return counts;
    }, [settledRuns]);

    /**
     * The one connector a routine's unread runs are waiting on, so a notification can name it and
     * point at it instead of only counting it (AMP-569).
     *
     * A routine is dropped the moment its unread runs disagree — a second connector, a `failed` run,
     * or a reconnect run that names none. One chip cannot stand for two different fixes, and the
     * count it falls back to already links to the run list that shows them all.
     */
    const reconnectTargetByRoutine = useMemo(() => {
        const targets = new Map<string, RunReconnectTarget | null>();

        for (const run of settledRuns) {
            if (!isRunAttentionStatus(run.status)) continue;

            const target = runReconnectConnector(run);

            if (!targets.has(run.routineId)) {
                targets.set(run.routineId, target);

                continue;
            }

            const current = targets.get(run.routineId);

            // Compared on the name as well as the path: the revoked-token throw sends the name with
            // no id, so two runs blocked on two different connectors both degrade to the bare
            // connectors path and would otherwise agree, hiding the second blocker entirely.
            if (!current || !target || current.to !== target.to || current.name !== target.name) {
                targets.set(run.routineId, null);
            }
        }

        return new Map([...targets].filter((entry): entry is [string, RunReconnectTarget] => entry[1] !== null));
    }, [settledRuns]);

    const markRead = (runIds: string[]): void => {
        if (runIds.length === 0) return;

        markReadMutation.mutate(runIds);
    };

    return {
        runs,
        settledRuns,
        unreadByRoutine,
        unreadAttentionByRoutine,
        reconnectTargetByRoutine,
        unreadRunIds,
        unreadCount: settledRuns.length,
        hasRunning: runs.some((run) => run.status === 'running'),
        isLoading: query.isLoading,
        refresh: query.refetch,
        markRead,
        isMarkingRead: markReadMutation.isPending,
    };
};
