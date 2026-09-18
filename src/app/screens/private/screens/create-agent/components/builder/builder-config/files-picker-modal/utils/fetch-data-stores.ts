import { adminDataStoresApi, type DataStoreProviderFilter } from '@/lib/api/admin/data-stores';
import type { PagedList } from '@/types/api-types';

import { DATA_STORE_PAGE_SIZE } from '../constants';
import type { DataStoreItem } from '../types';

export const fetchDataStores = async (
    search: string,
    page: number,
    provider: DataStoreProviderFilter,
): Promise<PagedList<DataStoreItem>> => {
    const result = await adminDataStoresApi.list({
        page,
        search: search.trim() || undefined,
        size: DATA_STORE_PAGE_SIZE,
        provider,
    });

    return {
        values: result.values.map((ds) => ({
            _id: ds._id,
            name: ds.name,
            description: ds.description,
            provider: ds.provider,
            creator: ds.creator,
        })),
        pageInfo: result.pageInfo,
    };
};
