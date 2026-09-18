import { format, parse, isValid, startOfDay } from 'date-fns';
import { CalendarIcon, XIcon } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DateRangeValue {
    from: string; // "YYYY-MM-DD"
    to: string; // "YYYY-MM-DD"
}

export interface DateRangeFilterProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
    /** Label text shown above each date field (e.g. "Date") */
    label: string;
    /** Controlled value — `{ from: "YYYY-MM-DD", to: "YYYY-MM-DD" }` */
    value: DateRangeValue;
    /** Called when either date changes — key is `"from"` or `"to"`, value is `"YYYY-MM-DD"` */
    onDateChange: (key: 'from' | 'to', value: string) => void;
    /** Aria label for the start date trigger */
    startAriaLabel?: string;
    /** Aria label for the end date trigger */
    endAriaLabel?: string;
    /** Legacy inline-CSS string forwarded to the wrapper */
    styles?: string;
    showTime?: boolean;
    /** Upper bound applied to both fields — e.g. `new Date()` to block future dates. */
    maxDate?: Date;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DATE_FORMAT = 'yyyy-MM-dd';
const DISPLAY_FORMAT = 'PPP'; // e.g. "Jan 5, 2026"

function toDate(str: string): Date | undefined {
    if (!str) return undefined;
    const formatStr = str.includes('T') ? "yyyy-MM-dd'T'HH:mm" : DATE_FORMAT;
    const d = parse(str, formatStr, new Date());

    return isValid(d) ? d : undefined;
}

function toStr(d: Date | undefined, includeTime: boolean = false): string {
    if (!d) return '';

    return format(d, includeTime ? "yyyy-MM-dd'T'HH:mm" : DATE_FORMAT);
}

/**
 * Clear control overlaid on a date trigger — hidden and inert until the field is hovered,
 * always shown on pointers without hover. Sizing is forced with `!` because consumers style
 * descendant buttons generically (e.g. `[&_button]:w-full [&_button]:justify-between`).
 */
const CLEAR_BUTTON_CLASSES = cn(
    'absolute top-1/2 size-5! -translate-y-1/2 justify-center! rounded-sm',
    'pointer-events-none bg-background text-(--text-secondary) opacity-0',
    'hover:bg-primary/10 hover:text-(--text-primary)',
    'group-hover:pointer-events-auto group-hover:opacity-100',
    'focus-visible:pointer-events-auto focus-visible:opacity-100',
    '[@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100',
);

/** Calendar icon gives way to the clear control once a value is set. */
const CALENDAR_ICON_HIDDEN_CLASSES = 'transition-opacity group-hover:opacity-0 [@media(hover:none)]:opacity-0';

// ─── Sub-component: single date picker popover ───────────────────────────────

interface DateFieldProps {
    label: string;
    sublabel: string;
    ariaLabel: string;
    value: string; // "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm"
    onChange: (val: string) => void;
    /** Disable dates before this date */
    minDate?: Date;
    /** Disable dates after this date */
    maxDate?: Date;
    showTime?: boolean;
    defaultTime?: string;
}

