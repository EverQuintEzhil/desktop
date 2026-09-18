import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import { ROUTINE_ICON_CHOICES, routineIcon } from '../utils/routine-icon';

interface Props {
    /** The picked icon key, or '' while the fixed zap default stands in. */
    value: string;
    onChange: (key: string) => void;
}

const RoutineIconPicker = ({ value, onChange }: Props) => {
    const [open, setOpen] = useState(false);
    const Current = routineIcon(value || null);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Pick an icon"
                    className="size-10 shrink-0 rounded-lg border-primary/20 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                >
                    <Current aria-hidden="true" className="size-4.5" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-96 p-2">
                <div
                    role="listbox"
                    aria-label="Routine icons"
                    className="scrollbar-controller scrollbar-vertical grid max-h-80 grid-cols-10 gap-0.5"
                >
                    {ROUTINE_ICON_CHOICES.map(({ key, Icon }) => (
                        <button
                            key={key}
                            type="button"
                            role="option"
                            aria-selected={value === key}
                            aria-label={key}
                            className={cn(
                                'flex size-7 cursor-pointer items-center justify-center rounded-md hover:bg-accent focus-visible:ring-2 focus-visible:ring-(--color-focus-ring) focus-visible:outline-none',
                                value === key && 'bg-accent',
                            )}
                            onClick={() => {
                                onChange(key);
                                setOpen(false);
                            }}
                        >
                            <Icon aria-hidden="true" className="size-4 text-text-secondary" />
                        </button>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
};

export default RoutineIconPicker;
