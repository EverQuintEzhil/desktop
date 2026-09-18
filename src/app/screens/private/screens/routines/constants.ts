import { CircleAlertIcon, PlugZapIcon } from 'lucide-react';

import type { RoutineRunStatus, RunAttentionCounts } from '@/types/routines';

import type { ScheduleFormFrequency, ScheduleFormValue } from './types';
import { DAYS_IN_MONTH, encodeMonthDay } from './utils/month-day';

interface LabelledOption {
    value: string;
    label: string;
}

export interface FrequencyOption {
    value: ScheduleFormFrequency;
    label: string;
}

export const formatHourLabel = (hour: number): string => {
    const suffix = hour < 12 ? 'AM' : 'PM';
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;

    return `${displayHour}:00 ${suffix}`;
};

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const FREQUENCY_OPTIONS: FrequencyOption[] = [
    { value: 'once', label: 'Once' },
    { value: 'hourly', label: 'Hourly' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' },
];

export const CUSTOM_FREQUENCY_OPTION: FrequencyOption = { value: 'custom', label: 'Custom (unchanged)' };

export const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

// Hourly reads an empty-feeling default as "every day"; weekly is a pick-a-day cadence, so it starts on one.
export const weekdaysSeed = (frequency: ScheduleFormFrequency): number[] =>
    frequency === 'hourly' ? [...ALL_WEEKDAYS] : [1];

export const HOUR_OPTIONS: LabelledOption[] = Array.from({ length: 24 }, (_, hour) => ({
    value: String(hour),
    label: formatHourLabel(hour),
}));

export const MONTH_DAY_OPTIONS: LabelledOption[] = Array.from({ length: 31 }, (_, index) => ({
    value: String(index + 1),
    label: `Day ${index + 1}`,
}));

export const YEARLY_MONTH_DAY_OPTIONS: LabelledOption[] = DAYS_IN_MONTH.flatMap((days, index) => {
    const month = index + 1;

    return Array.from({ length: days }, (_, dayIndex) => ({
        value: encodeMonthDay(month, dayIndex + 1),
        label: `${MONTH_LABELS[index]} ${dayIndex + 1}`,
    }));
});

export const MONTH_DAY_SEED_MAX = 28;

export const clampMonthDaySeed = (monthDay: number): number => Math.min(Math.max(monthDay, 1), MONTH_DAY_SEED_MAX);

export const createDefaultSchedule = (now: Date = new Date()): ScheduleFormValue => ({
    frequency: 'daily',
    time: '09:00',
    weekdays: [1],
    monthDay: now.getDate(),
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    startHour: 9,
    endHour: 18,
});

export const ONCE_DATE_FORMAT = 'LLL d, yyyy';

export const NAME_MAX_LENGTH = 200;

export const PROMPT_MAX_LENGTH = 10000;

/** `GET /routines?archived` is a strict boolean — `archived=all` is a 400 — so archived lives behind its own view. */
export const ARCHIVED_VIEW_PARAM = 'view';

export const ARCHIVED_VIEW_VALUE = 'archived';

export type RoutineStatusFilter = 'all' | 'active' | 'paused';

export const ROUTINE_STATUS_FILTER_OPTIONS: { value: RoutineStatusFilter; label: string }[] = [
    { value: 'all', label: 'All statuses' },
    { value: 'active', label: 'Active' },
    { value: 'paused', label: 'Paused' },
];

export const isRoutineStatusFilter = (value: string | null): value is RoutineStatusFilter =>
    ROUTINE_STATUS_FILTER_OPTIONS.some((option) => option.value === value);

/** The only spelling of a run status a person is shown; the raw enum is never rendered. */
export const RUN_STATUS_LABELS: Record<RoutineRunStatus, string> = {
    running: 'Running',
    completed: 'Completed',
    needs_reconnect: 'Needs reconnect',
    failed: 'Failed',
    skipped: 'Skipped',
};

export const runAttentionTotal = (counts: RunAttentionCounts): number => counts.needsReconnect + counts.failed;

/** Names the count without naming either status, since one chip stands for both. */
export const runAttentionLabel = (total: number): string =>
    total === 1 ? '1 needs attention' : `${total} need attention`;

export type RunAttentionTone = 'destructive' | 'neutral';

/**
 * The one place the group's tone is decided, so the two chips cannot come to different answers.
 * There is no `warning` token in index.css, and destructive would read as the failure a reconnect
 * exists to stop reporting, so a reconnect-only group stays neutral.
 */
export const runAttentionTone = (counts: RunAttentionCounts): RunAttentionTone =>
    counts.failed > 0 ? 'destructive' : 'neutral';

export const RUN_ATTENTION_ICONS: Record<RunAttentionTone, typeof CircleAlertIcon> = {
    destructive: CircleAlertIcon,
    neutral: PlugZapIcon,
};

export const RUN_ATTENTION_FILTER = 'needs_reconnect,failed';

/**
 * A filter is a SET of statuses, comma-joined so `?runStatus=needs_reconnect,failed` stays readable
 * and shareable. `GET /routines/:id/runs?status=` has taken a comma list since it was written, so the
 * combined value needs nothing from the api. Running and skipped are transient/noise states, so the
 * filter folds them into All.
 */
export type RunStatusFilter = 'all' | 'completed' | 'needs_reconnect' | 'failed' | typeof RUN_ATTENTION_FILTER;

export const RUN_STATUS_FILTER_OPTIONS: { value: RunStatusFilter; label: string }[] = [
    { value: 'all', label: 'All runs' },
    { value: 'completed', label: 'Completed' },
    { value: RUN_ATTENTION_FILTER, label: 'Needs attention' },
    { value: 'needs_reconnect', label: 'Needs reconnect' },
    { value: 'failed', label: 'Failed' },
];

export const isRunStatusFilter = (value: string | null): value is RunStatusFilter =>
    RUN_STATUS_FILTER_OPTIONS.some((option) => option.value === value);

export const runStatusFilterLabel = (filter: RunStatusFilter): string =>
    RUN_STATUS_FILTER_OPTIONS.find((option) => option.value === filter)?.label ?? 'All runs';

/** `all` is the absence of a filter, which the api spells as an absent param rather than every value. */
export const runStatusFilterStatuses = (filter: RunStatusFilter): RoutineRunStatus[] =>
    filter === 'all' ? [] : (filter.split(',') as RoutineRunStatus[]);

/**
 * The one derivation both chips use, so a chip's destination can never hold a different set of runs
 * from the one its count came from.
 */
export const attentionRunStatusFilter = (counts: RunAttentionCounts): RunStatusFilter | null => {
    if (counts.needsReconnect > 0 && counts.failed > 0) return RUN_ATTENTION_FILTER;
    if (counts.failed > 0) return 'failed';
    if (counts.needsReconnect > 0) return 'needs_reconnect';

    return null;
};

export type RoutineSort = 'next-run' | 'name' | 'last-run' | 'created';

/** `GET /routines` orders on the server and rejects an unknown sort field with a 400. */
export const ROUTINE_SORT_PARAM: Record<RoutineSort, string> = {
    'next-run': 'nextRunAt:asc',
    name: 'name:asc',
    'last-run': 'lastRunAt:desc',
    created: 'createdAt:desc',
};

export const ROUTINE_SORT_OPTIONS: { key: RoutineSort; label: string; value: RoutineSort }[] = [
    { key: 'next-run', label: 'Sort by next run', value: 'next-run' },
    { key: 'name', label: 'Sort by name', value: 'name' },
    { key: 'last-run', label: 'Sort by last run', value: 'last-run' },
    { key: 'created', label: 'Sort by newest', value: 'created' },
];

export const isRoutineSort = (value: string | null): value is RoutineSort =>
    ROUTINE_SORT_OPTIONS.some((option) => option.value === value);
