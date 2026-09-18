import { useMemo } from 'react';

import { useAllRoutineRunsQuery, useRoutineRunsQuery } from '@/lib/api/app/routines';
import type { RoutineRunType } from '@/types/routines';

export interface ConversationRoutineState {
    routine: ConversationRoutine | null;
    /** True while the feed still shows the previous conversation's run — the shell should wait, not unmount. */
    isResolving: boolean;
}

interface ConversationRoutine {
    routineId: string;
    routineName: string;
    /** Newest first, every run of the routine — not only the one this conversation came from. */
    runs: RoutineRunType[];
    currentRunId: string | null;
}

/**
 * Resolves the routine behind a conversation from the run feed, because a conversation carries no
 * link back to the routine that opened it.
 */
export const useConversationRoutine = (
    conversationId?: string,
    options: { enabled?: boolean } = {},
): ConversationRoutineState => {
    const isEnabled = (options.enabled ?? true) && Boolean(conversationId);
    const { data: currentRunData, isPlaceholderData } = useAllRoutineRunsQuery(
        { conversationIds: conversationId ? [conversationId] : [], size: 1 },
        { enabled: isEnabled },
    );
    // Placeholder data still describes the conversation the reader just left, which would credit it to that routine.
    const current = isPlaceholderData ? null : (currentRunData?.values?.[0] ?? null);
    const { data: runsData } = useRoutineRunsQuery(isEnabled ? (current?.routineId ?? null) : null);

    const routine = useMemo(() => {
        if (!isEnabled || !current) return null;

        // The open run can be older than the routine's first page, and it must still appear in its own history.
        const page = runsData?.values ?? [];
        const runs = page.some((run) => run._id === current._id) ? page : [...page, current];

        return {
            routineId: current.routineId,
            routineName: current.routine?.name ?? 'Routine',
            runs,
            currentRunId: current._id,
        };
    }, [current, runsData, isEnabled]);

    return { routine, isResolving: isEnabled && isPlaceholderData };
};
