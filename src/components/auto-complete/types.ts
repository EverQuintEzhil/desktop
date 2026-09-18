import type { InputProps } from '@/components/ui/input';
import type { PaginatedSelectData } from '@/components/ui/select';

export interface SuggestionItem<T = string | number | object | null> {
    label: string;
    value: T;
    searchLabel?: string;
    onClick?: () => void;
    key?: string;
}

export type AutoCompleteAsyncData<T> =
    | ((query: string) => Promise<SuggestionItem<T>[]>)
    | ((query: string, page?: number) => Promise<SuggestionItem<T>[] | PaginatedSelectData<T>>);

export interface AutoCompleteNewSuggestion<T> {
    allowChangeWithoutAction?: boolean;
    label?: string;
    enabled?: boolean;
    action: (item: SuggestionItem<T>) => void;
    maxLength?: number;
}

export interface AutoCompleteStagingFooterActions {
    onConfirm: () => void;
    onCancel: () => void;
    /** Clears staged selections only; keeps the dropdown open. Used by "Clear All". */
    onClearStaging?: () => void;
}

export interface AutoCompleteProps<T = string | number | object | null> extends Omit<
    InputProps,
    'onSelect' | 'value' | 'onEnter' | 'onKeyDown'
> {
    data?: SuggestionItem<T>[] | AutoCompleteAsyncData<T>;
    value: SuggestionItem<T>;
    trim?: boolean;
    onSelect?: (item: SuggestionItem<T>) => void;
    labelPosition?: 'overlay';
    isError?: boolean;
    newSuggestion?: AutoCompleteNewSuggestion<T>;
    selected?: SuggestionItem<T>[];
    /** When false, the dropdown stays open after picking an option and the query is cleared so more tags can be added. */
    closeOnSelect?: boolean;
    /**
     * When true, picks only notify via onSelect / newSuggestion.action (no query clear, dropdown stays open).
     * Use with `pendingSelected` to show staged rows with highlight and a check icon.
     */
    staging?: boolean;
    pendingSelected?: SuggestionItem<T>[];
    /** Shown below the list when `staging` is true: cancel discards staged picks; confirm applies them (parent closes input). */
    stagingFooterActions?: AutoCompleteStagingFooterActions;
    onEnter?: (e: KeyboardEvent) => void;
    onKeyDown?: (e: KeyboardEvent) => void;
}
