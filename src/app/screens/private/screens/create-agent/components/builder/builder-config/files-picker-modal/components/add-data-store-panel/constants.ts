import { dataStoreProviderFilter, type DataStoreProviderFilter } from '@/lib/api/admin/data-stores';
import { PROVIDER_OPTIONS } from '@/types/admin';

/** Heading shown in the create panel before a name is typed, per grouping. */
export const CATEGORY_CREATE_TITLES: Record<DataStoreProviderFilter, string> = {
    'blob-storage': 'Create a Files store',
    api: 'Create an API store',
    db: 'Create a DB store',
    weblinks: 'Create a Web Links store',
};

/** Submit button label in the create panel, per grouping. */
export const CATEGORY_CREATE_BUTTON_LABELS: Record<DataStoreProviderFilter, string> = {
    'blob-storage': 'Create Files store',
    api: 'Create API store',
    db: 'Create DB store',
    weblinks: 'Create Web Links store',
};

/** Provider options available in the create panel, restricted to a grouping. */
export const CATEGORY_PROVIDER_OPTIONS: Record<DataStoreProviderFilter, typeof PROVIDER_OPTIONS> = {
    'blob-storage': PROVIDER_OPTIONS.filter((o) => dataStoreProviderFilter(o.value) === 'blob-storage'),
    api: PROVIDER_OPTIONS.filter((o) => dataStoreProviderFilter(o.value) === 'api'),
    db: PROVIDER_OPTIONS.filter((o) => dataStoreProviderFilter(o.value) === 'db'),
    weblinks: PROVIDER_OPTIONS.filter((o) => dataStoreProviderFilter(o.value) === 'weblinks'),
};

export const PROVIDER_LABELS: Record<string, string> = Object.fromEntries(
    PROVIDER_OPTIONS.map((o) => [o.value, o.label]),
);
