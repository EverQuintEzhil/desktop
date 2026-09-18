import { type AutoCompleteAsyncData, type SuggestionItem as ISuggestionItem } from '@/components/auto-complete';
import { type TagProps } from '@/components/ui/tag';

export interface TagSuggestionItem<T = string | number | object | null> extends ISuggestionItem<T> {
    removable?: boolean;
}

export type DefaultTagChangeHandler<T = string | number | object | null> = (
    item: TagSuggestionItem<T> | undefined,
    selected?: boolean,
) => void;

export interface TagsInputProps<T = string | number | object | null> {
    addNewlabel?: string;
    data?: TagSuggestionItem<T>[] | AutoCompleteAsyncData<T>;
    disabled?: boolean;
    newSuggestion?: {
        allowChangeWithoutAction?: boolean;
        label?: string;
        enabled?: boolean;
        action: (item: TagSuggestionItem<T>) => void;
        maxLength?: number;
    };
    styles?: string;
    value?: TagSuggestionItem<T>[];
    onChange?: (value: TagSuggestionItem<T>[]) => void;
    onRemove?: (item: TagSuggestionItem<T>, index: number) => void;
    reverse?: boolean;
    tagProps?: TagProps;
    isError?: boolean;
    /** When true, selections are staged until confirmed (footer / clear-all). When false, tags apply immediately like before. */
    isMultiSelect?: boolean;
    /** Optional value from the selected tags that should be treated as the default item. */
    defaultItemValue?: T | T[];
    /** When present, selected tags become selectable so one of them can be chosen as the default item. */
    onDefaultItemChange?: DefaultTagChangeHandler<T>;
    /** Shows a filled star on the selected default item. */
    showDefaultItemStar?: boolean;
    /** Replaces the selected default item's star with a loading indicator. */
    defaultItemLoading?: boolean;
    size?: 'small' | 'regular' | 'large';
}

export interface RenderTagsProps<T = string | number | object | null> {
    tags?: TagSuggestionItem<T>[];
    removable?: boolean;
    onRemove: (index: number) => void;
    tagProps?: TagProps<T>;
    size?: 'small' | 'regular' | 'large';
    defaultItemValue?: T | T[];
    onDefaultItemChange?: DefaultTagChangeHandler<T>;
    showDefaultItemStar?: boolean;
    defaultItemLoading?: boolean;
}

export interface AddTagProps {
    addNewlabel: string;
    data: TagSuggestionItem[] | AutoCompleteAsyncData<string | number | object | null>;
    disabled?: boolean;
    newSuggestion?: {
        allowChangeWithoutAction?: boolean;
        label?: string;
        enabled?: boolean;
        action: (item: TagSuggestionItem) => void;
        maxLength?: number;
    };
    /** Appends multiple tags in a single update (required for staged multi-select commit). */
    onNewTags: (tags: TagSuggestionItem[]) => void;
    selected: TagSuggestionItem[];
    onBlur?: () => void;
    isMultiSelect?: boolean;
    size?: 'small' | 'regular' | 'large';
    onKeyDown?: (e: KeyboardEvent) => void;
}
