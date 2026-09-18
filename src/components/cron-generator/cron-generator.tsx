import { useEffect, useMemo, useState } from 'react';

import { cn } from '@/lib/utils';
import { cronToStatement } from '@/utils';

import './cron-generator.scss';

export interface CronGeneratorProps {
    value: string;
    onChange: (value: string) => void;
}

type Frequency = 'minutely' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';

const FREQUENCIES: { key: Frequency; label: string }[] = [
    { key: 'minutely', label: 'Every minute' },
    { key: 'hourly', label: 'Hourly' },
    { key: 'daily', label: 'Daily' },
    { key: 'weekly', label: 'Weekly' },
    { key: 'monthly', label: 'Monthly' },
    { key: 'custom', label: 'Custom' },
];

const DAYS_OF_WEEK = [
    { value: 0, short: 'Sun' },
    { value: 1, short: 'Mon' },
    { value: 2, short: 'Tue' },
    { value: 3, short: 'Wed' },
    { value: 4, short: 'Thu' },
    { value: 5, short: 'Fri' },
    { value: 6, short: 'Sat' },
];

function pad(n: number): string {
    return String(n).padStart(2, '0');
}

function buildHourOptions(): { value: number; label: string }[] {
    return Array.from({ length: 24 }, (_, i) => ({ value: i, label: pad(i) }));
}

function buildMinuteOptions(): { value: number; label: string }[] {
    return Array.from({ length: 60 }, (_, i) => ({ value: i, label: pad(i) }));
}

function buildDayOptions(): { value: number; label: string }[] {
    return Array.from({ length: 31 }, (_, i) => ({ value: i + 1, label: String(i + 1) }));
}

function parseCron(cron: string): {
    frequency: Frequency;
    minute: number;
    hour: number;
    dayOfMonth: number;
    daysOfWeek: number[];
} {
    const parts = cron.trim().split(/\s+/);

    if (parts.length !== 5) {
        return {
            frequency: 'custom',
            minute: 0,
            hour: 0,
            dayOfMonth: 1,
            daysOfWeek: [1],
        };
    }

    const [min, hr, dom, , dow] = parts;

    if (min === '*' && hr === '*' && dom === '*')
        return {
            frequency: 'minutely',
            minute: 0,
            hour: 0,
            dayOfMonth: 1,
            daysOfWeek: [1],
        };

    const minuteVal = parseInt(min, 10) || 0;
    const hourVal = parseInt(hr, 10) || 0;

    if (hr === '*' && dom === '*' && dow === '*') {
        return {
            frequency: 'hourly',
            minute: minuteVal,
            hour: 0,
            dayOfMonth: 1,
            daysOfWeek: [1],
        };
    }

    if (dom === '*' && dow === '*') {
        return {
            frequency: 'daily',
            minute: minuteVal,
            hour: hourVal,
            dayOfMonth: 1,
            daysOfWeek: [1],
        };
    }

    if (dom === '*' && dow !== '*') {
        const days = dow
            .split(',')
            .map((d) => parseInt(d, 10))
            .filter((d) => !isNaN(d));

        return {
            frequency: 'weekly',
            minute: minuteVal,
            hour: hourVal,
            dayOfMonth: 1,
            daysOfWeek: days.length ? days : [1],
        };
    }

    if (dom !== '*' && dow === '*') {
        return {
            frequency: 'monthly',
            minute: minuteVal,
            hour: hourVal,
            dayOfMonth: parseInt(dom, 10) || 1,
            daysOfWeek: [1],
        };
    }

    return {
        frequency: 'custom',
        minute: minuteVal,
        hour: hourVal,
        dayOfMonth: 1,
        daysOfWeek: [1],
    };
}

const HOUR_OPTIONS = buildHourOptions();
const MINUTE_OPTIONS = buildMinuteOptions();
const DAY_OPTIONS = buildDayOptions();

