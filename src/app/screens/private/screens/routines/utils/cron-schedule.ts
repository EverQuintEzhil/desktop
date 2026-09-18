import { cronToStatement } from '@/utils';

import { ALL_WEEKDAYS, formatHourLabel, MONTH_LABELS, WEEKDAY_LABELS } from '../constants';
import type { ScheduleFormValue, ScheduleValue } from '../types';

import { isValidMonthDay, isValidYearMonthDay, nextOccurrenceYear } from './month-day';
import { timezoneLabel, timezoneSuffixForViewer } from './timezone-label';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const RUN_AT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

const pad = (value: number): string => String(value).padStart(2, '0');

const parseTime = (time: string): { hour: number; minute: number } => {
    const match = TIME_PATTERN.exec(time);

    if (!match) return { hour: 9, minute: 0 };

    return { hour: Number(match[1]), minute: Number(match[2]) };
};

const numericField = (field: string, min: number, max: number): number | null => {
    if (!/^\d{1,2}$/.test(field)) return null;
    const value = Number(field);

    return value >= min && value <= max ? value : null;
};

const isEveryDay = (weekdays: number[]): boolean => weekdays.length === ALL_WEEKDAYS.length;

export const weekdaySetLabel = (weekdays: number[]): string => {
    if (isEveryDay(weekdays)) return 'Every day';
    if (weekdays.join(',') === '1,2,3,4,5') return 'Weekdays';
    if (weekdays.join(',') === '0,6') return 'Weekends';

    return weekdays.map((day) => WEEKDAY_LABELS[day]).join(', ');
};

const isConsecutive = (weekdays: number[]): boolean =>
    weekdays.every((day, index) => index === 0 || day === weekdays[index - 1] + 1);

// A consecutive run keeps the range spelling so a stored `1-5` re-saves byte-identical.
const weekdaysField = (weekdays: number[]): string => {
    if (isEveryDay(weekdays)) return '*';
    if (weekdays.length > 1 && isConsecutive(weekdays)) return `${weekdays[0]}-${weekdays[weekdays.length - 1]}`;

    return weekdays.join(',');
};

// Only a strictly ascending, non-full-week list re-emits byte-identical; anything else stays on the custom-cron path.
const parseWeekdaysField = (field: string): number[] | null => {
    if (field === '*') return [...ALL_WEEKDAYS];

    const range = /^(\d)-(\d)$/.exec(field);

    if (range) {
        const start = Number(range[1]);
        const end = Number(range[2]);

        if (start >= end || end > 6) return null;

        const days = Array.from({ length: end - start + 1 }, (_, at) => start + at);

        return isEveryDay(days) ? null : days;
    }

    const days = field.split(',').map((day) => numericField(day, 0, 6));

    if (days.some((day) => day === null)) return null;

    const parsed = days as number[];

    if (parsed.some((day, index) => index > 0 && day <= parsed[index - 1])) return null;

    return isEveryDay(parsed) ? null : parsed;
};

const hourWindowField = (startHour: number, endHour: number): string =>
    startHour === 0 && endHour === 23 ? '*' : `${startHour}-${endHour}`;

const parseHourWindow = (field: string): { startHour: number; endHour: number } | null => {
    if (field === '*') return { startHour: 0, endHour: 23 };

    const match = /^(\d{1,2})-(\d{1,2})$/.exec(field);

    if (!match) return null;

    const startHour = Number(match[1]);
    const endHour = Number(match[2]);

    if (startHour > 23 || endHour > 23 || startHour > endHour) return null;
    if (startHour === 0 && endHour === 23) return null;

    return { startHour, endHour };
};

export type OnceDateParts = Pick<ScheduleValue, 'year' | 'month' | 'monthDay' | 'time'>;

export const isValidTime = (time: string): boolean => TIME_PATTERN.test(time);

export const parseRunAt = (runAt: string): OnceDateParts | null => {
    const match = RUN_AT_PATTERN.exec(runAt.trim());

    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const monthDay = Number(match[3]);

    if (!isValidYearMonthDay(year, month, monthDay)) return null;

    return {
        year,
        month,
        monthDay,
        time: `${match[4]}:${match[5]}`,
    };
};

