import { CheckIcon, ChevronsUpDownIcon, ListFilterIcon, type LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRoot,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface Props<T extends string> {
    value: T;
    options: readonly { value: T; label: string }[];
    onChange: (value: T) => void;
    label: string;
    Icon?: LucideIcon;
}

const RoutineFilterMenu = <T extends string>({ value, options, onChange, label, Icon = ListFilterIcon }: Props<T>) => {
    const activeLabel = options.find((option) => option.value === value)?.label ?? label;

    return (
        <DropdownMenuRoot>
            <DropdownMenuTrigger asChild>
                <Button type="button" variant="secondary" size="sm" className="h-8 gap-1.5 rounded-full">
                    <Icon aria-hidden="true" className="size-3.5 text-text-secondary" />
                    {/* Every option is laid into the same grid cell so the trigger is as wide as the widest label and switching cannot reflow the header row. */}
                    <span className="grid text-left text-sm">
                        <span className="col-start-1 row-start-1">{activeLabel}</span>
                        {options.map((option) => (
                            <span key={option.value} aria-hidden="true" className="invisible col-start-1 row-start-1">
                                {option.label}
                            </span>
                        ))}
                    </span>
                    <ChevronsUpDownIcon aria-hidden="true" className="size-3.5 text-text-secondary" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                {options.map((option) => (
                    <DropdownMenuItem
                        key={option.value}
                        className="cursor-pointer justify-between gap-2"
                        onSelect={() => onChange(option.value)}
                    >
                        <span>{option.label}</span>
                        <CheckIcon
                            aria-hidden="true"
                            className={cn('size-4 text-primary', option.value === value ? 'opacity-100' : 'opacity-0')}
                        />
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenuRoot>
    );
};

export default RoutineFilterMenu;