function DateField({
    label,
    sublabel,
    ariaLabel,
    value,
    onChange,
    minDate,
    maxDate,
    showTime,
    defaultTime,
}: DateFieldProps) {
    const selected = toDate(value);
    const timeStr = selected && value.includes('T') ? format(selected, 'HH:mm') : defaultTime || '00:00';
    const triggerRef = React.useRef<HTMLButtonElement>(null);

    const handleDateSelect = (day: Date | undefined) => {
        if (!day) {
            onChange('');

            return;
        }
        if (showTime) {
            const [hh, mm] = timeStr.split(':').map(Number);

            day.setHours(hh || 0, mm || 0);
            onChange(toStr(day, true));
        } else {
            onChange(toStr(day, false));
        }
    };

    const handleClear = () => {
        onChange('');
        triggerRef.current?.focus();
    };

    const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newTime = e.target.value;

        if (!selected) return;
        const [hh, mm] = newTime.split(':').map(Number);
        const newDate = new Date(selected);

        newDate.setHours(hh || 0, mm || 0);
        onChange(toStr(newDate, true));
    };

    return (
        <div className="date-range-filter-custom-style flex flex-col gap-1">
            <span className="text-xs font-medium text-(--text-primary)">
                {label}
                &nbsp;
                {sublabel}
            </span>
            <div className="date-field-trigger group relative flex flex-col">
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            ref={triggerRef}
                            variant="ghost"
                            className="date-picker-custom-style h-8 border border-border-secondary text-(--text-secondary)"
                            aria-label={ariaLabel}
                            data-empty={!selected}
                        >
                            {selected ? (
                                <span className="text-sm font-normal text-(--text-primary)">
                                    {format(selected, showTime ? 'PPP p' : DISPLAY_FORMAT)}
                                </span>
                            ) : (
                                <span className="text-sm font-normal text-text-secondary">{sublabel}</span>
                            )}
                            <CalendarIcon className={cn('size-4', selected && CALENDAR_ICON_HIDDEN_CLASSES)} />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            mode="single"
                            selected={selected}
                            onSelect={handleDateSelect}
                            disabled={(date) => {
                                const dayStart = startOfDay(date);

                                if (minDate && dayStart < startOfDay(minDate)) return true;
                                if (maxDate && dayStart > startOfDay(maxDate)) return true;

                                return false;
                            }}
                        />
                        {showTime && (
                            <div className="flex items-center justify-between border-t border-border p-3">
                                <span className="text-xs font-medium text-muted-foreground">Time</span>
                                <Input
                                    type="time"
                                    value={timeStr}
                                    onChange={handleTimeChange}
                                    className="w-[120px] bg-transparent"
                                />
                            </div>
                        )}
                    </PopoverContent>
                </Popover>
                {selected && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Clear ${ariaLabel}`}
                        onClick={handleClear}
                        className={cn(CLEAR_BUTTON_CLASSES, 'right-3.5')}
                    >
                        <XIcon className="size-3.5" />
                    </Button>
                )}
            </div>
        </div>
    );
}

// ─── Main Component ──────────────────────────────────────────────────────────

/**
 * Shadcn-based drop-in replacement for the custom `DateRangeFilter` component.
 *
 * Uses `Popover` + `Calendar` for each date instead of native `<input type="date">`.
 * The API is identical: `value: { from, to }` as `"YYYY-MM-DD"` strings,
 * and `onDateChange("from" | "to", "YYYY-MM-DD")`.
 */
const DateRangeFilter = ({
    label,
    value,
    onDateChange,
    startAriaLabel,
    endAriaLabel,
    styles,
    className,
    showTime,
    maxDate,
    ...rest
}: DateRangeFilterProps) => {
    const toDate_ = toDate(value.to);
    const fromDate_ = toDate(value.from);
    // "from" is bounded by both "to" and the overall ceiling — take whichever is tighter.
    const fromMaxDate = toDate_ && maxDate ? (toDate_ < maxDate ? toDate_ : maxDate) : toDate_ || maxDate;

    return (
        <div
            className={cn('date-range-filter flex items-start gap-2', className)}
            style={styles ? ({ cssText: styles } as React.CSSProperties) : undefined}
            {...rest}
        >
            <DateField
                label={label}
                sublabel="From"
                ariaLabel={startAriaLabel || `${label} start`}
                value={value.from}
                onChange={(v) => onDateChange('from', v)}
                maxDate={fromMaxDate}
                showTime={showTime}
                defaultTime="00:00"
            />
            <DateField
                label={label}
                sublabel="To"
                ariaLabel={endAriaLabel || `${label} end`}
                value={value.to}
                onChange={(v) => onDateChange('to', v)}
                minDate={fromDate_} // "to" cannot precede "from"
                maxDate={maxDate}
                showTime={showTime}
                defaultTime="23:59"
            />
        </div>
    );
};

DateRangeFilter.displayName = 'DateRangeFilter';

// ─── Merged Range Picker (single trigger with 2-month calendar) ──────────────

const DISPLAY_SHORT = 'LLL dd, y'; // e.g. "Jan 20, 2026"

export interface DateRangePickerMergedProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
    /** Label text shown above the trigger */
    label?: string;
    /** Controlled value — `{ from: "YYYY-MM-DD", to: "YYYY-MM-DD" }` */
    value: DateRangeValue;
    /**
     * Called once per selection with the full range. A range calendar resolves both ends
     * together, so this fires a single update instead of two sequential `from`/`to` writes —
     * two writes racing against a caller that derives "the other end" from its own stale
     * state can silently undo the first one.
     */
    onRangeChange: (range: DateRangeValue) => void;
    /** Aria label for the trigger button */
    ariaLabel?: string;
    /** Number of calendar months to display (default: 2) */
    numberOfMonths?: number;
    /** Legacy inline-CSS string forwarded to the wrapper */
    styles?: string;
}

/**
 * A merged date range picker — single trigger button showing both dates,
 * opening a 2-month calendar in range selection mode.
 */
const DateRangePickerMerged = ({
    label,
    value,
    onRangeChange,
    ariaLabel,
    numberOfMonths = 2,
    styles,
    className,
    ...rest
}: DateRangePickerMergedProps) => {
    const fromDate = toDate(value.from);
    const toDate_ = toDate(value.to);

    const rangeValue = React.useMemo(
        () => ({
            from: fromDate,
            to: toDate_,
        }),
        [fromDate, toDate_],
    );

    const handleSelect = React.useCallback(
        (range: { from?: Date; to?: Date } | undefined) => {
            onRangeChange({ from: toStr(range?.from), to: toStr(range?.to) });
        },
        [onRangeChange],
    );

    const triggerRef = React.useRef<HTMLButtonElement>(null);

    const handleClear = React.useCallback(() => {
        onRangeChange({ from: '', to: '' });
        triggerRef.current?.focus();
    }, [onRangeChange]);

    const hasSelection = fromDate || toDate_;

    return (
        <div
            className={cn('flex flex-col gap-1', className)}
            style={styles ? ({ cssText: styles } as React.CSSProperties) : undefined}
            {...rest}
        >
            {label && <span className="text-xs font-medium">{label}</span>}
            <div className="date-range-picker-trigger group relative flex flex-col">
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            ref={triggerRef}
                            variant="outline"
                            aria-label={ariaLabel || label || 'Pick a date range'}
                            data-empty={!hasSelection}
                            className={cn(
                                'w-auto justify-start px-2.5 text-left text-sm font-normal text-(--text-primary)',
                                'data-[empty=true]:text-muted-foreground',
                                hasSelection && 'pr-8',
                            )}
                        >
                            <CalendarIcon className="size-4" />
                            {fromDate &&
                                (toDate_ ? (
                                    <>
                                        {format(fromDate, DISPLAY_SHORT)}
                                        {' - '}
                                        {format(toDate_, DISPLAY_SHORT)}
                                    </>
                                ) : (
                                    format(fromDate, DISPLAY_SHORT)
                                ))}
                            {!fromDate && <span>Pick a date</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            mode="range"
                            defaultMonth={fromDate}
                            selected={rangeValue}
                            onSelect={handleSelect}
                            numberOfMonths={numberOfMonths}
                            // With 2+ months open at once, a date at the seam (e.g. the 1st of
                            // month two) would otherwise render as an outside day in month one
                            // AND as its real day in month two — both picking up the selected
                            // range styling, which reads as the same date being selected twice.
                            showOutsideDays={numberOfMonths === 1}
                            // Without this, day-picker's default range-click algorithm treats any
                            // click after the current start as moving the end (even for a date
                            // inside the existing range) — a fresh click can only ever start a new
                            // range if it lands before the current start. This makes a complete
                            // range restart on the next click instead, so picking a new start is
                            // just "click it".
                            resetOnSelect
                        />
                    </PopoverContent>
                </Popover>
                {hasSelection && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Clear ${ariaLabel || label || 'date range'}`}
                        onClick={handleClear}
                        className={cn(CLEAR_BUTTON_CLASSES, 'right-1.5')}
                    >
                        <XIcon className="size-3.5" />
                    </Button>
                )}
            </div>
        </div>
    );
};

DateRangePickerMerged.displayName = 'DateRangePickerMerged';

export default DateRangeFilter;
export { DateRangePickerMerged };
export type { DateRangeValue as DateRangeFilterValue };
