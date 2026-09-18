export type ScheduleFrequency = 'once' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface ScheduleValue {
    frequency: ScheduleFrequency;
    time: string;
    /** Cron day-of-week numbers, Sunday = 0, sorted ascending. */
    weekdays: number[];
    monthDay: number;
    month: number;
    year: number;
    startHour: number;
    endHour: number;
}

export type ScheduleFormFrequency = ScheduleFrequency | 'custom';

export interface ScheduleFormValue extends Omit<ScheduleValue, 'frequency'> {
    frequency: ScheduleFormFrequency;
}