const CronGenerator = ({ value, onChange }: CronGeneratorProps) => {
    const parsed = useMemo(() => parseCron(value || '0 * * * *'), []);

    const [frequency, setFrequency] = useState<Frequency>(parsed.frequency);
    const [hour, setHour] = useState(parsed.hour);
    const [minute, setMinute] = useState(parsed.minute);
    const [dayOfMonth, setDayOfMonth] = useState(parsed.dayOfMonth);
    const [daysOfWeek, setDaysOfWeek] = useState<number[]>(parsed.daysOfWeek);
    const [customCron, setCustomCron] = useState(value || '');

    const generated = useMemo(() => {
        switch (frequency) {
            case 'minutely':
                return '* * * * *';
            case 'hourly':
                return `${minute} * * * *`;
            case 'daily':
                return `${minute} ${hour} * * *`;
            case 'weekly': {
                const dow = daysOfWeek.length ? daysOfWeek.sort((a, b) => a - b).join(',') : '*';

                return `${minute} ${hour} * * ${dow}`;
            }
            case 'monthly':
                return `${minute} ${hour} ${dayOfMonth} * *`;
            case 'custom':
                return customCron;
            default:
                return '';
        }
    }, [frequency, hour, minute, dayOfMonth, daysOfWeek, customCron]);

    useEffect(() => {
        if (generated !== value) {
            onChange(generated);
        }
    }, [generated]);

    const toggleDayOfWeek = (day: number) => {
        setDaysOfWeek((prev) => {
            if (prev.includes(day)) {
                const next = prev.filter((d) => d !== day);

                return next.length ? next : prev;
            }

            return [...prev, day];
        });
    };

    const handleFrequencyChange = (f: Frequency) => {
        setFrequency(f);
        if (f === 'custom') setCustomCron(generated);
    };

    const renderTimePicker = (showHour = true) => (
        <div className="cron-time-picker flex items-center gap-1">
            {showHour && (
                <>
                    <select
                        className="cron-select"
                        value={hour}
                        onChange={(e) => setHour(Number(e.target.value))}
                        aria-label="Hour"
                    >
                        {HOUR_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                    <span className="cron-time-colon">:</span>
                </>
            )}
            <select
                className="cron-select"
                value={minute}
                onChange={(e) => setMinute(Number(e.target.value))}
                aria-label="Minute"
            >
                {MINUTE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
        </div>
    );

    const renderOptions = () => {
        switch (frequency) {
            case 'minutely':
                return <p className="text-sm text-muted-foreground">Runs every minute.</p>;
            case 'hourly':
                return (
                    <div className="cron-option-row flex items-center gap-2">
                        <span className="cron-option-label">At minute</span>
                        {renderTimePicker(false)}
                    </div>
                );
            case 'daily':
                return (
                    <div className="cron-option-row flex items-center gap-2">
                        <span className="cron-option-label">At</span>
                        {renderTimePicker()}
                    </div>
                );
            case 'weekly':
                return (
                    <div className="flex flex-col gap-3">
                        <div className="cron-option-row flex items-center gap-2">
                            <span className="cron-option-label">On</span>
                            <div className="flex items-center gap-1">
                                {DAYS_OF_WEEK.map((d) => (
                                    <button
                                        key={d.value}
                                        type="button"
                                        className={cn('cron-day-btn', daysOfWeek.includes(d.value) && 'active')}
                                        onClick={() => toggleDayOfWeek(d.value)}
                                    >
                                        {d.short}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="cron-option-row flex items-center gap-2">
                            <span className="cron-option-label">At</span>
                            {renderTimePicker()}
                        </div>
                    </div>
                );
            case 'monthly':
                return (
                    <div className="flex flex-col gap-3">
                        <div className="cron-option-row flex items-center gap-2">
                            <span className="cron-option-label">On day</span>
                            <select
                                className="cron-select"
                                value={dayOfMonth}
                                onChange={(e) => setDayOfMonth(Number(e.target.value))}
                                aria-label="Day of month"
                            >
                                {DAY_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>
                                        {o.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="cron-option-row flex items-center gap-2">
                            <span className="cron-option-label">At</span>
                            {renderTimePicker()}
                        </div>
                    </div>
                );
            case 'custom':
                return (
                    <div className="flex flex-col gap-1">
                        <input
                            className="cron-custom-input"
                            value={customCron}
                            placeholder="* * * * *"
                            onChange={(e) => setCustomCron(e.target.value)}
                            spellCheck={false}
                        />
                        <span className="text-xs text-muted-foreground">
                            Format: minute hour day-of-month month day-of-week
                        </span>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="cron-generator flex flex-col gap-4">
            <div className="cron-frequency-row flex flex-wrap gap-1">
                {FREQUENCIES.map(({ key, label }) => (
                    <button
                        key={key}
                        type="button"
                        className={cn('cron-freq-btn', frequency === key && 'active')}
                        onClick={() => handleFrequencyChange(key)}
                    >
                        {label}
                    </button>
                ))}
            </div>

            <div className="cron-options-area">{renderOptions()}</div>

            <div className="cron-expression-preview flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Expression</span>
                <code className="cron-expression-code">{generated || '—'}</code>
            </div>

            {generated && (
                <div className="cron-statement-preview mt-2 rounded border border-dashed bg-muted/30 p-3">
                    <p className="text-sm font-medium text-foreground">{cronToStatement(generated)}</p>
                </div>
            )}
        </div>
    );
};

export default CronGenerator;
