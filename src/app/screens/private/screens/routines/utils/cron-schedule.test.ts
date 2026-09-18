import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { routineSchema } from '@/types/routines';

import { clampMonthDaySeed, createDefaultSchedule, YEARLY_MONTH_DAY_OPTIONS } from '../constants';
import type { ScheduleFormValue, ScheduleValue } from '../types';

import {
    cronToSchedule,
    describeSchedule,
    isValidTime,
    onceScheduleSeed,
    parseRunAt,
    scheduleToCron,
    scheduleToRunAt,
    validateSchedule,
} from './cron-schedule';

const schedule = (overrides: Partial<ScheduleValue> = {}): ScheduleValue => ({
    frequency: 'daily',
    time: '07:30',
    weekdays: [1],
    monthDay: 1,
    month: 1,
    year: 2026,
    startHour: 9,
    endHour: 18,
    ...overrides,
});

const formValue = (overrides: Partial<ScheduleFormValue> = {}): ScheduleFormValue => ({
    ...schedule(),
    ...overrides,
});

describe('scheduleToCron', () => {
    it('builds the reference hourly expression', () => {
        expect(scheduleToCron(schedule({ frequency: 'hourly', weekdays: [0, 1, 2, 3, 4, 5, 6] }))).toBe('0 9-18 * * *');
    });

    it('emits a wildcard hour for a full-day hourly window', () => {
        expect(
            scheduleToCron(
                schedule({ frequency: 'hourly', weekdays: [0, 1, 2, 3, 4, 5, 6], startHour: 0, endHour: 23 }),
            ),
        ).toBe('0 * * * *');
    });

    it('maps the hourly day set onto day-of-week', () => {
        expect(scheduleToCron(schedule({ frequency: 'hourly', weekdays: [1, 2, 3, 4, 5] }))).toBe('0 9-18 * * 1-5');
        expect(scheduleToCron(schedule({ frequency: 'hourly', weekdays: [0, 6] }))).toBe('0 9-18 * * 0,6');
        expect(scheduleToCron(schedule({ frequency: 'hourly', weekdays: [1, 2, 4] }))).toBe('0 9-18 * * 1,2,4');
        expect(
            scheduleToCron(
                schedule({
                    frequency: 'hourly',
                    weekdays: [0, 6],
                    startHour: 0,
                    endHour: 23,
                }),
            ),
        ).toBe('0 * * * 0,6');
    });

    it('ignores the time for hourly', () => {
        expect(scheduleToCron(schedule({ frequency: 'hourly', weekdays: [0, 1, 2, 3, 4, 5, 6], time: '' }))).toBe(
            '0 9-18 * * *',
        );
    });

    it('builds a single-hour hourly window', () => {
        expect(
            scheduleToCron(
                schedule({ frequency: 'hourly', weekdays: [0, 1, 2, 3, 4, 5, 6], startHour: 9, endHour: 9 }),
            ),
        ).toBe('0 9-9 * * *');
    });

    it('builds a daily expression', () => {
        expect(scheduleToCron(schedule())).toBe('30 7 * * *');
        expect(scheduleToCron(schedule({ time: '10:40' }))).toBe('40 10 * * *');
    });

    it('builds a weekly expression', () => {
        expect(scheduleToCron(schedule({ frequency: 'weekly', weekdays: [1] }))).toBe('30 7 * * 1');
        expect(scheduleToCron(schedule({ frequency: 'weekly', weekdays: [0] }))).toBe('30 7 * * 0');
        expect(scheduleToCron(schedule({ frequency: 'weekly', weekdays: [6], time: '10:40' }))).toBe('40 10 * * 6');
    });

    it('builds a multi-day weekly expression', () => {
        expect(scheduleToCron(schedule({ frequency: 'weekly', weekdays: [1, 2, 4] }))).toBe('30 7 * * 1,2,4');
        expect(scheduleToCron(schedule({ frequency: 'weekly', weekdays: [1, 2, 3, 4, 5] }))).toBe('30 7 * * 1-5');
        expect(scheduleToCron(schedule({ frequency: 'weekly', weekdays: [0, 6] }))).toBe('30 7 * * 0,6');
        expect(scheduleToCron(schedule({ frequency: 'weekly', weekdays: [0, 1, 2, 3, 4, 5, 6] }))).toBe('30 7 * * *');
    });

    it('builds a monthly expression', () => {
        expect(scheduleToCron(schedule({ frequency: 'monthly', monthDay: 1 }))).toBe('30 7 1 * *');
        expect(scheduleToCron(schedule({ frequency: 'monthly', monthDay: 22, time: '10:40' }))).toBe('40 10 22 * *');
    });

    it('builds a yearly expression', () => {
        expect(scheduleToCron(schedule({ frequency: 'yearly', monthDay: 1, month: 1 }))).toBe('30 7 1 1 *');
        expect(
            scheduleToCron(
                schedule({
                    frequency: 'yearly',
                    monthDay: 22,
                    month: 8,
                    time: '10:40',
                }),
            ),
        ).toBe('40 10 22 8 *');
    });

    it('falls back to 09:00 for a malformed time', () => {
        expect(scheduleToCron(schedule({ time: '' }))).toBe('0 9 * * *');
        expect(scheduleToCron(schedule({ time: '99:99' }))).toBe('0 9 * * *');
    });

    it('zero-pads nothing in the cron fields', () => {
        expect(scheduleToCron(schedule({ time: '07:05' }))).toBe('5 7 * * *');
    });
});

