import type { SelectSuggestionItem } from '@/components/multi-select';
import { PROVIDER_OPTIONS as DATA_STORE_PROVIDER_OPTIONS } from '@/types/admin';

export const PROVIDER_OPTIONS: SelectSuggestionItem<string>[] = [
    { value: 'db', label: 'All DB Stores' },
    { value: 'blob-storage', label: 'All File Stores' },
    ...DATA_STORE_PROVIDER_OPTIONS,
];
