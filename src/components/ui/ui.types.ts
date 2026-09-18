import type { SuggestionItem as ISuggestionItem } from '../auto-complete';

export interface SelectSuggestionItem<T = string | number | object | null> extends Omit<ISuggestionItem<T>, 'value'> {
    value?: T;
}
export interface SelectPageInfo {
    page: number;
    total_pages: number;
}

export interface PaginatedSelectData<T = string | number | object | null> {
    list: Array<SelectSuggestionItem<T>>;
    pageInfo: SelectPageInfo;
}

export type NewSuggestionType<T> = {
    enabled?: boolean;
    action: (item: SelectSuggestionItem<T>) => void;
    label?: string;
    maxLength?: number;
    allowChangeWithoutAction?: boolean;
};

export interface SelectProps<T> {
    allowSearch?: boolean;
    data:
        | Array<SelectSuggestionItem<T>>
        | ((query: string) => Promise<Array<SelectSuggestionItem<T>>>)
        | ((query: string, page?: number) => Promise<PaginatedSelectData<T>>);
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
    onSelect: (item: SelectSuggestionItem<T>) => void;
    required?: boolean;
    styles?: string;
    toolTip?: {
        colorValue: string;
        content: string;
        contentType: string;
        contentStyles: string;
    };
    trim?: boolean;
    value: SelectSuggestionItem<T>;
    noneLabel?: string;
    labelPosition?: string;
    useSearchCondition?: boolean;
    popupStyles?: string;
}

export interface RenderOptionsProps<T> {
    activeIndex: number;
    loading: boolean;
    name: string;
    onChangeSearch: (val: string) => void;
    onSelect: (item: SelectSuggestionItem<T>) => void;
    options: Array<SelectSuggestionItem<T>>;
    search?: boolean;
    searchValue?: string;
    visible: boolean;
    newSuggestion?: NewSuggestionType<T>;
    onAddNew: (item: SelectSuggestionItem<T>) => void;
    trim: boolean;
    isExactMatch: boolean;
    selected: SelectSuggestionItem<T>;
    loadMoreRef: React.Ref<HTMLDivElement | null>;
    dataPagination: {
        page: number;
        pages: number;
        showMoreLoading: boolean;
    };
}

// below are types of auto complete component
export interface SuggestionItem<T = string | number | object | null> {
    label: string;
    value: T;
    searchLabel?: string;
    onClick?: () => void;
    key?: string;
}
