import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import { CHIP_CLASS } from './trigger-chip';

export interface Props {
    value: string;
    onChange: (time: string) => void;
    isErrored?: boolean;
}

type Meridiem = 'AM' | 'PM';

const pad = (part: number) => String(part).padStart(2, '0');

const parseTime = (value: string) => {
    const [rawHour, rawMinute] = value.split(':');
    const hour24 = Number(rawHour);
    const minute = Number(rawMinute);
    const isReadable = Number.isInteger(hour24) && Number.isInteger(minute);

    if (!isReadable) return { hour12: 12, minute: 0, meridiem: 'AM' as Meridiem };

    return {
        hour12: hour24 % 12 || 12,
        minute,
        meridiem: (hour24 < 12 ? 'AM' : 'PM') as Meridiem,
    };
};

const composeTime = (hour12: number, minute: number, meridiem: Meridiem) => {
    const hour24 = meridiem === 'AM' ? hour12 % 12 : (hour12 % 12) + 12;

    return `${pad(hour24)}:${pad(minute)}`;
};

const clamp = (part: number, min: number, max: number) => Math.min(Math.max(part, min), max);

const PART_CLASS =
    'h-10 w-14 rounded-lg border-0 bg-muted px-0 text-center text-base font-medium text-(--text-primary) focus:border-0';

const TimeChip = ({ value, onChange, isErrored }: Props) => {
    const [open, setOpen] = useState(false);
    const { hour12, minute, meridiem } = parseTime(value);
    const [hourDraft, setHourDraft] = useState(String(hour12));
    const [minuteDraft, setMinuteDraft] = useState(pad(minute));

    const syncDrafts = (next: string) => {
        const parsed = parseTime(next);

        setHourDraft(String(parsed.hour12));
        setMinuteDraft(pad(parsed.minute));
    };

    const readHour = (draft: string) => {
        const parsed = Number(draft);

        return Number.isInteger(parsed) && draft !== '' ? clamp(parsed, 1, 12) : hour12;
    };

    const readMinute = (draft: string) => {
        const parsed = Number(draft);

        return Number.isInteger(parsed) && draft !== '' ? clamp(parsed, 0, 59) : minute;
    };

    const commitHour = (draft: string) => {
        const hour = readHour(draft);

        setHourDraft(String(hour));
        onChange(composeTime(hour, minute, meridiem));
    };

    const commitMinute = (draft: string) => {
        const next = readMinute(draft);

        setMinuteDraft(pad(next));
        onChange(composeTime(hour12, next, meridiem));
    };

    // Radix unmounts the inputs before they can blur, so close is the last chance to keep a typed
    // draft; both parts ride one `onChange`, since a second would recompose from a stale `value`.
    const commitDrafts = () => {
        const hour = readHour(hourDraft);
        const nextMinute = readMinute(minuteDraft);
        const next = composeTime(hour, nextMinute, meridiem);

        setHourDraft(String(hour));
        setMinuteDraft(pad(nextMinute));
        if (next !== value) onChange(next);
    };

    const handleOpenChange = (next: boolean) => {
        if (next) syncDrafts(value);
        else commitDrafts();
        setOpen(next);
    };

    const renderMeridiem = (option: Meridiem) => (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={meridiem === option}
            className={cn(
                'h-9 w-12 justify-center rounded-md text-sm font-medium',
                meridiem === option
                    ? 'bg-(--surface) text-(--text-primary) shadow-sm hover:bg-(--surface)'
                    : 'text-(--text-secondary) hover:bg-transparent hover:text-(--text-primary)',
            )}
            onClick={() => onChange(composeTime(hour12, minute, option))}
        >
            {option}
        </Button>
    );

    return (
        <Popover open={open} onOpenChange={handleOpenChange} modal>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    aria-label="Time of day"
                    aria-invalid={isErrored ? 'true' : undefined}
                    className={cn(CHIP_CLASS, 'justify-center text-sm', isErrored ? 'text-destructive' : '')}
                >
                    {`${hour12}:${pad(minute)} ${meridiem}`}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto rounded-2xl p-2">
                <div className="time-chip-parts flex items-center gap-1">
                    <Input
                        aria-label="Hour"
                        inputMode="numeric"
                        className={PART_CLASS}
                        value={hourDraft}
                        onChange={(e) => setHourDraft(e.target.value.replace(/\D/g, '').slice(0, 2))}
                        onBlur={(e) => commitHour(e.target.value)}
                        onEnter={commitHour}
                    />
                    <span className="px-0.5 text-base text-(--text-secondary)">:</span>
                    <Input
                        aria-label="Minute"
                        inputMode="numeric"
                        className={PART_CLASS}
                        value={minuteDraft}
                        onChange={(e) => setMinuteDraft(e.target.value.replace(/\D/g, '').slice(0, 2))}
                        onBlur={(e) => commitMinute(e.target.value)}
                        onEnter={commitMinute}
                    />
                    <div className="time-chip-meridiem ml-1 flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
                        {renderMeridiem('AM')}
                        {renderMeridiem('PM')}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
};

export default TimeChip;