describe('cronToSchedule', () => {
    it('parses the reference hourly expression', () => {
        expect(cronToSchedule('0 9-18 * * *')).toMatchObject({
            frequency: 'hourly',
            weekdays: [0, 1, 2, 3, 4, 5, 6],
            startHour: 9,
            endHour: 18,
        });
    });

    it('parses a bare hourly cron as every day, full day', () => {
        expect(cronToSchedule('0 * * * *')).toMatchObject({
            frequency: 'hourly',
            weekdays: [0, 1, 2, 3, 4, 5, 6],
            startHour: 0,
            endHour: 23,
        });
    });

    it('parses a weekday-scoped hourly window', () => {
        expect(cronToSchedule('0 9-18 * * 1-5')).toMatchObject({
            frequency: 'hourly',
            weekdays: [1, 2, 3, 4, 5],
            startHour: 9,
            endHour: 18,
        });
    });

    it('parses a weekend-scoped hourly window', () => {
        expect(cronToSchedule('0 9-18 * * 0,6')).toMatchObject({
            frequency: 'hourly',
            weekdays: [0, 6],
            startHour: 9,
            endHour: 18,
        });
        expect(cronToSchedule('0 * * * 0,6')).toMatchObject({
            frequency: 'hourly',
            weekdays: [0, 6],
            startHour: 0,
            endHour: 23,
        });
    });

    it('parses an arbitrary hourly day list', () => {
        expect(cronToSchedule('0 9-18 * * 1,2,4')).toMatchObject({
            frequency: 'hourly',
            weekdays: [1, 2, 4],
        });
        expect(cronToSchedule('0 9-18 * * 2-4')).toMatchObject({
            frequency: 'hourly',
            weekdays: [2, 3, 4],
        });
    });

    it('parses daily', () => {
        expect(cronToSchedule('30 7 * * *')).toMatchObject({ frequency: 'daily', time: '07:30' });
        expect(cronToSchedule('40 10 * * *')).toMatchObject({ frequency: 'daily', time: '10:40' });
    });

    it('parses weekly', () => {
        expect(cronToSchedule('30 7 * * 1')).toMatchObject({ frequency: 'weekly', time: '07:30', weekdays: [1] });
        expect(cronToSchedule('0 0 * * 0')).toMatchObject({ frequency: 'weekly', time: '00:00', weekdays: [0] });
        expect(cronToSchedule('40 10 * * 6')).toMatchObject({ frequency: 'weekly', time: '10:40', weekdays: [6] });
    });

    it('parses a multi-day weekly cron', () => {
        expect(cronToSchedule('0 9 * * 1-5')).toMatchObject({ frequency: 'weekly', weekdays: [1, 2, 3, 4, 5] });
        expect(cronToSchedule('0 9 * * 1,2,4')).toMatchObject({ frequency: 'weekly', weekdays: [1, 2, 4] });
        expect(cronToSchedule('0 9 * * 0,6')).toMatchObject({ frequency: 'weekly', weekdays: [0, 6] });
    });

    it('parses monthly', () => {
        expect(cronToSchedule('30 7 1 * *')).toMatchObject({ frequency: 'monthly', time: '07:30', monthDay: 1 });
        expect(cronToSchedule('40 10 22 * *')).toMatchObject({ frequency: 'monthly', time: '10:40', monthDay: 22 });
        expect(cronToSchedule('0 12 31 * *')).toMatchObject({ frequency: 'monthly', monthDay: 31 });
    });

    it('parses yearly', () => {
        expect(cronToSchedule('30 7 1 1 *')).toMatchObject({
            frequency: 'yearly',
            time: '07:30',
            monthDay: 1,
            month: 1,
        });
        expect(cronToSchedule('40 10 22 8 *')).toMatchObject({
            frequency: 'yearly',
            time: '10:40',
            monthDay: 22,
            month: 8,
        });
    });

    it('accepts a yearly February 29 schedule', () => {
        expect(cronToSchedule('40 10 29 2 *')).toMatchObject({
            frequency: 'yearly',
            monthDay: 29,
            month: 2,
        });
    });

    it('tolerates extra whitespace', () => {
        expect(cronToSchedule('  30   7  *  *  * ')).toMatchObject({ frequency: 'daily', time: '07:30' });
    });

    it.each([
        ['@daily'],
        ['0 9 * * 0-6'],
        ['0 9 * * 2,1'],
        ['0 9 * * 1,1'],
        ['0 9 * * */2'],
        ['0 9 * * 1-1'],
        ['*/15 * * * *'],
        ['15 * * * *'],
        ['0 9 * * 7'],
        ['0 9 * *'],
        ['0 9 * * * *'],
        ['0 9 0 * *'],
        ['0 9 1 13 *'],
        ['0 24 * * *'],
        ['60 9 * * *'],
        ['0 9 1 * 1'],
        [''],
        ['0 0-23 * * *'],
        ['0 18-9 * * *'],
        ['0 9-24 * * *'],
        ['30 9-18 * * *'],
        ['0 9-18 1 * *'],
        ['0 9-18 * 3 *'],
        ['0 9-18 * * 6,0'],
        ['0 9-18 * * 0-6'],
        ['40 10 30 2 *'],
        ['40 10 31 4 *'],
    ])('returns null for the unsupported expression %j', (cron) => {
        expect(cronToSchedule(cron)).toBeNull();
    });
});

