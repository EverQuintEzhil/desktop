import {
    EVENT_TRIGGER_COOLDOWN_MIN_SECONDS,
    ROUTINE_MAX_TRIGGERS,
    type RoutineEventFilter,
    type RoutineTriggerInput,
    routineTriggerListInputSchema,
    type RoutineTriggerRecord,
    type RoutineTriggerStatus,
    type RoutineTriggerWriteStatus,
} from '@/types/routines';

import { createDefaultSchedule } from '../constants';
import type { ScheduleFormValue } from '../types';

import {
    cronToSchedule,
    describeSchedule,
    isOnceDateInPast,
    parseRunAt,
    scheduleToCron,
    scheduleToRunAt,
    validateSchedule,
} from './cron-schedule';

export type TriggerKind = 'schedule' | 'manual' | 'event';

export type TriggerReadOnlyReason = 'legacy' | 'event' | 'unreadable' | null;

export interface TriggerFormValue {
    key: string;
    /** Null for a row the api synthesised from a routine's pre-trigger columns, and for a row not saved yet. */
    triggerId: string | null;
    kind: TriggerKind;
    /** The stored row's own type, which is what `kind` collapses `cron` and `once` out of. */
    storedType: RoutineTriggerRecord['type'] | null;
    schedule: ScheduleFormValue;
    /** Per trigger, not per routine: two triggers of one routine may sit in different zones. */
    timezone: string;
    /** The stored cron when this form cannot express it, so saving keeps it verbatim. */
    customCron?: string;
    cron: string | null;
    /** The stored one-shot wall clock, so re-saving an untouched past date is not rejected as being in the past. */
    storedRunAt: string | null;
    status: RoutineTriggerStatus;
    /** Set when this form cannot express the stored trigger, so it may only be displayed. */
    readOnlyReason: TriggerReadOnlyReason;
    legacy: boolean;
    synced: boolean;
    eventSource: string | null;
    eventFilter: RoutineEventFilter | null;
    cooldownSeconds: number;
    /** False for the empty slot the form keeps as a manual row; true once manual is a choice someone made. */
    explicit: boolean;
}

export const COOLDOWN_SECONDS_OPTIONS = [60, 300, 900, 1800, 3600, 21600, 86400];

let createdTriggerCount = 0;

const emptyTrigger = (kind: TriggerKind, key: string, timezone: string): TriggerFormValue => ({
    key,
    triggerId: null,
    kind,
    storedType: null,
    schedule: createDefaultSchedule(),
    timezone,
    readOnlyReason: null,
    cron: null,
    storedRunAt: null,
    status: 'active',
    legacy: false,
    synced: true,
    eventSource: null,
    eventFilter: null,
    cooldownSeconds: 0,
    explicit: false,
});

export const createTriggerFormValue = (timezone: string): TriggerFormValue => {
    createdTriggerCount += 1;

    return emptyTrigger('schedule', `new-${createdTriggerCount}`, timezone);
};

const kindOf = (type: RoutineTriggerRecord['type']): TriggerKind => {
    if (type === 'manual') return 'manual';
    if (type === 'event') return 'event';

    return 'schedule';
};

const scheduleOf = (record: RoutineTriggerRecord): ScheduleFormValue | null => {
    if (record.type === 'once') return cronToSchedule(null, true, record.runAt);
    if (record.type === 'cron') return cronToSchedule(record.cron);

    return null;
};

const readOnlyReasonOf = (record: RoutineTriggerRecord, isReadable: boolean): TriggerReadOnlyReason => {
    if (record.legacy) return 'legacy';
    if (record.type === 'event') return 'event';

    return isReadable ? null : 'unreadable';
};

const recordToFormValue = (record: RoutineTriggerRecord, index: number): TriggerFormValue => {
    const parsed = scheduleOf(record);
    const customCron = record.type === 'cron' && !parsed ? (record.cron ?? undefined) : undefined;
    const isReadable = Boolean(parsed || customCron || record.type === 'manual' || record.type === 'event');

    return {
        ...emptyTrigger(kindOf(record.type), record._id ?? `legacy-${index}`, record.timezone),
        triggerId: record._id,
        storedType: record.type,
        schedule: parsed ?? { ...createDefaultSchedule(), frequency: customCron ? 'custom' : 'once' },
        readOnlyReason: readOnlyReasonOf(record, isReadable),
        customCron,
        cron: record.cron,
        storedRunAt: record.runAt,
        status: record.status,
        legacy: record.legacy,
        synced: record.synced,
        eventSource: record.eventSource,
        eventFilter: record.eventFilter,
        cooldownSeconds: record.cooldownSeconds,
        explicit: true,
    };
};

export const triggersFromRecords = (records: RoutineTriggerRecord[]): TriggerFormValue[] =>
    records.map(recordToFormValue);

export const isTriggerReadOnly = (value: TriggerFormValue): boolean => value.readOnlyReason !== null;

/** The form's empty slot: a manual row nobody picked, drawn as the Add box instead of a trigger row. */
export const isManualPlaceholder = (value: TriggerFormValue): boolean =>
    value.kind === 'manual' && !value.explicit && !isTriggerReadOnly(value);

// The api rejects an empty set (probed live: `triggers: []` answers 400), so the last row swaps for a manual trigger.
export const canRemoveTrigger = (value: TriggerFormValue): boolean => !isTriggerReadOnly(value);

export const formatCooldown = (seconds: number): string => {
    if (seconds < 60) return `${seconds} sec`;
    if (seconds % 3600 === 0) return `${seconds / 3600} hr`;

    return `${Math.round(seconds / 60)} min`;
};

