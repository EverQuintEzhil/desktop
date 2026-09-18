import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import { ALL_WEEKDAYS } from '../constants';
import { weekdaySetLabel } from '../utils/cron-schedule';

import { CHIP_CLASS } from './trigger-chip';

export interface Props {
    /** Cron day-of-week numbers, Sunday = 0, sorted ascending. */
    weekdays: number[];
    onChange: (weekdays: number[]) => void;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const WeekdayChip = ({ weekdays, onChange }: Props) => {
    const [open, setOpen] = useState(false);

    // The last selected day cannot be turned off: an empty set has no cron to say.
    const toggle = (day: number) => {
        const isSelected = weekdays.includes(day);

        if (isSelected && weekdays.length === 1) return;

        onChange(isSelected ? weekdays.filter((at) => at !== day) : [...weekdays, day].sort((a, b) => a - b));
    };

    const renderDay = (day: number) => {
        const isSelected = weekdays.includes(day);

        return (
            <button
                key={day}
                type="button"
                aria-label={DAY_NAMES[day]}
                aria-pressed={isSelected}
                className={cn(
                    'flex size-8 cursor-pointer items-center justify-center rounded-full text-sm',
                    'focus-visible:ring-2 focus-visible:ring-(--color-focus-ring) focus-visible:outline-none',
                    isSelected ? 'bg-primary text-primary-foreground' : 'text-text-secondary hover:bg-accent',
                )}
                onClick={() => toggle(day)}
            >
                {DAY_LETTERS[day]}
            </button>
        );
    };

    return (
        <Popover open={open} onOpenChange={setOpen} modal>
            <PopoverTrigger asChild>
                <Button type="button" variant="ghost" aria-label="Days of week" className={cn(CHIP_CLASS, 'text-sm')}>
                    {weekdaySetLabel(weekdays)}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto rounded-2xl p-2">
                <div className="weekday-chip-days flex items-center gap-1">{ALL_WEEKDAYS.map(renderDay)}</div>
            </PopoverContent>
        </Popover>
    );
};

export default WeekdayChip;