describe('round trip', () => {
    it.each([
        '0 * * * *',
        '0 9-18 * * *',
        '0 9-18 * * 1-5',
        '0 9-18 * * 0,6',
        '0 9-18 * * 2-4',
        '0 9-18 * * 1,3,5',
        '0 * * * 1-5',
        '0 9-9 * * *',
        '30 7 * * *',
        '0 0 * * *',
        '40 10 * * *',
        '30 7 * * 1',
        '5 23 * * 0',
        '40 10 * * 6',
        '0 9 * * 1-5',
        '30 7 * * 1,2,4',
        '30 7 * * 0,6',
        '30 7 1 * *',
        '0 12 31 * *',
        '40 10 22 * *',
        '30 7 1 1 *',
        '45 18 9 12 *',
        '40 10 22 8 *',
        '40 10 29 2 *',
    ])('cron %j survives cron -> schedule -> cron', (cron) => {
        const parsed = cronToSchedule(cron);

        expect(parsed).not.toBeNull();
        expect(scheduleToCron(parsed as ScheduleValue)).toBe(cron);
    });

    it.each(['hourly', 'daily', 'weekly', 'monthly', 'yearly'] as const)(
        'schedule %j survives schedule -> cron -> schedule',
        (frequency) => {
            const value = schedule({
                frequency,
                time: '23:05',
                weekdays: [0, 6],
                monthDay: 28,
                month: 11,
                startHour: 8,
                endHour: 20,
            });
            const parsed = cronToSchedule(scheduleToCron(value));

            expect(parsed?.frequency).toBe(frequency);

            if (frequency === 'hourly') {
                expect(parsed?.weekdays).toEqual([0, 6]);
                expect(parsed?.startHour).toBe(8);
                expect(parsed?.endHour).toBe(20);

                return;
            }

            expect(parsed?.time).toBe('23:05');

            if (frequency === 'weekly') expect(parsed?.weekdays).toEqual([0, 6]);
            if (frequency === 'monthly' || frequency === 'yearly') expect(parsed?.monthDay).toBe(28);
            if (frequency === 'yearly') expect(parsed?.month).toBe(11);
        },
    );
});

describe('isValidTime', () => {
    it.each(['00:00', '09:00', '10:40', '23:59'])('accepts %j', (time) => {
        expect(isValidTime(time)).toBe(true);
    });

    it.each(['', '9:00', '24:00', '10:60', '10-40', 'abc'])('rejects %j', (time) => {
        expect(isValidTime(time)).toBe(false);
    });
});

describe('validateSchedule', () => {
    it('accepts the default shapes', () => {
        expect(validateSchedule(formValue())).toBeUndefined();
        expect(validateSchedule(formValue({ frequency: 'hourly' }))).toBeUndefined();
        expect(validateSchedule(formValue({ frequency: 'hourly', startHour: 9, endHour: 9 }))).toBeUndefined();
    });

    it('leaves a custom cron alone', () => {
        expect(validateSchedule(formValue({ frequency: 'custom', time: '' }))).toBeUndefined();
    });

    it('rejects an hourly window that starts after it ends', () => {
        expect(validateSchedule(formValue({ frequency: 'hourly', startHour: 18, endHour: 9 }))).toBe(
            'The window must start before it ends',
        );
    });

    it.each(['', '99:99', '9:00'])('rejects the time %j', (time) => {
        expect(validateSchedule(formValue({ time }))).toBe('Pick a time of day');
        expect(validateSchedule(formValue({ frequency: 'weekly', time }))).toBe('Pick a time of day');
        expect(validateSchedule(formValue({ frequency: 'monthly', time }))).toBe('Pick a time of day');
        expect(validateSchedule(formValue({ frequency: 'yearly', time }))).toBe('Pick a time of day');
    });

    it('ignores the time for hourly', () => {
        expect(validateSchedule(formValue({ frequency: 'hourly', time: '' }))).toBeUndefined();
    });

    it('rejects a yearly date that does not exist', () => {
        expect(validateSchedule(formValue({ frequency: 'yearly', month: 2, monthDay: 30 }))).toBe('Pick a valid date');
    });
});

describe('YEARLY_MONTH_DAY_OPTIONS', () => {
    it('offers February 29 but never February 30', () => {
        const values = YEARLY_MONTH_DAY_OPTIONS.map((option) => option.value);

        expect(values).toContain('2-29');
        expect(values).not.toContain('2-30');
        expect(values).not.toContain('2-31');
    });

    it('clamps every month to its real day count', () => {
        expect(YEARLY_MONTH_DAY_OPTIONS).toHaveLength(366);
        expect(YEARLY_MONTH_DAY_OPTIONS.map((option) => option.value)).not.toContain('4-31');
    });

    it('labels the reference date as Aug 22', () => {
        expect(YEARLY_MONTH_DAY_OPTIONS.find((option) => option.value === '8-22')?.label).toBe('Aug 22');
    });
});

