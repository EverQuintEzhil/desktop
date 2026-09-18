import axios from 'axios';
import debounce from 'lodash/debounce';
import { CheckIcon, ChevronDownIcon, PlusIcon, XIcon } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import type { NewSuggestionType, SuggestionItem as ISuggestionItem } from '@/components/ui/ui.types';
import { cn } from '@/lib/utils';

export interface SelectSuggestionItem<T = unknown> extends Omit<ISuggestionItem<T>, 'value'> {
    value?: T;
}

export interface MultiSelectProps<T = string | number | object | null> {
    allowSearch?: boolean;
    data: Array<SelectSuggestionItem<T>> | ((query: string) => Promise<Array<SelectSuggestionItem<T>>>);
    defaultText?: string;
    disabled?: boolean;
    error?: {
        state: boolean;
        message: string;
    };
    newSuggestion?: NewSuggestionType<T>;
    none?: boolean;
    onBlur?: () => void;
    onClick?: () => void;
    onEnter?: () => void;
    onKeyDown?: () => void;
    onSelect: (item: SelectSuggestionItem<T>[]) => void;
    required?: boolean;
    styles?: string;
    toolTip?: {
        colorValue: string;
        content: string;
        contentType: string;
        contentStyles: string;
    };
    trim?: boolean;
    value: SelectSuggestionItem<T>[];
    noneLabel?: string;
    labelPosition?: string;
    useSearchCondition?: boolean;
    maximumShow?: number;
    className?: string; // Optional nice-to-have for Shadcn
    modal?: boolean;
}

const { isCancel } = axios;

