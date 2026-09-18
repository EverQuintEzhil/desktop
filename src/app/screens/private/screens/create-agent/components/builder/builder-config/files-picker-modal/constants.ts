import type { DataStoreProviderFilter } from '@/lib/api/admin/data-stores';

export const DATA_STORE_PAGE_SIZE = 50;

export const SEARCH_DEBOUNCE_MS = 300;

/** Plural section/heading labels for each provider grouping. */
export const CATEGORY_LABELS: Record<DataStoreProviderFilter, string> = {
    'blob-storage': 'Files Stores',
    api: 'API Stores',
    db: 'DB Stores',
    weblinks: 'Web Links Stores',
};

/** Singular label used in the sidebar "add" action for each grouping. */
export const CATEGORY_ADD_LABELS: Record<DataStoreProviderFilter, string> = {
    'blob-storage': 'Files store',
    api: 'API store',
    db: 'DB store',
    weblinks: 'Web Links store',
};

export const DS_COLOR_PALETTE = [
    '#4285F4',
    '#0F9D58',
    '#EA4335',
    '#4A154B',
    '#24292e',
    '#6264A7',
    '#0078D4',
    '#7048ff',
];

export const rowBase =
    'flex items-center gap-3 min-h-[54px] px-3 py-[10px] rounded-2xl' +
    ' bg-transparent border border-transparent cursor-pointer text-h6' +
    ' text-left w-full text-(--text-primary) transition-[background,border-color,color] duration-140' +
    ' hover:bg-[color-mix(in_srgb,var(--primary)_6%,var(--surface))]' +
    ' hover:border-[color-mix(in_srgb,var(--primary)_14%,var(--border))]' +
    ' disabled:opacity-50 disabled:cursor-not-allowed';

export const rowActive =
    'bg-[color-mix(in_srgb,var(--primary)_10%,var(--surface))]' +
    ' border-[color-mix(in_srgb,var(--primary)_24%,var(--border))] text-primary';

export const dsBtnCls =
    'rounded-xl text-text-secondary hover:text-primary hover:bg-[color-mix(in_srgb,var(--primary)_7%,var(--surface))]';