describe('once', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 7, 22, 10, 0, 0));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('builds the reference once expression', () => {
        expect(
            scheduleToCron(
                schedule({
                    frequency: 'once',
                    monthDay: 22,
                    month: 8,
                    year: 2026,
                    time: '10:40',
                }),
            ),
        ).toBe('40 10 22 8 *');
    });

    it('emits the same cron as the matching yearly schedule', () => {
        const once = schedule({
            frequency: 'once',
            monthDay: 22,
            month: 8,
            year: 2027,
            time: '10:40',
        });
        const yearly = schedule({
            frequency: 'yearly',
            monthDay: 22,
            month: 8,
            time: '10:40',
        });

        expect(scheduleToCron(once)).toBe(scheduleToCron(yearly));
    });

    it('reads a run-once cron back as once', () => {
        expect(cronToSchedule('40 10 22 8 *', true)).toMatchObject({
            frequency: 'once',
            monthDay: 22,
            month: 8,
            time: '10:40',
            year: 2026,
        });
    });

    it('reads the same cron as yearly when the routine is not flagged run-once', () => {
        expect(cronToSchedule('40 10 22 8 *', false)).toMatchObject({ frequency: 'yearly', monthDay: 22, month: 8 });
        expect(cronToSchedule('40 10 22 8 *')).toMatchObject({ frequency: 'yearly' });
    });

    it('survives once -> cron -> once', () => {
        const value = schedule({
            frequency: 'once',
            monthDay: 9,
            month: 12,
            year: 2026,
            time: '18:45',
        });
        const cron = scheduleToCron(value);

        expect(cron).toBe('45 18 9 12 *');
        expect(cronToSchedule(cron, true)).toEqual(value);
    });

    it('refuses a run-once flag on a cron that is not a single date', () => {
        expect(cronToSchedule('30 7 * * *', true)).toBeNull();
        expect(cronToSchedule('30 7 * * 1', true)).toBeNull();
        expect(cronToSchedule('30 7 1 * *', true)).toBeNull();
        expect(cronToSchedule('0 9-18 * * *', true)).toBeNull();
    });

    it('re-picks next year when the stored month and day already passed', () => {
        expect(cronToSchedule('0 9 1 3 *', true)).toMatchObject({
            frequency: 'once',
            month: 3,
            monthDay: 1,
            year: 2027,
        });
        expect(cronToSchedule('0 9 21 8 *', true)).toMatchObject({ month: 8, monthDay: 21, year: 2027 });
    });

    it('keeps this year when the stored month and day are still ahead', () => {
        expect(cronToSchedule('0 9 31 12 *', true)).toMatchObject({
            frequency: 'once',
            month: 12,
            monthDay: 31,
            year: 2026,
        });
        expect(cronToSchedule('0 9 22 8 *', true)).toMatchObject({ month: 8, monthDay: 22, year: 2026 });
    });

    it('picks the next leap year for February 29', () => {
        expect(
            scheduleToCron(
                schedule({
                    frequency: 'once',
                    monthDay: 29,
                    month: 2,
                    year: 2028,
                    time: '10:40',
                }),
            ),
        ).toBe('40 10 29 2 *');
        expect(cronToSchedule('40 10 29 2 *', true)).toMatchObject({
            frequency: 'once',
            month: 2,
            monthDay: 29,
            year: 2028,
        });
    });

    it('validates the once date against the picked year', () => {
        expect(
            validateSchedule(
                formValue({
                    frequency: 'once',
                    month: 2,
                    monthDay: 29,
                    year: 2028,
                }),
            ),
        ).toBeUndefined();
        expect(
            validateSchedule(
                formValue({
                    frequency: 'once',
                    month: 2,
                    monthDay: 29,
                    year: 2027,
                }),
            ),
        ).toBe('Pick a valid date');
        expect(
            validateSchedule(
                formValue({
                    frequency: 'once',
                    month: 2,
                    monthDay: 30,
                    year: 2028,
                }),
            ),
        ).toBe('Pick a valid date');
        expect(validateSchedule(formValue({ frequency: 'once', time: '' }))).toBe('Pick a time of day');
    });
});

describe('describeSchedule', () => {
    it('labels a run-once routine as a single date', () => {
        expect(describeSchedule('40 10 22 8 *', true)).toBe('Once on Aug 22 at 10:40 AM');
    });

    it('leaves recurring routines to cronToStatement', () => {
        expect(describeSchedule('40 10 22 8 *', false)).toBe('Aug 22 at 10:40 AM');
        expect(describeSchedule('30 7 * * *')).toBe('Daily at 7:30 AM');
        expect(describeSchedule('30 7 * * *', true)).toBe('Daily at 7:30 AM');
    });

    it.each([
        ['0 9-18 * * *', 'Hourly, 9:00 AM \u2013 6:00 PM'],
        ['0 9-18 * * 1-5', 'Hourly on weekdays, 9:00 AM \u2013 6:00 PM'],
        ['0 9-18 * * 0,6', 'Hourly on weekends, 9:00 AM \u2013 6:00 PM'],
        ['0 9-18 * * 1,2,4', 'Hourly on Mon, Tue, Thu, 9:00 AM \u2013 6:00 PM'],
        ['0 9-9 * * *', 'Hourly, 9:00 AM \u2013 9:00 AM'],
        ['0 * * * *', 'Hourly'],
        ['0 * * * 1-5', 'Hourly on weekdays'],
    ])('describes the hourly cron %j', (cron, expected) => {
        expect(describeSchedule(cron)).toBe(expected);
    });

    it('describes the remaining frequencies', () => {
        expect(describeSchedule('30 7 * * *')).toBe('Daily at 7:30 AM');
        expect(describeSchedule('30 7 * * 1')).toBe('Mon at 7:30 AM');
        expect(describeSchedule('30 7 * * 1-5')).toBe('Weekdays at 7:30 AM');
        expect(describeSchedule('30 7 * * 0,6')).toBe('Weekends at 7:30 AM');
        expect(describeSchedule('30 7 * * 1,2,4')).toBe('Mon, Tue, Thu at 7:30 AM');
        expect(describeSchedule('0 12 15 * *')).toBe('Monthly on the 15th at 12:00 PM');
        expect(describeSchedule('45 18 9 12 *')).toBe('Dec 9 at 6:45 PM');
        expect(describeSchedule('45 18 9 12 *', true)).toBe('Once on Dec 9 at 6:45 PM');
    });

    it('falls back to the shared statement for an unparseable cron', () => {
        expect(describeSchedule('@daily')).toBe('@daily');
        expect(describeSchedule('@daily', true)).toBe('@daily');
        expect(describeSchedule('')).toBe('');
        expect(describeSchedule(null)).toBe('');
        expect(describeSchedule(null, false)).toBe('');
    });
});

