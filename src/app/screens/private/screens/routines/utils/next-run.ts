import { Cron } from 'croner';

import type { RoutineType } from '@/types/routines';

/**
 * Next fire time, or null when there will not be one — paused, a one-shot that has already
 * gone, or a stored cron Temporal accepted that croner cannot parse.
 *
 * `runAt` is a wall-clock string in the routine's own timezone, which is why the pattern is
 * handed to croner rather than to `new Date()` — the browser's zone is usually not the
 * routine's, and for a one-shot that shifts the answer by hours.
 *
 * The api's own `nextRunAt` wins where it exists, or the `sortBy=nextRunAt` order and this column would disagree.
 */
export const nextRunAt = (routine: RoutineType, now: Date = new Date()): Date | null => {
    if (routine.status !== 'active') return null;

    const pattern = routine.runOnce ? routine.runAt : routine.cron;

    if (!pattern) return null;
    if (routine.runOnce && routine.lastRunAt) return null;

    if (routine.nextRunAt) {
        const served = new Date(routine.nextRunAt);

        // A fire the list has not polled since leaves a past instant on the row; croner still knows the next one.
        if (!Number.isNaN(served.getTime()) && served.getTime() > now.getTime()) return served;
    }

    try {
        return new Cron(pattern, { timezone: routine.timezone }).nextRun(now);
    } catch {
        return null;
    }
};
