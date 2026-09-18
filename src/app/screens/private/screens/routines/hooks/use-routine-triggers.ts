import { useMemo, useRef, useState } from 'react';

import { useRoutineTriggersQuery } from '@/lib/api/app/routines';

import {
    createTriggerFormValue,
    isTriggerWritable,
    type TriggerFormValue,
    triggersFromRecords,
    validateTriggers,
} from '../utils/triggers';

export type TriggerSetLock = 'unreadable' | 'unwritable';

export interface RoutineTriggersState {
    triggers: TriggerFormValue[];
    setTriggers: (values: TriggerFormValue[]) => void;
    /** True only until `GET /routines/:id/triggers` settles; a create has nothing to load. */
    isLoading: boolean;
    /** Set when the stored set must be left exactly as it is, which is what keeps `triggers` off the write. */
    lock: TriggerSetLock | null;
    /** A write replaces the whole set, so an untouched one is omitted and a rename never rewrites a schedule. */
    isDirty: boolean;
    error?: string;
    reset: () => void;
}

// An empty set is not a readable one: the api never leaves a routine without a trigger, so nothing parsed
// means the stored set is unknown and a whole-set write would delete it.
const lockFor = (routineId: string | null, saved: TriggerFormValue[] | null): TriggerSetLock | null => {
    if (!routineId) return null;
    if (!saved?.length) return 'unreadable';

    return saved.every(isTriggerWritable) ? null : 'unwritable';
};

export const useRoutineTriggers = (routineId: string | null, timezone: string): RoutineTriggersState => {
    // Manual, not a schedule: a new routine starts from the empty "Add trigger" state and stays saveable.
    const [newTriggers] = useState(() => [{ ...createTriggerFormValue(timezone), kind: 'manual' as const }]);
    const [editedTriggers, setEditedTriggers] = useState<TriggerFormValue[] | null>(null);

    const query = useRoutineTriggersQuery(routineId);
    const loaded = useMemo(() => (query.data ? triggersFromRecords(query.data) : null), [query.data]);

    // Tracks the fetched set until the first edit, then stops: a write replaces the whole set, so it must
    // be built from rows the user actually saw. A trigger added elsewhere after that first edit is still
    // overwritten — the api takes no precondition to reject a stale set on.
    const savedRef = useRef<TriggerFormValue[] | null>(null);

    if (loaded?.length && (!savedRef.current || !editedTriggers)) savedRef.current = loaded;

    const saved = savedRef.current;
    const triggers = editedTriggers ?? saved ?? newTriggers;

    return {
        triggers,
        setTriggers: setEditedTriggers,
        isLoading: Boolean(routineId) && query.isPending,
        lock: lockFor(routineId, saved),
        isDirty: editedTriggers !== null,
        error: validateTriggers(triggers, new Date()),
        reset: () => setEditedTriggers(null),
    };
};