export const scheduleToRunAt = (schedule: OnceDateParts): string => {
    const { hour, minute } = parseTime(schedule.time);

    return `${schedule.year}-${pad(schedule.month)}-${pad(schedule.monthDay)}T${pad(hour)}:${pad(minute)}:00`;
};

export const scheduleToDate = (schedule: OnceDateParts): Date => {
    const { hour, minute } = parseTime(schedule.time);

    return new Date(schedule.year, schedule.month - 1, schedule.monthDay, hour, minute, 0, 0);
};

const CLOCK_PART_TYPES = new Set(['year', 'month', 'day', 'hour', 'minute', 'second']);

const pinnedDate = (year: number, month: number, day: number, hour: number, minute: number, second: number): Date =>
    new Date(Date.UTC(year, month - 1, day, hour, minute, second));

const wallClockInTimezone = (instant: Date, timezone: string): number | null => {
    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            hourCycle: 'h23',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
        const parts: Record<string, number> = {};

        formatter.formatToParts(instant).forEach(({ type, value }) => {
            if (CLOCK_PART_TYPES.has(type)) parts[type] = Number(value);
        });

        return pinnedDate(parts.year, parts.month, parts.day, parts.hour, parts.minute, parts.second).getTime();
    } catch {
        return null;
    }
};

const nowInTimezone = (now: Date, timezone: string): Date | null => {
    const wallClock = wallClockInTimezone(now, timezone);

    return wallClock === null ? null : new Date(wallClock);
};

const instantForWallClock = (pinned: Date, timezone: string): Date | null => {
    const target = pinned.getTime();
    const firstWallClock = wallClockInTimezone(pinned, timezone);

    if (firstWallClock === null) return null;

    const first = new Date(target - (firstWallClock - target));
    const secondWallClock = wallClockInTimezone(first, timezone);

    if (secondWallClock === null) return null;

    return new Date(target - (secondWallClock - first.getTime()));
};

const isNonexistentLocalTime = (pinned: Date, timezone: string): boolean => {
    const instant = instantForWallClock(pinned, timezone);

    if (!instant) return false;

    const wallClock = wallClockInTimezone(instant, timezone);

    return wallClock !== null && wallClock !== pinned.getTime();
};

const pinnedSchedule = (schedule: OnceDateParts): Date => {
    const { hour, minute } = parseTime(schedule.time);

    return pinnedDate(schedule.year, schedule.month, schedule.monthDay, hour, minute, 0);
};

const isOnceInPast = (schedule: OnceDateParts, now: Date, zonedNow: Date | null): boolean => {
    if (!zonedNow) return scheduleToDate(schedule).getTime() <= now.getTime();

    return pinnedSchedule(schedule).getTime() <= zonedNow.getTime();
};

export const isOnceDateInPast = (schedule: OnceDateParts, now: Date, timezone?: string): boolean =>
    isOnceInPast(schedule, now, timezone ? nowInTimezone(now, timezone) : null);

const SEED_MARGIN_MS = 2 * 60_000;
const SEED_STEP_MS = 5 * 60_000;

// Real UTC offsets are all multiples of 5 minutes, so epoch rounding lands on a wall-clock boundary too.
const seedTime = (base: number): number => Math.ceil((base + SEED_MARGIN_MS) / SEED_STEP_MS) * SEED_STEP_MS;

/** The next 5-minute mark at least 2 minutes out in the trigger's zone, so the default outlives form filling. */
export const onceScheduleSeed = (now: Date = new Date(), timezone?: string): OnceDateParts => {
    const zoned = timezone ? nowInTimezone(now, timezone) : null;

    if (zoned) {
        // `nowInTimezone` pins the zone's wall clock onto UTC getters.
        const next = new Date(seedTime(zoned.getTime()));

        return {
            year: next.getUTCFullYear(),
            month: next.getUTCMonth() + 1,
            monthDay: next.getUTCDate(),
            time: `${pad(next.getUTCHours())}:${pad(next.getUTCMinutes())}`,
        };
    }

    const next = new Date(seedTime(now.getTime()));

    return {
        year: next.getFullYear(),
        month: next.getMonth() + 1,
        monthDay: next.getDate(),
        time: `${pad(next.getHours())}:${pad(next.getMinutes())}`,
    };
};

const isStoredRunAt = (schedule: OnceDateParts, storedRunAt?: string | null): boolean => {
    if (!storedRunAt) return false;

    const stored = parseRunAt(storedRunAt);

    if (!stored) return false;

    return scheduleToRunAt(stored) === scheduleToRunAt(schedule);
};