describe('runAt', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 7, 22, 10, 0, 0));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('formats a local wall-clock string with no zone suffix', () => {
        const runAt = scheduleToRunAt(
            schedule({
                frequency: 'once',
                year: 2027,
                month: 12,
                monthDay: 25,
                time: '09:00',
            }),
        );

        expect(runAt).toBe('2027-12-25T09:00:00');
        expect(runAt).not.toContain('Z');
        expect(runAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    });

    it('zero-pads the month, day, hour and minute', () => {
        const runAt = scheduleToRunAt(
            schedule({
                year: 2027,
                month: 1,
                monthDay: 5,
                time: '07:05',
            }),
        );

        expect(runAt).toBe('2027-01-05T07:05:00');
    });

    it('falls back to 09:00 for a malformed time', () => {
        const runAt = scheduleToRunAt(
            schedule({
                year: 2027,
                month: 3,
                monthDay: 4,
                time: '',
            }),
        );

        expect(runAt).toBe('2027-03-04T09:00:00');
    });

    it('parses a wall-clock run-at string', () => {
        expect(parseRunAt('2027-12-25T09:00:00')).toEqual({
            year: 2027,
            month: 12,
            monthDay: 25,
            time: '09:00',
        });
        expect(parseRunAt('2027-12-25T09:00')).toEqual({
            year: 2027,
            month: 12,
            monthDay: 25,
            time: '09:00',
        });
    });

    it.each([
        '2027-12-25T09:00:00Z',
        '2027-12-25T09:00:00+05:30',
        '2027-13-25T09:00:00',
        '2027-02-30T09:00:00',
        '2027-02-29T09:00:00',
        '2027-12-25 09:00:00',
        '2027-12-25',
        '',
    ])('rejects the run-at string %j', (runAt) => {
        expect(parseRunAt(runAt)).toBeNull();
    });

    it('hydrates a one-shot on the stored year, not the next occurrence', () => {
        expect(cronToSchedule('0 9 25 12 *', true, '2027-12-25T09:00:00')).toMatchObject({
            frequency: 'once',
            year: 2027,
            month: 12,
            monthDay: 25,
            time: '09:00',
        });
    });

    it('hydrates the edit form on the year the api sent, not the next occurrence', () => {
        const runAt = routineSchema.shape.runAt.parse('2028-12-25T09:00:00.000Z');

        expect(cronToSchedule('0 9 25 12 *', true, runAt)).toMatchObject({
            frequency: 'once',
            year: 2028,
            month: 12,
            monthDay: 25,
            time: '09:00',
        });
    });

    it('round-trips the api shape back out as the same wall clock', () => {
        const runAt = routineSchema.shape.runAt.parse('2028-12-25T09:00:00.000Z');
        const hydrated = cronToSchedule('0 9 25 12 *', true, runAt);

        expect(hydrated).not.toBeNull();
        expect(scheduleToRunAt(hydrated as ScheduleValue)).toBe('2028-12-25T09:00:00');
    });

    it('hydrates from run-at even when the cron cannot be parsed', () => {
        expect(cronToSchedule('@yearly', true, '2027-12-25T09:00:00')).toMatchObject({
            frequency: 'once',
            year: 2027,
            month: 12,
            monthDay: 25,
        });
    });

    it('ignores run-at when the routine is not flagged run-once', () => {
        expect(cronToSchedule('0 9 25 12 *', false, '2027-12-25T09:00:00')).toMatchObject({
            frequency: 'yearly',
            month: 12,
            monthDay: 25,
        });
    });

    it('falls back to the next occurrence for a legacy one-shot with no run-at', () => {
        expect(cronToSchedule('0 9 25 12 *', true)).toMatchObject({
            frequency: 'once',
            year: 2026,
            month: 12,
            monthDay: 25,
        });
        expect(cronToSchedule('0 9 25 12 *', true, null)).toMatchObject({ year: 2026 });
        expect(cronToSchedule('0 9 21 8 *', true)).toMatchObject({
            frequency: 'once',
            year: 2027,
            month: 8,
            monthDay: 21,
        });
    });

    it('falls back to the next occurrence when run-at is unusable', () => {
        expect(cronToSchedule('0 9 25 12 *', true, 'not-a-date')).toMatchObject({
            frequency: 'once',
            year: 2026,
            month: 12,
            monthDay: 25,
        });
    });

    it('survives once -> run-at -> once', () => {
        const value = schedule({
            frequency: 'once',
            year: 2027,
            month: 12,
            monthDay: 25,
            time: '09:00',
        });

        expect(cronToSchedule(scheduleToCron(value), true, scheduleToRunAt(value))).toEqual(value);
    });
});