export function MultiSelect<T>({
    allowSearch = false,
    data,
    defaultText = 'Select options...',
    disabled = false,
    error,
    newSuggestion,
    onBlur,
    onClick,
    onEnter,
    onKeyDown,
    onSelect,
    styles,
    value: propValue = [],
    useSearchCondition = true,
    maximumShow,
    labelPosition,
    className,
    modal,
}: MultiSelectProps<T>) {
    const listboxId = React.useId();
    const triggerRef = React.useRef<HTMLButtonElement>(null);
    const [open, setOpen] = React.useState(false);
    const [internalOptions, setInternalOptions] = React.useState<Array<SelectSuggestionItem<T>>>([]);
    const [loading, setLoading] = React.useState(false);
    const [searchValue, setSearchValue] = React.useState('');
    const [activeValue, setActiveValue] = React.useState('');
    const [isExactMatch, setIsExactMatch] = React.useState(true);
    const hasInteracted = React.useRef(false);

    const isAsync = typeof data === 'function';

    const fetchOptions = React.useCallback(
        async (query: string) => {
            if (!isAsync) return;
            setLoading(true);

            try {
                const result = await data(query);

                if (newSuggestion?.enabled) {
                    const matchArray = result.filter((e) => {
                        const searchStr = query.trim();

                        if (e.searchLabel) {
                            return e.searchLabel === searchStr;
                        }

                        return e.label === searchStr;
                    });

                    setIsExactMatch(matchArray.length !== 0);
                }

                setInternalOptions(result);
            } catch (err: unknown) {
                if (isCancel(err)) return;
                console.error('Error fetching options:', err);
            } finally {
                setLoading(false);
            }
        },
        [isAsync, data, newSuggestion?.enabled],
    );

    const debouncedFetch = React.useCallback(
        debounce((query: string) => fetchOptions(query), 500),
        [fetchOptions],
    );

    React.useEffect(() => {
        if (!isAsync && Array.isArray(data)) {
            let tempData = data.slice();

            if (searchValue && allowSearch) {
                tempData = data.filter((v) => v.label.toLowerCase().includes(searchValue.toLowerCase()));
            }
            if (newSuggestion?.enabled) {
                const matchArray = tempData.filter((e) => {
                    const searchStr = searchValue.trim();

                    if (e.searchLabel) {
                        return e.searchLabel === searchStr;
                    }

                    return e.label === searchStr;
                });

                setIsExactMatch(matchArray.length !== 0);
            }
            setInternalOptions(tempData);
        } else if (open && isAsync && internalOptions.length === 0 && !searchValue) {
            fetchOptions('');
        }
    }, [data, open, isAsync, allowSearch, searchValue, fetchOptions, internalOptions.length, newSuggestion?.enabled]);

    React.useEffect(() => {
        if (open) {
            hasInteracted.current = false;
            setActiveValue('');
        }
    }, [open]);

    const handleSearch = (search: string) => {
        setSearchValue(search);
        if (isAsync) {
            debouncedFetch(search);
        }
    };

    const handleSelect = React.useCallback(
        (option: SelectSuggestionItem<T>) => {
            if (!onSelect) return;
            const newPropValue = [...propValue];
            const isAlreadySelected = newPropValue.find((prevOption) =>
                prevOption.value !== undefined ? prevOption.value === option.value : prevOption.label === option.label,
            );

            if (isAlreadySelected) {
                onSelect(
                    newPropValue.filter((prevOption) =>
                        prevOption.value !== undefined
                            ? prevOption.value !== option.value
                            : prevOption.label !== option.label,
                    ),
                );
            } else {
                newPropValue.push(option);
                onSelect(newPropValue);
            }
        },
        [onSelect, propValue],
    );

    const handleRemove = React.useCallback(
        (e: React.SyntheticEvent, item: SelectSuggestionItem<T>) => {
            e.stopPropagation();
            if (!onSelect) return;
            const newPropValue = [...propValue];

            onSelect(
                newPropValue.filter((prevOption) =>
                    item.value !== undefined ? prevOption.value !== item.value : prevOption.label !== item.label,
                ),
            );
        },
        [onSelect, propValue],
    );

    const addNewTag = () => {
        if (!newSuggestion?.enabled) return;
        const newItem: SelectSuggestionItem<T> = { label: searchValue.trim() } as SelectSuggestionItem<T>;

        newSuggestion.action(newItem);
        setSearchValue('');
        if (isAsync) debouncedFetch('');
    };

    const renderSelectedValues = () => {
        if (!propValue || propValue.length === 0) {
            return <span className="truncate px-1 text-sm font-normal text-muted-foreground">{defaultText}</span>;
        }

        let visibleTags = propValue;
        let remainingCount = 0;

        if (maximumShow && propValue.length > maximumShow) {
            visibleTags = propValue.slice(0, maximumShow);
            remainingCount = propValue.length - maximumShow;
        }

        return (
            <div className="multi-select-container flex h-full flex-wrap items-center gap-1 overflow-hidden py-1">
                {visibleTags.map((item) => (
                    <div
                        key={item.label}
                        className="multi-select-item flex max-w-full items-center gap-1 rounded-sm bg-accent px-2 py-0.5 text-primary"
                    >
                        <span className="truncate text-sm">{item.label}</span>
                        <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleRemove(e, item);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.stopPropagation();
                                    handleRemove(e, item);
                                }
                            }}
                        >
                            <XIcon className="pointer-events-none h-3 w-3" />
                        </span>
                    </div>
                ))}
                {remainingCount > 0 && (
                    <span className="flex shrink-0 items-center rounded-sm bg-accent px-2 py-0.5 text-sm text-primary">
                        +{remainingCount}
                    </span>
                )}
            </div>
        );
    };

    const modalPortalContainer = !open
        ? undefined
        : (() => {
              const el = triggerRef.current?.closest('[data-slot=sheet-content]');

              return el instanceof HTMLElement ? el : undefined;
          })();

    const [isInsideModal, setIsInsideModal] = React.useState(false);

    React.useEffect(() => {
        if (triggerRef.current) {
            setIsInsideModal(
                !!triggerRef.current.closest('.dialog-block') ||
                    !!triggerRef.current.closest('[data-slot=sheet-content]'),
            );
        }
    }, []);

    React.useEffect(() => {
        if (!open) return;
        const handlePointerDown = (e: PointerEvent) => {
            const target = e.target as HTMLElement;

            if (triggerRef.current?.contains(target)) return;
            const contentElement = document.getElementById(listboxId);

            if (contentElement?.contains(target)) return;

            setOpen(false);
        };

        // Use capture so it fires before React events
        document.addEventListener('pointerdown', handlePointerDown, { capture: true });

        return () => document.removeEventListener('pointerdown', handlePointerDown, { capture: true });
    }, [open, listboxId]);

    const isPopoverModal = modal ?? isInsideModal;

    return (
        <Popover
            open={open}
            modal={isPopoverModal}
            onOpenChange={(newState) => {
                setOpen(newState);
                if (!newState) {
                    if (onBlur) onBlur();
                    setSearchValue('');
                }
            }}
        >
            <PopoverTrigger asChild>
                <Button
                    ref={triggerRef}
                    variant="ghost"
                    size="sm"
                    role="combobox"
                    aria-expanded={open}
                    aria-controls={listboxId}
                    disabled={disabled}
                    onClick={() => {
                        if (onClick) onClick();
                    }}
                    onKeyDown={(e) => {
                        if (onKeyDown) onKeyDown();
                        if (e.key === 'Enter' && onEnter) onEnter();
                    }}
                    className={cn(
                        'text-(--text-secondary)',
                        error?.state ? 'border-destructive' : 'border-border-secondary focus-visible:border-primary',
                        open && (error?.state ? 'border-destructive outline-none' : 'border-primary outline-none'),
                        labelPosition === 'overlay' ? 'mt-2' : '',
                        styles,
                        className,
                    )}
                >
                    <div className="flex min-w-0 flex-1 items-center justify-start overflow-hidden" tabIndex={-1}>
                        {renderSelectedValues()}
                    </div>
                    <ChevronDownIcon className="h-4 w-4" />
                </Button>
            </PopoverTrigger>
            {open && (
                <PopoverContent
                    id={listboxId}
                    container={modalPortalContainer}
                    className="z-100 w-(--radix-popover-trigger-width) min-w-[200px] p-0 data-[state=closed]:animate-none data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-100"
                    align="start"
                    onMouseLeave={() => {
                        hasInteracted.current = false;
                        setActiveValue('');
                    }}
                >
                    <Command
                        shouldFilter={!isAsync}
                        value={activeValue}
                        onValueChange={(value) => {
                            if (hasInteracted.current) {
                                setActiveValue(value);
                            }
                        }}
                        onPointerMove={() => {
                            hasInteracted.current = true;
                        }}
                        onKeyDown={() => {
                            hasInteracted.current = true;
                        }}
                        tabIndex={0}
                        loop
                    >
                        {allowSearch && (!useSearchCondition || internalOptions.length > 5 || searchValue !== '') && (
                            <CommandInput placeholder="Search..." value={searchValue} onValueChange={handleSearch} />
                        )}
                        <CommandList className="max-h-[200px]">
                            {loading && (
                                <CommandGroup>
                                    {Array(3)
                                        .fill(null)
                                        .map((_, i) => (
                                            <CommandItem key={`loading-${i}`} disabled className="flex p-2">
                                                <Skeleton className="h-6 w-full rounded-lg" />
                                            </CommandItem>
                                        ))}
                                </CommandGroup>
                            )}

                            {!loading && internalOptions.length === 0 && (!newSuggestion?.enabled || isExactMatch) && (
                                <CommandEmpty>No options found.</CommandEmpty>
                            )}

                            {!loading && (
                                <CommandGroup>
                                    {internalOptions.map((option, index) => {
                                        const isPrimitiveValue =
                                            typeof option.value === 'string' || typeof option.value === 'number';
                                        const uniqueTrackingValue = isPrimitiveValue
                                            ? String(option.value)
                                            : `${option.label}-${index}`;
                                        const fallbackKey = isPrimitiveValue ? String(option.value) : index;
                                        const commandItemKey = isAsync ? uniqueTrackingValue : fallbackKey;

                                        const isSelected = !!propValue.find((p) =>
                                            p.value !== undefined ? p.value === option.value : p.label === option.label,
                                        );

                                        return (
                                            <CommandItem
                                                key={commandItemKey}
                                                value={isAsync ? uniqueTrackingValue : undefined}
                                                onSelect={() => handleSelect(option)}
                                                className="select-item flex cursor-pointer justify-between"
                                            >
                                                <span>{option.label}</span>
                                                <CheckIcon
                                                    className={cn(
                                                        'h-4 w-4 shrink-0 text-primary',
                                                        isSelected ? 'opacity-100' : 'opacity-0',
                                                    )}
                                                />
                                            </CommandItem>
                                        );
                                    })}

                                    {newSuggestion?.enabled &&
                                        searchValue.trim() !== '' &&
                                        !isExactMatch &&
                                        !loading && (
                                            <CommandItem
                                                onSelect={addNewTag}
                                                className="cursor-pointer text-primary hover:bg-accent"
                                                value={searchValue.trim()}
                                            >
                                                <span className="flex items-center gap-2">
                                                    <PlusIcon className="h-4 w-4" />
                                                    {newSuggestion.label
                                                        ? newSuggestion.label
                                                        : `Add "${searchValue.trim()}"`}
                                                </span>
                                            </CommandItem>
                                        )}
                                </CommandGroup>
                            )}
                        </CommandList>
                    </Command>
                </PopoverContent>
            )}
        </Popover>
    );
}

export default MultiSelect;