const validateOnce = (
    schedule: ScheduleFormValue,
    now: Date,
    timezone?: string,
    storedRunAt?: string | null,
): string | undefined => {
    if (!isValidYearMonthDay(schedule.year, schedule.month, schedule.monthDay)) return 'Pick a valid date';

    if (timezone && isNonexistentLocalTime(pinnedSchedule(schedule), timezone)) {
        return (
            `That date and time does not exist in ${timezone} — the clocks jump forward for daylight saving.` +
            ' Pick another time.'
        );
    }

    if (isStoredRunAt(schedule, storedRunAt)) return undefined;

    const zonedNow = timezone ? nowInTimezone(now, timezone) : null;

    if (!isOnceInPast(schedule, now, zonedNow)) return undefined;

    return zonedNow && timezone
        ? `Pick a date and time in the future (${timezoneLabel(timezone, now)})`
        : 'Pick a date and time in the future, compared with this device clock';
};

export const validateSchedule = (
    schedule: ScheduleFormValue,
    now: Date = new Date(),
    timezone?: string,
    storedRunAt?: string | null,
): string | undefined => {
    if (schedule.frequency === 'custom') return undefined;

    if (schedule.frequency === 'hourly' || schedule.frequency === 'weekly') {
        if (schedule.weekdays.length === 0) return 'Pick at least one day';
    }

    if (schedule.frequency === 'hourly') {
        if (schedule.startHour > schedule.endHour) return 'The window must start before it ends';

        return undefined;
    }

    if (!isValidTime(schedule.time)) return 'Pick a time of day';

    if (schedule.frequency === 'once') return validateOnce(schedule, now, timezone, storedRunAt);

    if (schedule.frequency === 'yearly' && !isValidMonthDay(schedule.month, schedule.monthDay)) {
        return 'Pick a valid date';
    }

    return undefined;
};

export const scheduleToCron = (schedule: ScheduleValue): string => {
    const { hour, minute } = parseTime(schedule.time);

    switch (schedule.frequency) {
        case 'hourly':
            return `0 ${hourWindowField(schedule.startHour, schedule.endHour)} * * ${weekdaysField(schedule.weekdays)}`;
        case 'daily':
            return `${minute} ${hour} * * *`;
        case 'weekly':
            return `${minute} ${hour} * * ${weekdaysField(schedule.weekdays)}`;
        case 'monthly':
            return `${minute} ${hour} ${schedule.monthDay} * *`;
        case 'once':
        case 'yearly':
            return `${minute} ${hour} ${schedule.monthDay} ${schedule.month} *`;
    }
};

const baseSchedule = () => ({
    time: '09:00',
    weekdays: [1],
    monthDay: 1,
    month: 1,
    year: new Date().getFullYear(),
    startHour: 9,
    endHour: 18,
});

const parseHourly = (hourField: string, weekdayField: string): ScheduleValue | null => {
    const window = parseHourWindow(hourField);
    const weekdays = parseWeekdaysField(weekdayField);

    if (!window || !weekdays) return null;

    return {
        ...baseSchedule(),
        frequency: 'hourly',
        weekdays,
        ...window,
    };
};

type ParsedBase = ReturnType<typeof baseSchedule>;

const parseWeekly = (base: ParsedBase, weekdayField: string): ScheduleValue | null => {
    if (weekdayField === '*') return { ...base, frequency: 'daily' };

    const weekdays = parseWeekdaysField(weekdayField);

    return weekdays === null ? null : { ...base, frequency: 'weekly', weekdays };
};

const parseDated = (base: ParsedBase, dayField: string, monthField: string): ScheduleValue | null => {
    const monthDay = numericField(dayField, 1, 31);

    if (monthDay === null) return null;

    if (monthField === '*') return { ...base, frequency: 'monthly', monthDay };

    const month = numericField(monthField, 1, 12);

    if (month === null || !isValidMonthDay(month, monthDay)) return null;

    return {
        ...base,
        frequency: 'yearly',
        monthDay,
        month,
    };
};

