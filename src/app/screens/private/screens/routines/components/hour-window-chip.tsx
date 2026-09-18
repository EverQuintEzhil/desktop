import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import Select from '@/components/ui/select';
import { cn } from '@/lib/utils';

import { formatHourLabel, HOUR_OPTIONS } from '../constants';

import { CHIP_CLASS } from './trigger-chip';

export interface Props {
    startHour: number;
    endHour: number;
    onChange: (window: { startHour: number; endHour: number }) => void;
    isErrored?: boolean;
}

const HourWindowChip = ({ startHour, endHour, onChange, isErrored }: Props) => {
    const [open, setOpen] = useState(false);

    const renderBound = (label: 'From' | 'To', hour: number, patch: (next: number) => void) => (
        <div className="hour-window-chip-bound flex items-center justify-between gap-3">
            <span className="text-sm text-(--text-secondary)">{label}</span>
            <Select<string>
                options={HOUR_OPTIONS}
                value={String(hour)}
                onChange={(next) => patch(Number(next ?? hour))}
                ariaLabel={label}
                variant="ghost"
                className={CHIP_CLASS}
                isErrored={isErrored}
                modal
            />
        </div>
    );

    return (
        <Popover open={open} onOpenChange={setOpen} modal>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    aria-invalid={isErrored ? 'true' : undefined}
                    className={cn(CHIP_CLASS, 'text-sm', isErrored ? 'text-destructive' : '')}
                >
                    {`Between ${formatHourLabel(startHour)} – ${formatHourLabel(endHour)}`}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="flex w-auto min-w-44 flex-col gap-2 rounded-2xl p-3">
                {renderBound('From', startHour, (next) => onChange({ startHour: next, endHour }))}
                {renderBound('To', endHour, (next) => onChange({ startHour, endHour: next }))}
            </PopoverContent>
        </Popover>
    );
};

export default HourWindowChip;
