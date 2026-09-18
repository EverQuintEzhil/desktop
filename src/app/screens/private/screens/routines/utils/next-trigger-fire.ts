import { Cron } from 'croner';

import { scheduleToCron, scheduleToRunAt, validateSchedule } from './cron-schedule';
import type { TriggerFormValue } from './triggers';

/**
 * The next fire instant of the trigger as drafted, or null when the draft cannot say —
 * invalid, custom without a stored cron, or a pattern croner does not accept.
 */
export const nextTriggerFire = (value: TriggerFormValue, now: Date = new Date()): Date | null => {
    if (value.kind !== 'schedule') return null;

    const schedule = value.schedule;

    if (validateSchedule(schedule, now, value.timezone, value.storedRunAt)) return null;

    let pattern: string | null;

    if (schedule.frequency === 'custom') pattern = value.customCron ?? value.cron;
    else if (schedule.frequency === 'once') pattern = scheduleToRunAt(schedule);
    else pattern = scheduleToCron({ ...schedule, frequency: schedule.frequency });

    if (!pattern) return null;

    try {
        return new Cron(pattern, { timezone: value.timezone }).nextRun(now);
    } catch {
        return null;
    }
};