describe('validateSchedule once cut-off', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 7, 22, 20, 0, 0));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const pastMessage = 'Pick a date and time in the future, compared with this device clock';

    it('rejects today at a time that already passed', () => {
        expect(
            validateSchedule(
                formValue({
                    frequency: 'once',
                    year: 2026,
                    month: 8,
                    monthDay: 22,
                    time: '09:00',
                }),
            ),
        ).toBe(pastMessage);
    });

    it('rejects the current minute', () => {
        expect(
            validateSchedule(
                formValue({
                    frequency: 'once',
                    year: 2026,
                    month: 8,
                    monthDay: 22,
                    time: '20:00',
                }),
            ),
        ).toBe(pastMessage);
    });

    it('rejects a date in the past', () => {
        expect(
            validateSchedule(
                formValue({
                    frequency: 'once',
                    year: 2026,
                    month: 8,
                    monthDay: 21,
                    time: '23:59',
                }),
            ),
        ).toBe(pastMessage);
        expect(
            validateSchedule(
                formValue({
                    frequency: 'once',
                    year: 2025,
                    month: 12,
                    monthDay: 31,
                    time: '23:59',
                }),
            ),
        ).toBe(pastMessage);
    });

    it('accepts today at a time still ahead', () => {
        expect(
            validateSchedule(
                formValue({
                    frequency: 'once',
                    year: 2026,
                    month: 8,
                    monthDay: 22,
                    time: '20:01',
                }),
            ),
        ).toBeUndefined();
    });

    it('accepts a future date', () => {
        expect(
            validateSchedule(
                formValue({
                    frequency: 'once',
                    year: 2027,
                    month: 12,
                    monthDay: 25,
                    time: '09:00',
                }),
            ),
        ).toBeUndefined();
    });

    it('honours an injected clock', () => {
        const value = formValue({
            frequency: 'once',
            year: 2026,
            month: 8,
            monthDay: 22,
            time: '09:00',
        });

        expect(validateSchedule(value, new Date(2026, 7, 22, 8, 0, 0))).toBeUndefined();
    });

    it('reports the invalid date before the past cut-off', () => {
        expect(
            validateSchedule(
                formValue({
                    frequency: 'once',
                    year: 2025,
                    month: 2,
                    monthDay: 30,
                    time: '09:00',
                }),
            ),
        ).toBe('Pick a valid date');
    });

    it('leaves recurring frequencies untouched by the cut-off', () => {
        expect(validateSchedule(formValue({ frequency: 'daily', time: '09:00' }))).toBeUndefined();
        expect(
            validateSchedule(
                formValue({
                    frequency: 'yearly',
                    month: 1,
                    monthDay: 1,
                    time: '09:00',
                }),
            ),
        ).toBeUndefined();
    });
});

describe('validateSchedule DST spring-forward gap', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-08-22T12:00:00.000Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const gapMessage = (timezone: string): string =>
        `That date and time does not exist in ${timezone}` +
        ' — the clocks jump forward for daylight saving. Pick another time.';

    const once = (overrides: Partial<ScheduleFormValue> = {}): ScheduleFormValue =>
        formValue({
            frequency: 'once',
            year: 2027,
            month: 3,
            monthDay: 14,
            time: '02:30',
            ...overrides,
        });

    it('rejects a New York wall clock inside the spring-forward gap', () => {
        expect(validateSchedule(once(), new Date(), 'America/New_York')).toBe(gapMessage('America/New_York'));
    });

    it('accepts the hours either side of the New York gap', () => {
        expect(validateSchedule(once({ time: '01:30' }), new Date(), 'America/New_York')).toBeUndefined();
        expect(validateSchedule(once({ time: '03:30' }), new Date(), 'America/New_York')).toBeUndefined();
    });

    it('leaves the ambiguous fall-back hour alone', () => {
        expect(
            validateSchedule(once({ month: 11, monthDay: 7, time: '01:30' }), new Date(), 'America/New_York'),
        ).toBeUndefined();
    });

    it('rejects the London spring-forward gap', () => {
        expect(validateSchedule(once({ monthDay: 28, time: '01:30' }), new Date(), 'Europe/London')).toBe(
            gapMessage('Europe/London'),
        );
        expect(validateSchedule(once({ monthDay: 28, time: '00:30' }), new Date(), 'Europe/London')).toBeUndefined();
    });

    it('rejects the Sydney spring-forward gap', () => {
        expect(validateSchedule(once({ month: 10, monthDay: 3, time: '02:30' }), new Date(), 'Australia/Sydney')).toBe(
            gapMessage('Australia/Sydney'),
        );
        expect(
            validateSchedule(once({ month: 10, monthDay: 3, time: '01:30' }), new Date(), 'Australia/Sydney'),
        ).toBeUndefined();
    });

    it('ignores the gap for a recurring frequency', () => {
        expect(
            validateSchedule(
                formValue({
                    frequency: 'yearly',
                    month: 3,
                    monthDay: 14,
                    time: '02:30',
                }),
                new Date(),
                'America/New_York',
            ),
        ).toBeUndefined();
    });

    it('reports the invalid date before the gap', () => {
        expect(validateSchedule(once({ month: 2, monthDay: 30 }), new Date(), 'America/New_York')).toBe(
            'Pick a valid date',
        );
    });

    it('skips the gap check without a timezone', () => {
        expect(validateSchedule(once())).toBeUndefined();
    });
});

