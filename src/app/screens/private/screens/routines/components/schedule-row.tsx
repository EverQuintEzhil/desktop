import { format, startOfDay } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import Select from '@/components/ui/select';

import type { FrequencyOption } from '../constants';
import {
    clampMonthDaySeed,
    CUSTOM_FREQUENCY_OPTION,
    FREQUENCY_OPTIONS,
    MONTH_DAY_OPTIONS,
    ONCE_DATE_FORMAT,
    weekdaysSeed,
    YEARLY_MONTH_DAY_OPTIONS,
} from '../constants';
import type { ScheduleFormFrequency, ScheduleFormValue } from '../types';
import { isValidTime, onceScheduleSeed } from '../utils/cron-schedule';
import { decodeMonthDay, encodeMonthDay } from '../utils/month-day';

import HourWindowChip from './hour-window-chip';
import TimeChip from './time-chip';
import { CHIP_CLASS, CHIP_JOINER_CLASS } from './trigger-chip';
import WeekdayChip from './weekday-chip';

export interface ScheduleRowProps {
    value: ScheduleFormValue;
    onChange: (value: ScheduleFormValue) => void;
    customCron?: string;
    isErrored?: boolean;
    /** The trigger's IANA zone; seeds a fresh "Once" pick with that zone's current time. */
    timezone?: string;
}

export const scheduleNote = (value: ScheduleFormValue): string | null => {
    if (value.frequency === 'custom') {
        return 'This schedule was set outside this form and is kept as-is. Pick a frequency to replace it.';
    }

    if (value.frequency === 'once') return 'Runs a single time, then stops.';

    return null;
};

const ScheduleRow = ({ value, onChange, customCron, isErrored, timezone }: ScheduleRowProps) => {
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const patch = (next: Partial<ScheduleFormValue>) => onChange({ ...value, ...next });

    const frequencyOptions: FrequencyOption[] = customCron
        ? [...FREQUENCY_OPTIONS, CUSTOM_FREQUENCY_OPTION]
        : FREQUENCY_OPTIONS;

    const isWindowInvalid = value.startHour > value.endHour;
    const isTimeInvalid = !isValidTime(value.time);
    const onceDate = new Date(value.year, value.month - 1, value.monthDay);

    const handleFrequencyChange = (next: ScheduleFormFrequency | null) => {
        const frequency = next ?? 'daily';

        // Once reseeds to the zone's next minute; the shared 9:00 default would be in the past every afternoon.
        if (frequency === 'once') {
            patch({ frequency, ...onceScheduleSeed(new Date(), timezone) });

            return;
        }

        if (frequency === 'monthly' || frequency === 'yearly') {
            patch({ frequency, monthDay: clampMonthDaySeed(value.monthDay) });

            return;
        }

        // Hourly and weekly read the day set differently (all days vs one), so switching reseeds it.
        if (frequency === 'hourly' || frequency === 'weekly') {
            patch({ frequency, weekdays: weekdaysSeed(frequency) });

            return;
        }

        patch({ frequency });
    };

    const handleOnceDateSelect = (day: Date | undefined) => {
        if (!day) return;

        patch({ year: day.getFullYear(), month: day.getMonth() + 1, monthDay: day.getDate() });
        setIsDatePickerOpen(false);
    };

    const renderTime = () => (
        <>
            <span className={CHIP_JOINER_CLASS}>at</span>
            <TimeChip value={value.time} isErrored={isTimeInvalid} onChange={(time) => patch({ time })} />
        </>
    );

    const renderOnceDate = () => (
        <>
            <span className={CHIP_JOINER_CLASS}>on</span>
            <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen} modal>
                <PopoverTrigger asChild>
                    <Button
                        type="button"
                        variant="ghost"
                        className="h-7 w-auto gap-1.5 rounded-lg bg-muted px-2 text-sm font-normal text-(--text-primary) hover:bg-border"
                        aria-label="Run date"
                    >
                        <CalendarIcon aria-hidden="true" className="size-3.5 text-(--text-secondary)" />
                        {format(onceDate, ONCE_DATE_FORMAT)}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                        mode="single"
                        selected={onceDate}
                        defaultMonth={onceDate}
                        disabled={(date) => startOfDay(date) < startOfDay(new Date())}
                        onSelect={handleOnceDateSelect}
                    />
                </PopoverContent>
            </Popover>
        </>
    );

    const renderHourly = () => (
        <>
            <span className={CHIP_JOINER_CLASS}>on</span>
            <WeekdayChip weekdays={value.weekdays} onChange={(weekdays) => patch({ weekdays })} />
            <HourWindowChip
                startHour={value.startHour}
                endHour={value.endHour}
                isErrored={isWindowInvalid}
                onChange={(window) => patch(window)}
            />
        </>
    );

    const renderWeekday = () => (
        <>
            <span className={CHIP_JOINER_CLASS}>on</span>
            <WeekdayChip weekdays={value.weekdays} onChange={(weekdays) => patch({ weekdays })} />
        </>
    );

    const renderMonthDay = () => (
        <>
            <span className={CHIP_JOINER_CLASS}>on</span>
            <Select<string>
                options={MONTH_DAY_OPTIONS}
                value={String(value.monthDay)}
                onChange={(next) => patch({ monthDay: Number(next ?? 1) })}
                variant="ghost"
                className={CHIP_CLASS}
                modal
            />
        </>
    );

    const renderYearlyMonthDay = () => (
        <>
            <span className={CHIP_JOINER_CLASS}>on</span>
            <Select<string>
                options={YEARLY_MONTH_DAY_OPTIONS}
                value={encodeMonthDay(value.month, value.monthDay)}
                onChange={(next) => {
                    const decoded = next ? decodeMonthDay(next) : null;

                    if (decoded) patch(decoded);
                }}
                variant="ghost"
                className={CHIP_CLASS}
                allowSearch
                searchPlaceholder="Aug 22"
                modal
            />
        </>
    );

    const renderCustom = () => (
        <code className="rounded-lg bg-muted px-2 py-1 font-mono text-xs text-(--text-secondary)">{customCron}</code>
    );

    const renderFrequencyControls = () => {
        switch (value.frequency) {
            case 'custom':
                return renderCustom();
            case 'once':
                return (
                    <>
                        {renderOnceDate()}
                        {renderTime()}
                    </>
                );
            case 'hourly':
                return renderHourly();
            case 'daily':
                return renderTime();
            case 'weekly':
                return (
                    <>
                        {renderWeekday()}
                        {renderTime()}
                    </>
                );
            case 'monthly':
                return (
                    <>
                        {renderMonthDay()}
                        {renderTime()}
                    </>
                );
            case 'yearly':
                return (
                    <>
                        {renderYearlyMonthDay()}
                        {renderTime()}
                    </>
                );
        }
    };

    return (
        <>
            <Select<ScheduleFormFrequency>
                options={frequencyOptions}
                value={value.frequency}
                onChange={handleFrequencyChange}
                ariaLabel="Frequency"
                variant="ghost"
                className={CHIP_CLASS}
                isErrored={isErrored}
                modal
            />
            {renderFrequencyControls()}
        </>
    );
};

export default ScheduleRow;
