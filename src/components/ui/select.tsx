import debounce from 'lodash/debounce';
import isEqual from 'lodash/isEqual';
import { CheckIcon, ChevronDownIcon } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SelectLoading, SelectLoadingMore, type SelectLoadingVariant } from '@/components/ui/select-loading';
import { cn } from '@/lib/utils';

import './select.scss';

export interface ComboboxOption<T = unknown> {
    value: T;
    label: string;
}

export interface SelectPageInfo {
    page: number;
    total_pages: number;
}

export interface PaginatedSelectData<T = unknown> {
    list: Array<ComboboxOption<T>>;
    pageInfo: SelectPageInfo;
}

export interface SuggestionItem<T = unknown> {
    label: string;
    value: T;
    searchLabel?: string;
    onClick?: () => void;
    key?: string;
}

export interface SelectSuggestionItem<T = unknown> extends Omit<SuggestionItem<T>, 'value'> {
    value?: T;
}

export interface SelectProps<T = unknown> {
    options?:
        | ComboboxOption<T>[]
        | ((query: string) => Promise<Array<ComboboxOption<T>>>)
        | ((query: string, page?: number) => Promise<PaginatedSelectData<T>>);
    value?: T | null;
    onChange?: (value: T | null) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    emptyText?: string;
    /** Words shown while async options load. Pass a node to fully replace the message. */
    loadingText?: React.ReactNode;
    /** How the loading state looks. `skeleton` renders silent row shapes instead. */
    loadingVariant?: SelectLoadingVariant;
    className?: string;
    popoverClassName?: string;
    triggerLabelClassName?: string;
    triggerChevronClassName?: string;
    triggerChevronIconClassName?: string;
    disabled?: boolean;
    /** Names the trigger for assistive tech when the only visible text is the selected value. */
    ariaLabel?: string;
    allowSearch?: boolean;
    tabIndex?: number;
    allowDeselect?: boolean;
    variant?: 'default' | 'outline' | 'ghost' | 'black';
    triggerAlign?: 'start' | 'center' | 'end';
    defaultOption?: ComboboxOption<T>;
    isErrored?: boolean;
    modal?: boolean;
}

const triggerChevronColorClass = (variant: 'default' | 'outline' | 'ghost' | 'black') => {
    switch (variant) {
        case 'default':
            return 'text-primary-foreground';
        case 'outline':
            return 'text-(--text-secondary)';
        case 'ghost':
            return 'text-(--text-secondary)';
        case 'black':
            return 'text-white';
    }
};

