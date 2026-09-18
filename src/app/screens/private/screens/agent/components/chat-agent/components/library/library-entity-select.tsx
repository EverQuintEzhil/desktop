import { CheckIcon, ChevronsUpDownIcon, SearchIcon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

interface EntitySelectOption {
    value: string;
    label: string;
}

interface LibraryEntitySelectProps {
    label: string;
    value?: string;
    options: EntitySelectOption[];
    onChange: (value?: string) => void;
    searchValue?: string;
    onSearchChange?: (value: string) => void;
    isLoading?: boolean;
    disabled?: boolean;
    emptyText?: string;
    disabledHint?: string;
}

const LibraryEntitySelect = (props: LibraryEntitySelectProps) => {
    const {
        label,
        value,
        options,
        onChange,
        searchValue,
        onSearchChange,
        isLoading = false,
        disabled = false,
        emptyText = 'No results found.',
        disabledHint,
    } = props;

    const [open, setOpen] = useState(false);
    const isServerSearch = typeof onSearchChange === 'function';
    const selectedOption = options.find((option) => option.value === value);
    const triggerLabel = selectedOption?.label ?? label;

    const handleSelect = (next: string) => {
        onChange(next === value ? undefined : next);
        setOpen(false);
    };

    const handleClear = () => {
        onChange(undefined);
        setOpen(false);
    };

    // Only the PopoverTrigger path is a combobox: `asChild` injects aria-expanded and
    // aria-haspopup there. The disabled path opens nothing, so it stays a plain button.
    const renderTrigger = (isCombobox: boolean) => (
        <Button
            variant="secondary"
            size="sm"
            role={isCombobox ? 'combobox' : undefined}
            aria-label={selectedOption ? `${label}: ${selectedOption.label}` : label}
            disabled={disabled}
            className="h-9 max-w-48 gap-1.5 rounded-full"
        >
            <span className="line-clamp-1 text-sm">{triggerLabel}</span>
            <ChevronsUpDownIcon className="size-3.5 shrink-0 text-text-secondary" />
        </Button>
    );

    const renderList = () => {
        if (isLoading) {
            return (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-text-secondary">
                    <Spinner className="size-4" />
                    Loading
                </div>
            );
        }

        return (
            <CommandList>
                <CommandEmpty>{emptyText}</CommandEmpty>
                <CommandGroup>
                    <CommandItem
                        value="__none__"
                        keywords={[label]}
                        onSelect={handleClear}
                        className="justify-between gap-2"
                    >
                        <span className="line-clamp-1">{label}</span>
                        <CheckIcon className={cn('size-4 text-primary', value ? 'opacity-0' : 'opacity-100')} />
                    </CommandItem>
                    {options.map((option) => {
                        const isChecked = option.value === value;

                        return (
                            <CommandItem
                                key={option.value}
                                value={option.value}
                                keywords={[option.label]}
                                onSelect={() => handleSelect(option.value)}
                                className="justify-between gap-2"
                            >
                                <span className="line-clamp-1">{option.label}</span>
                                <CheckIcon
                                    className={cn('size-4 text-primary', isChecked ? 'opacity-100' : 'opacity-0')}
                                />
                            </CommandItem>
                        );
                    })}
                </CommandGroup>
            </CommandList>
        );
    };

    const trigger = <PopoverTrigger asChild>{renderTrigger(true)}</PopoverTrigger>;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            {disabled && disabledHint ? (
                <SimpleTooltip content={disabledHint}>
                    <span className="inline-flex">{renderTrigger(false)}</span>
                </SimpleTooltip>
            ) : (
                trigger
            )}
            <PopoverContent align="start" className="w-64 p-0">
                <Command shouldFilter={!isServerSearch} className="max-h-[280px]">
                    <CommandInput
                        placeholder={`Search ${label.toLowerCase()}`}
                        value={searchValue}
                        onValueChange={onSearchChange}
                        icon={<SearchIcon className="size-4 text-text-secondary" />}
                    />
                    {renderList()}
                </Command>
            </PopoverContent>
        </Popover>
    );
};

export type { EntitySelectOption };
export default LibraryEntitySelect;