describe('validateSchedule with a stored run-at', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-08-22T12:00:00.000Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const spent = (overrides: Partial<ScheduleFormValue> = {}): ScheduleFormValue =>
        formValue({
            frequency: 'once',
            year: 2026,
            month: 8,
            monthDay: 1,
            time: '09:00',
            ...overrides,
        });

    it('accepts a spent one-shot whose date and time are unchanged', () => {
        expect(validateSchedule(spent(), new Date(), 'UTC', '2026-08-01T09:00:00')).toBeUndefined();
    });

    it('accepts an unchanged value that carries no seconds', () => {
        expect(validateSchedule(spent(), new Date(), 'UTC', '2026-08-01T09:00')).toBeUndefined();
    });

    it('still rejects a changed past date', () => {
        expect(validateSchedule(spent({ monthDay: 2 }), new Date(), 'UTC', '2026-08-01T09:00:00')).toBe(
            'Pick a date and time in the future (GMT+0)',
        );
        expect(validateSchedule(spent({ time: '10:00' }), new Date(), 'UTC', '2026-08-01T09:00:00')).toBe(
            'Pick a date and time in the future (GMT+0)',
        );
    });

    it('rejects a past date when nothing was stored', () => {
        expect(validateSchedule(spent(), new Date(), 'UTC')).toBe('Pick a date and time in the future (GMT+0)');
        expect(validateSchedule(spent(), new Date(), 'UTC', null)).toBe('Pick a date and time in the future (GMT+0)');
    });

    it('ignores an unparseable stored value', () => {
        expect(validateSchedule(spent(), new Date(), 'UTC', 'not-a-date')).toBe(
            'Pick a date and time in the future (GMT+0)',
        );
    });

    it('still reports an invalid date for an unchanged stored value', () => {
        expect(validateSchedule(spent({ month: 2, monthDay: 30 }), new Date(), 'UTC', '2026-02-30T09:00:00')).toBe(
            'Pick a valid date',
        );
    });
});

describe('month-day seed', () => {
    it('clamps a monthly seed to a day every month has', () => {
        expect(clampMonthDaySeed(31)).toBe(28);
        expect(clampMonthDaySeed(29)).toBe(28);
        expect(clampMonthDaySeed(28)).toBe(28);
        expect(clampMonthDaySeed(1)).toBe(1);
        expect(clampMonthDaySeed(0)).toBe(1);
    });

    it('keeps today as the once default', () => {
        const defaults = createDefaultSchedule(new Date(2026, 0, 31, 23, 59, 0));

        expect(defaults.monthDay).toBe(31);
        expect(defaults.month).toBe(1);
        expect(defaults.year).toBe(2026);
    });

    it('never produces a monthly cron that skips short months', () => {
        const value = schedule({ frequency: 'monthly', monthDay: clampMonthDaySeed(31), time: '09:00' });

        expect(scheduleToCron(value)).toBe('0 9 28 * *');
    });
});

describe('describeSchedule one-shot label', () => {
    it('shows the stored year for a one-shot', () => {
        expect(describeSchedule('0 9 25 12 *', true, '2028-12-25T09:00:00')).toBe('Once on Dec 25, 2028 at 9:00 AM');
    });

    it('separates two one-shots that share a dead cron', () => {
        const cron = '0 9 25 12 *';

        expect(describeSchedule(cron, true, '2026-12-25T09:00:00')).toBe('Once on Dec 25, 2026 at 9:00 AM');
        expect(describeSchedule(cron, true, '2028-12-25T09:00:00')).toBe('Once on Dec 25, 2028 at 9:00 AM');
    });

    it('reads the year off the normalised server shape', () => {
        const parsed = routineSchema.parse({
            _id: 'routine-1',
            agentId: 'agent-1',
            name: 'Christmas brief',
            prompt: 'Research',
            cron: '0 9 25 12 *',
            timezone: 'UTC',
            runOnce: true,
            runAt: '2028-12-25T09:00:00.000Z',
            status: 'active',
            lastRunAt: null,
            createdAt: '2026-08-01T09:00:00.000Z',
            updatedAt: '2026-08-01T09:00:00.000Z',
        });

        expect(describeSchedule(parsed.cron, parsed.runOnce, parsed.runAt)).toBe('Once on Dec 25, 2028 at 9:00 AM');
    });

    it('renders the minutes and the 12-hour boundaries', () => {
        expect(describeSchedule('40 10 22 8 *', true, '2028-08-22T10:40:00')).toBe('Once on Aug 22, 2028 at 10:40 AM');
        expect(describeSchedule('5 0 1 1 *', true, '2028-01-01T00:05:00')).toBe('Once on Jan 1, 2028 at 12:05 AM');
        expect(describeSchedule('0 12 1 1 *', true, '2028-01-01T12:00:00')).toBe('Once on Jan 1, 2028 at 12:00 PM');
    });

    it('falls back to the cron statement when run-at is unusable', () => {
        expect(describeSchedule('45 18 9 12 *', true, 'not-a-date')).toBe('Once on Dec 9 at 6:45 PM');
        expect(describeSchedule('45 18 9 12 *', true, null)).toBe('Once on Dec 9 at 6:45 PM');
    });

    it('ignores run-at for a recurring routine', () => {
        expect(describeSchedule('0 9 * * 1', false, '2028-12-25T09:00:00')).toBe('Mon at 9:00 AM');
    });
});