export default function Select<T = unknown>({
    options,
    value,
    onChange,
    placeholder = 'Select an option...',
    searchPlaceholder = 'Search...',
    emptyText = 'No option found.',
    loadingText = 'Loading...',
    loadingVariant = 'spinner',
    className,
    disabled = false,
    ariaLabel,
    allowSearch = false,
    tabIndex,
    popoverClassName,
    triggerLabelClassName,
    allowDeselect = false,
    variant = 'default',
    triggerChevronIconClassName,
    triggerAlign = 'start',
    defaultOption,
    isErrored = false,
    modal,
}: SelectProps<T>) {
    const listboxId = React.useId();
    const triggerRef = React.useRef<HTMLButtonElement>(null);
    const [open, setOpen] = React.useState(false);
    const [internalOptions, setInternalOptions] = React.useState<ComboboxOption<T>[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [loadingMore, setLoadingMore] = React.useState(false);
    const [hasResolvedOnce, setHasResolvedOnce] = React.useState(false);
    const [searchValue, setSearchValue] = React.useState('');
    const [activeValue, setActiveValue] = React.useState('');
    const [pageInfo, setPageInfo] = React.useState<SelectPageInfo | null>(null);
    const isOpenRef = React.useRef(open);
    const hasInteracted = React.useRef(false);
    const hasFetchedInitial = React.useRef(false);
    const observerRef = React.useRef<IntersectionObserver | null>(null);

    const isSelected = React.useCallback(
        (optionValue: T) => {
            if (value == null) return false;
            if (typeof value === 'object') return isEqual(value, optionValue);

            return value === optionValue;
        },
        [value],
    );

    const isAsync = typeof options === 'function';

    // Each async load takes a ticket; only the newest may write. Typing issues overlapping searches, and
    // a loader that fans out per-row requests can let an earlier, slower one land last.
    const requestSeqRef = React.useRef(0);

    const fetchOptions = React.useCallback(
        async (query: string, page: number = 0) => {
            if (!isAsync) return;

            const requestId = ++requestSeqRef.current;

            if (page === 0) {
                setLoading(true);
            } else {
                setLoadingMore(true);
            }

            try {
                const result = await options(query, page);

                if (requestId !== requestSeqRef.current) return;

                if ('list' in result) {
                    setInternalOptions((prev) => (page === 0 ? result.list : [...prev, ...result.list]));
                    setPageInfo(result.pageInfo);
                } else {
                    setInternalOptions(result);
                    setPageInfo(null);
                }
            } catch (error) {
                console.error('Error fetching options:', error);
            } finally {
                if (requestId === requestSeqRef.current) {
                    setLoading(false);
                    setLoadingMore(false);
                    // A response that lands after the panel closed must not count as resolved,
                    // or reopening would show `emptyText` over a list it is about to refetch.
                    setHasResolvedOnce(isOpenRef.current);
                }
            }
        },
        [isAsync, options],
    );

    const fetchOptionsRef = React.useRef(fetchOptions);

    React.useEffect(() => {
        fetchOptionsRef.current = fetchOptions;
    });

    // Built once and read through a ref: `options` is often a fresh closure on every
    // parent render, and rebuilding the debounce mid-typing drops the pending search.
    const debouncedFetch = React.useMemo(() => debounce((query: string) => fetchOptionsRef.current(query, 0), 500), []);

    React.useEffect(() => () => debouncedFetch.cancel(), [debouncedFetch]);

    React.useEffect(() => {
        if (Array.isArray(options)) {
            setInternalOptions(options);
            setPageInfo(null);
        } else if (open && isAsync && !hasFetchedInitial.current) {
            hasFetchedInitial.current = true;
            fetchOptions('', 0);
        }
    }, [options, open, isAsync, fetchOptions]);

    React.useEffect(() => {
        isOpenRef.current = open;

        if (!open) {
            debouncedFetch.cancel();
            hasFetchedInitial.current = false;
            setSearchValue('');
            setLoading(false);
            setHasResolvedOnce(false);
            // Reopening refetches from page 0, so the old cursor must not outlive the panel
            // or the sentinel would ask for a page from a result set that is already gone.
            setPageInfo(null);

            return;
        }

        hasInteracted.current = false;
        setActiveValue('');
    }, [open, debouncedFetch]);

    const handleSearch = (search: string) => {
        setSearchValue(search);
        if (!isAsync) return;

        // The request only leaves after the debounce settles; without flipping this now
        // the panel sits on stale rows with nothing saying a new search is coming.
        setLoading(true);
        debouncedFetch(search);
    };

    // Ref holds the latest pagination state so the observer callback is never stale
    const paginationRef = React.useRef({
        isAsync,
        loading,
        loadingMore,
        pageInfo,
        searchValue,
        fetchOptions,
    });

    React.useEffect(() => {
        paginationRef.current = {
            isAsync,
            loading,
            loadingMore,
            pageInfo,
            searchValue,
            fetchOptions,
        };
    });

    const sentinelCallbackRef = React.useCallback((node: HTMLDivElement | null) => {
        observerRef.current?.disconnect();
        observerRef.current = null;

        if (!node) return;

        observerRef.current = new IntersectionObserver(
            ([entry]) => {
                if (!entry.isIntersecting) return;
                tryLoadMore();
            },
            { threshold: 0 },
        );

        observerRef.current.observe(node);
    }, []);

    // Cmdk tracking value for the last loaded option — used to detect "ArrowDown on last item"
    const lastItemTrackingValue = React.useMemo(() => {
        if (!isAsync || internalOptions.length === 0) return null;
        const lastIndex = internalOptions.length - 1;
        const last = internalOptions[lastIndex];
        const isPrimitive = typeof last.value === 'string' || typeof last.value === 'number';

        return isPrimitive ? String(last.value) : `${last.label}-${lastIndex}`;
    }, [isAsync, internalOptions]);

    const tryLoadMore = React.useCallback(() => {
        const {
            isAsync: async,
            loading: ldg,
            loadingMore: ldgMore,
            pageInfo: pi,
            searchValue: sv,
            fetchOptions: fetch,
        } = paginationRef.current;

        if (async && !ldg && !ldgMore && pi && pi.page < pi.total_pages - 1) {
            fetch(sv, pi.page + 1);
        }
    }, []);

    const handleCommandKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        hasInteracted.current = true;

        if (e.key !== 'ArrowDown' || !lastItemTrackingValue) return;

        // activeValue lags one keystroke behind cmdk's internal selection, so we read the DOM directly
        const root = e.currentTarget;
        const selected = root.querySelector<HTMLElement>('[cmdk-item][data-selected="true"]');
        const selectedValue = selected?.getAttribute('data-value');

        if (selectedValue && selectedValue === lastItemTrackingValue) {
            const { isAsync: async, pageInfo: pi } = paginationRef.current;
            const serverHasMore = async && pi && pi.page < pi.total_pages - 1;

            if (serverHasMore) {
                e.preventDefault();
                tryLoadMore();
            }
        }
    };

    const selectedLabel = React.useMemo(() => {
        const found = internalOptions.find((option) => isSelected(option.value))?.label;

        if (found) return found;
        // For async options: show defaultOption label when value is set
        // but options haven't been loaded yet (or value is a different object reference)
        if (defaultOption && value != null) {
            return defaultOption.label;
        }

        return undefined;
    }, [value, internalOptions, defaultOption]);

    // Sheet uses RemoveScroll (shard = panel); portal into it so wheel scroll works on the list.
    // Dialog (.dialog-block) has overflow:auto + CSS translate on it — portaling in causes the
    // popover to extend the scroll container and adds an unwanted scrollbar. Portal to body instead.

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
            // Radix Select primitive adds a data-radix-popper-content-wrapper attribute
            if (target.closest('[data-radix-popper-content-wrapper]')) return;

            setOpen(false);
        };

        // Use capture so it fires before React events
        document.addEventListener('pointerdown', handlePointerDown, { capture: true });

        return () => document.removeEventListener('pointerdown', handlePointerDown, { capture: true });
    }, [open]);

    const isPopoverModal = modal ?? isInsideModal;
    // Covers the frame between opening and the effect that starts the first fetch,
    // where `loading` has not been flipped yet and the option list is still empty.
    const showLoading = loading || (isAsync && open && !hasResolvedOnce);

    return (
        <Popover open={open} onOpenChange={setOpen} modal={isPopoverModal}>
            <PopoverTrigger asChild>
                <Button
                    ref={triggerRef}
                    size="sm"
                    variant={variant}
                    aria-invalid={isErrored ? 'true' : undefined}
                    aria-label={ariaLabel}
                    className={cn(
                        variant !== 'ghost'
                            ? 'rounded-full text-(--text-primary)'
                            : 'rounded-md border border-border-secondary font-normal text-(--text-primary) hover:bg-transparent hover:text-(--text-primary) [&_i]:hover:text-primary',
                        isErrored ? 'border-destructive' : '',
                        `${variant}-select`,
                        className,
                    )}
                    role="combobox"
                    aria-expanded={open}
                    aria-controls={listboxId}
                    disabled={disabled}
                    tabIndex={tabIndex}
                >
                    <span className={cn('truncate text-sm', triggerLabelClassName)}>
                        {selectedLabel ? selectedLabel : placeholder}
                    </span>
                    <ChevronDownIcon
                        className={cn('size-4', triggerChevronColorClass(variant), triggerChevronIconClassName)}
                    />
                </Button>
            </PopoverTrigger>
            {open && (
                <PopoverContent
                    id={listboxId}
                    container={modalPortalContainer}
                    className={cn(
                        'w-(--radix-popover-trigger-width) max-w-(--radix-popover-trigger-width) min-w-[180px] overflow-hidden p-0 data-[state=closed]:animate-none data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-100',
                        popoverClassName,
                    )}
                    align={triggerAlign}
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
                        onKeyDown={handleCommandKeyDown}
                        tabIndex={0}
                        loop
                        className="focus-visible:outline-none"
                    >
                        {allowSearch && (
                            <CommandInput
                                placeholder={searchPlaceholder}
                                value={searchValue}
                                onValueChange={handleSearch}
                            />
                        )}
                        <CommandList
                            aria-busy={showLoading}
                            className="outline-none focus:outline-none focus-visible:outline-none"
                        >
                            {showLoading && <SelectLoading variant={loadingVariant} text={loadingText} />}
                            {!showLoading && <CommandEmpty>{emptyText}</CommandEmpty>}
                            {!showLoading && (
                                <CommandGroup>
                                    {internalOptions.map((option, index) => {
                                        const isPrimitiveValue =
                                            typeof option.value === 'string' || typeof option.value === 'number';
                                        const uniqueTrackingValue = isPrimitiveValue
                                            ? String(option.value)
                                            : `${option.label}-${index}`;

                                        let commandItemKey: string | number;

                                        if (isAsync) {
                                            commandItemKey = uniqueTrackingValue;
                                        } else if (isPrimitiveValue) {
                                            commandItemKey = String(option.value);
                                        } else {
                                            commandItemKey = index;
                                        }

                                        return (
                                            <CommandItem
                                                key={commandItemKey}
                                                value={isAsync ? uniqueTrackingValue : undefined} // Cmdk strictly filters by value text unless we disable it
                                                onSelect={() => {
                                                    const actualValue = option.value;

                                                    setOpen(false);
                                                    if (isSelected(actualValue) && !allowDeselect) return;
                                                    onChange?.(isSelected(actualValue) ? null : actualValue);
                                                }}
                                                className="select-item flex justify-between"
                                            >
                                                <span>{option.label}</span>
                                                <CheckIcon
                                                    className={cn(
                                                        'h-4 w-4 shrink-0 text-primary',
                                                        isSelected(option.value) ? 'opacity-100' : 'opacity-0',
                                                    )}
                                                />
                                            </CommandItem>
                                        );
                                    })}
                                </CommandGroup>
                            )}
                            {loadingMore && <SelectLoadingMore variant={loadingVariant} />}
                            {!showLoading && <div ref={sentinelCallbackRef} className="h-px" />}
                        </CommandList>
                    </Command>
                </PopoverContent>
            )}
        </Popover>
    );
}