// Reads the stored columns, so it describes only rows this form cannot edit: legacy and stored event ones.
export const readOnlyTriggerSummary = (value: TriggerFormValue): string => {
    if (value.kind === 'event') {
        const source = value.eventSource ?? 'an event';

        return `Runs on ${source}, at most once every ${formatCooldown(value.cooldownSeconds)}.`;
    }

    if (value.kind === 'manual') return 'Runs only when you start it by hand.';

    return describeSchedule(value.cron, value.storedType === 'once', value.storedRunAt) || 'No schedule set.';
};

const resolveTriggerCron = (value: TriggerFormValue): string => {
    if (value.schedule.frequency === 'custom' && value.customCron) return value.customCron;

    return scheduleToCron({
        ...value.schedule,
        frequency: value.schedule.frequency === 'custom' ? 'daily' : value.schedule.frequency,
    });
};

// `spent` is set by the api when a one-shot fires and is not a status a client may send; re-sending it as
// `active` would re-arm a trigger that already ran.
const writeStatus = (status: RoutineTriggerStatus): RoutineTriggerWriteStatus =>
    status === 'spent' ? 'paused' : status;

export const toTriggerInput = (value: TriggerFormValue): RoutineTriggerInput => {
    const status = writeStatus(value.status);
    const timezone = value.timezone;

    if (value.kind === 'manual') return { type: 'manual', status };

    if (value.kind === 'event') {
        return {
            type: 'event',
            eventSource: value.eventSource ?? '',
            eventFilter: value.eventFilter,
            // A stored cooldown is carried across as it is: raising it would change a throttle the user
            // cannot even see, since a stored event row has no picker.
            cooldownSeconds: isTriggerReadOnly(value)
                ? value.cooldownSeconds
                : Math.max(value.cooldownSeconds, EVENT_TRIGGER_COOLDOWN_MIN_SECONDS),
            status,
        };
    }

    // A row this form cannot express is written back from the columns it was read from, never from the
    // placeholder schedule shown in its place.
    if (isTriggerReadOnly(value)) {
        if (value.storedType === 'once' && value.storedRunAt) {
            return { type: 'once', runAt: value.storedRunAt, timezone, status };
        }

        return { type: 'cron', cron: value.cron ?? '', timezone, status };
    }

    if (value.schedule.frequency === 'once') {
        return { type: 'once', runAt: scheduleToRunAt(value.schedule), timezone, status };
    }

    return { type: 'cron', cron: resolveTriggerCron(value), timezone, status };
};

/**
 * A `triggers` key on a routine write replaces the whole set in one transaction, so every row the form
 * holds — including the ones it can only display — has to survive as an input.
 */
export const toTriggerInputs = (values: TriggerFormValue[]): RoutineTriggerInput[] =>
    routineTriggerListInputSchema.parse(values.map(toTriggerInput));

/**
 * A stored row that cannot be turned back into an input would be dropped by a whole-set write, so its
 * presence is what takes trigger editing off the form entirely.
 *
 * A legacy row counts as unwritable on purpose: it is synthesised from the routine's own `cron`/`runAt`
 * columns, and whether writing the set stops the api synthesising it is unconfirmed — materialising it
 * would double the schedule if it does not.
 */
export const isTriggerWritable = (value: TriggerFormValue): boolean => {
    if (value.legacy) return false;
    if (value.kind === 'manual') return true;

    if (value.kind === 'event') {
        return (
            Boolean(value.eventSource) &&
            Number.isInteger(value.cooldownSeconds) &&
            value.cooldownSeconds >= EVENT_TRIGGER_COOLDOWN_MIN_SECONDS
        );
    }

    if (!isTriggerReadOnly(value)) return true;
    if (value.storedType === 'once') return Boolean(value.storedRunAt);

    return Boolean(value.cron);
};

/**
 * Resuming arms a trigger, so a one-shot whose clock has already gone by must not offer it. The api parks a
 * fired one-shot as `spent`, a status no client may send, so a whole-set write can only carry it back as
 * `paused` — and a plain Resume would then schedule a date in the past.
 *
 * An editable row is judged on the date now in the form, not the stored one: editing a paused one-shot to a
 * future date is the only way back to armed, so the check has to see that edit.
 */
export const canArmTrigger = (value: TriggerFormValue, now: Date): boolean => {
    if (isTriggerReadOnly(value)) {
        if (value.storedType !== 'once' || !value.storedRunAt) return true;

        const parts = parseRunAt(value.storedRunAt);

        return !parts || !isOnceDateInPast(parts, now, value.timezone);
    }

    if (value.kind !== 'schedule' || value.schedule.frequency !== 'once') return true;

    return !isOnceDateInPast(value.schedule, now, value.timezone);
};

export const validateTrigger = (value: TriggerFormValue, now: Date): string | undefined => {
    if (isTriggerReadOnly(value)) return undefined;
    if (value.kind === 'event') return value.eventSource ? undefined : 'Pick an event source';
    if (value.kind !== 'schedule') return undefined;

    return validateSchedule(value.schedule, now, value.timezone, value.storedRunAt);
};

export const validateTriggers = (values: TriggerFormValue[], now: Date): string | undefined => {
    if (values.length === 0) return 'A routine needs at least one trigger';
    if (values.length > ROUTINE_MAX_TRIGGERS) return `A routine can have at most ${ROUTINE_MAX_TRIGGERS} triggers`;

    for (const value of values) {
        const error = validateTrigger(value, now);

        if (error) return error;
    }

    return undefined;
};