describe('describeSchedule day-of-week 7', () => {
    it('describes the cron day-of-week 7 as Sunday', () => {
        expect(describeSchedule('0 9 * * 7')).toBe('Sun at 9:00 AM');
        expect(describeSchedule('0 9 * * 7')).not.toContain('undefined');
    });

    it('collapses a list that names Sunday twice', () => {
        expect(describeSchedule('0 9 * * 0,7')).toBe('Sun at 9:00 AM');
    });

    it('maps 7 inside a list', () => {
        expect(describeSchedule('0 9 * * 7,3')).toBe('Sun, Wed at 9:00 AM');
        expect(describeSchedule('30 8 * * 1,7')).toBe('Mon, Sun at 8:30 AM');
    });

    it('leaves an unrelated field containing the digit 7 alone', () => {
        expect(describeSchedule('0 9 17 7 *')).toBe('Jul 17 at 9:00 AM');
        expect(describeSchedule('0 9 * * 1-5')).toBe('Weekdays at 9:00 AM');
    });
});

describe('validateSchedule against the routine timezone', () => {
    const nyEveningTokyoMorning = new Date('2026-08-22T00:00:00.000Z');

    const once = (overrides: Partial<ScheduleFormValue> = {}): ScheduleFormValue =>
        formValue({
            frequency: 'once',
            year: 2026,
            month: 8,
            monthDay: 22,
            time: '10:00',
            ...overrides,
        });

    it('rejects a time already past in the routine timezone', () => {
        expect(validateSchedule(once({ time: '08:00' }), nyEveningTokyoMorning, 'Asia/Tokyo')).toBe(
            'Pick a date and time in the future (GMT+9)',
        );
    });

    it('names the timezone so the message is intelligible', () => {
        expect(validateSchedule(once({ time: '09:00' }), nyEveningTokyoMorning, 'Asia/Tokyo')).toContain('GMT+9');
    });

    it('accepts a time still ahead in the routine timezone', () => {
        expect(validateSchedule(once({ time: '09:01' }), nyEveningTokyoMorning, 'Asia/Tokyo')).toBeUndefined();
    });

    it('accepts a time the device clock would have blocked', () => {
        expect(
            validateSchedule(once({ monthDay: 21, time: '23:00' }), nyEveningTokyoMorning, 'America/New_York'),
        ).toBeUndefined();
    });

    it('rejects a time the device clock would have allowed', () => {
        expect(validateSchedule(once({ monthDay: 21, time: '19:00' }), nyEveningTokyoMorning, 'America/New_York')).toBe(
            'Pick a date and time in the future (GMT-4)',
        );
    });

    it('reports an invalid date before the timezone cut-off', () => {
        expect(validateSchedule(once({ month: 2, monthDay: 30 }), nyEveningTokyoMorning, 'Asia/Tokyo')).toBe(
            'Pick a valid date',
        );
    });

    it('falls back to the device clock for an unusable timezone', () => {
        expect(validateSchedule(once({ year: 2020, month: 1, monthDay: 1 }), nyEveningTokyoMorning, 'Not/AZone')).toBe(
            'Pick a date and time in the future, compared with this device clock',
        );
    });

    it('leaves recurring frequencies untouched by the timezone', () => {
        expect(
            validateSchedule(formValue({ frequency: 'daily' }), nyEveningTokyoMorning, 'Asia/Tokyo'),
        ).toBeUndefined();
    });
});

describe('onceScheduleSeed', () => {
    it('seeds the next 5-minute mark at least 2 minutes ahead of the device clock without a timezone', () => {
        expect(onceScheduleSeed(new Date(2026, 7, 22, 15, 42, 30))).toEqual({
            year: 2026,
            month: 8,
            monthDay: 22,
            time: '15:45',
        });
    });

    it('skips a boundary closer than the 2-minute margin', () => {
        expect(onceScheduleSeed(new Date(2026, 7, 22, 15, 44, 0))).toEqual({
            year: 2026,
            month: 8,
            monthDay: 22,
            time: '15:50',
        });
    });

    it('steps a full 5 minutes when now sits exactly on a boundary', () => {
        expect(onceScheduleSeed(new Date(2026, 7, 22, 15, 45, 0))).toEqual({
            year: 2026,
            month: 8,
            monthDay: 22,
            time: '15:50',
        });
    });

    it('seeds ahead in the trigger timezone', () => {
        expect(onceScheduleSeed(new Date('2026-08-22T23:30:00Z'), 'Asia/Tokyo')).toEqual({
            year: 2026,
            month: 8,
            monthDay: 23,
            time: '08:35',
        });
    });

    it('rolls into the next day just before midnight in the zone', () => {
        expect(onceScheduleSeed(new Date('2026-08-22T23:59:10Z'), 'UTC')).toEqual({
            year: 2026,
            month: 8,
            monthDay: 23,
            time: '00:05',
        });
    });

    it('never starts already in the past', () => {
        const now = new Date();
        const seeded = formValue({ frequency: 'once', ...onceScheduleSeed(now, 'Asia/Calcutta') });

        expect(validateSchedule(seeded, now, 'Asia/Calcutta')).toBeUndefined();
    });
});
