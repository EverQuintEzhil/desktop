import { dataStoreProviderFilter, type DataStoreProviderFilter } from '@/lib/api/admin/data-stores';

import type { NamedItem } from '../types';

export const groupFilesByCategory = (files: NamedItem[] | undefined): Record<DataStoreProviderFilter, NamedItem[]> => {
    const filesByCategory: Record<DataStoreProviderFilter, NamedItem[]> = {
        'blob-storage': [],
        api: [],
        db: [],
        weblinks: [],
    };

    for (const file of files ?? []) {
        filesByCategory[dataStoreProviderFilter(file.provider)].push(file);
    }

    return filesByCategory;
};
