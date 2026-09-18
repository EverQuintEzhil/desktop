import { CheckIcon } from 'lucide-react';

import { CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import type { SelectPageInfo } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import type { SuggestionItem } from '../types';

const LOADING_SKELETON_ROW_KEYS = ['a', 'b', 'c'] as const;

export interface SuggestionsListProps<T> {
    loading: boolean;
    loadingMore: boolean;
    list: SuggestionItem<T>[];
    value: string;
    staging: boolean;
    isAsync: boolean;
    addNew?: boolean;
    newSuggestionLabel: string;
    showAddNew: boolean;
    pageInfo: SelectPageInfo | null;
    isPendingItem: (item: SuggestionItem<T>) => boolean;
    selectSuggestion: (item: SuggestionItem<T>) => void;
    addNewTag: (item: SuggestionItem<T>) => void;
    sentinelCallbackRef: (node: HTMLDivElement | null) => void;
}

const SuggestionsList = <T,>({
    loading,
    loadingMore,
    list,
    value,
    staging,
    isAsync,
    addNew,
    newSuggestionLabel,
    showAddNew,
    pageInfo,
    isPendingItem,
    selectSuggestion,
    addNewTag,
    sentinelCallbackRef,
}: SuggestionsListProps<T>) => {
    const showInitialLoading = loading && list.length === 0;

    const renderLoadingDropdown = () => (
        <div
            className="auto-complete-loading flex flex-col gap-3 py-2"
            role="status"
            aria-live="polite"
            aria-busy="true"
        >
            <div className="flex flex-col gap-3">
                {LOADING_SKELETON_ROW_KEYS.map((key) => (
                    <Skeleton key={key} className="h-5 w-full rounded-lg" />
                ))}
            </div>
        </div>
    );

    if (showInitialLoading) {
        return renderLoadingDropdown();
    }

    const addNewAsItem = { value: value as T, label: value } as SuggestionItem<T>;
    const addNewRowPending = staging && isPendingItem(addNewAsItem);

    return (
        <>
            {showAddNew && (
                <CommandItem
                    className={cn('w-full max-w-full min-w-0 items-start', addNewRowPending && 'bg-background')}
                    onSelect={() => addNewTag({ value, label: value } as SuggestionItem<T>)}
                >
                    <span
                        className={cn(
                            'block w-full min-w-0 flex-1 text-left text-sm leading-snug wrap-break-word whitespace-normal',
                            addNewRowPending && 'text-primary',
                        )}
                    >
                        {newSuggestionLabel || `+ Add New "${value}"`}
                    </span>
                    {addNewRowPending ? (
                        <CheckIcon aria-hidden className="ml-auto size-4 shrink-0 self-start text-primary" />
                    ) : null}
                </CommandItem>
            )}
            <CommandGroup className="min-w-0">
                {list.map((item, index) => {
                    const isPrimitiveValue = typeof item.value === 'string' || typeof item.value === 'number';
                    const uniqueTrackingValue = isPrimitiveValue ? String(item.value) : `${item.label}-${index}`;

                    return (
                        <CommandItem
                            key={item.key || String(index)}
                            value={isAsync ? uniqueTrackingValue : undefined}
                            className={cn(
                                'w-full max-w-full min-w-0 items-start',
                                staging && isPendingItem(item) && 'bg-background',
                            )}
                            onSelect={() => {
                                if (item.onClick) {
                                    item.onClick();
                                } else {
                                    selectSuggestion({ label: item.label, value: item.value });
                                }
                            }}
                        >
                            <span
                                className={cn(
                                    'block w-full min-w-0 flex-1 text-left text-sm leading-snug wrap-break-word whitespace-normal',
                                    staging && isPendingItem(item) && 'text-primary',
                                )}
                            >
                                {item.label}
                            </span>
                            {staging && isPendingItem(item) && (
                                <CheckIcon aria-hidden className="ml-auto size-4 shrink-0 self-start text-primary" />
                            )}
                        </CommandItem>
                    );
                })}
            </CommandGroup>
            {!addNew && list.length === 0 && !loadingMore && <CommandEmpty>No Results Found</CommandEmpty>}
            {loadingMore && (
                <CommandGroup className="min-w-0">
                    {LOADING_SKELETON_ROW_KEYS.map((key) => (
                        <CommandItem key={`loading-more-${key}`} disabled className="flex list-item p-2">
                            <Skeleton className="h-6 w-full rounded-lg" />
                        </CommandItem>
                    ))}
                </CommandGroup>
            )}
            {isAsync && pageInfo !== null && pageInfo.page < pageInfo.total_pages - 1 ? (
                <div ref={sentinelCallbackRef} className="h-px" aria-hidden />
            ) : null}
        </>
    );
};

export default SuggestionsList;