const parseCron = (cron: string): ScheduleValue | null => {
    const fields = cron.trim().split(/\s+/);

    if (fields.length !== 5) return null;

    const [minuteField, hourField, dayField, monthField, weekdayField] = fields;
    const minute = numericField(minuteField, 0, 59);

    if (minute === null) return null;

    if (hourField === '*' || hourField.includes('-')) {
        if (minute !== 0 || dayField !== '*' || monthField !== '*') return null;

        return parseHourly(hourField, weekdayField);
    }

    const hour = numericField(hourField, 0, 23);

    if (hour === null) return null;

    const base = { ...baseSchedule(), time: `${pad(hour)}:${pad(minute)}` };

    if (dayField === '*' && monthField === '*') return parseWeekly(base, weekdayField);
    if (weekdayField !== '*') return null;

    return parseDated(base, dayField, monthField);
};

export const cronToSchedule = (
    cron: string | null,
    runOnce: boolean = false,
    runAt?: string | null,
): ScheduleValue | null => {
    if (runOnce && runAt) {
        const parts = parseRunAt(runAt);

        if (parts) {
            return {
                ...baseSchedule(),
                frequency: 'once',
                ...parts,
            };
        }
    }

    const parsed = cron ? parseCron(cron) : null;

    if (!runOnce) return parsed;
    if (parsed?.frequency !== 'yearly') return null;

    return {
        ...parsed,
        frequency: 'once',
        year: nextOccurrenceYear(parsed.month, parsed.monthDay),
    };
};

const describeHourly = (schedule: ScheduleValue): string => {
    const scopeLabel = weekdaySetLabel(schedule.weekdays);
    const scopePart =
        scopeLabel === 'Every day'
            ? ''
            : ` on ${scopeLabel === 'Weekdays' || scopeLabel === 'Weekends' ? scopeLabel.toLowerCase() : scopeLabel}`;
    const isAllDay = schedule.startHour === 0 && schedule.endHour === 23;
    const windowPart = isAllDay
        ? ''
        : `, ${formatHourLabel(schedule.startHour)} – ${formatHourLabel(schedule.endHour)}`;

    return `Hourly${scopePart}${windowPart}`;
};

const LIST_FIELD_PATTERN = /^\d+(,\d+)+$/;

const normaliseWeekdayField = (cron: string): string => {
    const fields = cron.trim().split(/\s+/);

    if (fields.length !== 5) return cron;

    const weekdayField = fields[4];

    if (weekdayField === '7') return [...fields.slice(0, 4), '0'].join(' ');
    if (!LIST_FIELD_PATTERN.test(weekdayField) || !weekdayField.split(',').includes('7')) return cron;

    const days = [...new Set(weekdayField.split(',').map((day) => (day === '7' ? '0' : day)))];

    return [...fields.slice(0, 4), days.join(',')].join(' ');
};

const formatClockLabel = (time: string): string => {
    const { hour, minute } = parseTime(time);
    const suffix = hour < 12 ? 'AM' : 'PM';
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;

    return `${displayHour}:${pad(minute)} ${suffix}`;
};

const describeOnce = (runAt: string): string | null => {
    const parts = parseRunAt(runAt);

    if (!parts) return null;

    const day = `${MONTH_LABELS[parts.month - 1]} ${parts.monthDay}, ${parts.year}`;

    return `Once on ${day} at ${formatClockLabel(parts.time)}`;
};

export const describeSchedule = (cron: string | null, runOnce?: boolean, runAt?: string | null): string => {
    const normalised = cron ? normaliseWeekdayField(cron) : '';
    const parsed = parseCron(normalised);

    if (parsed?.frequency === 'hourly') return describeHourly(parsed);

    if (runOnce) {
        const onceLabel = runAt ? describeOnce(runAt) : null;

        if (onceLabel) return onceLabel;
        if (parsed?.frequency === 'yearly') return `Once on ${cronToStatement(normalised)}`;
    }

    // An event-only routine has no cron at all; `cronToStatement` would answer the literal "Not set".
    return normalised ? cronToStatement(normalised) : '';
};

/** The schedule line with a zone tag only when the routine fires outside the viewer's own zone. */
export const describeScheduleWithZone = (
    cron: string | null,
    runOnce?: boolean,
    runAt?: string | null,
    timezone?: string | null,
): string => {
    const base = describeSchedule(cron, runOnce, runAt);
    const zone = timezoneSuffixForViewer(timezone);

    return base && zone ? `${base} · ${zone}` : base;
};
