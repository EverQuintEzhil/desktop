import type { QueryClient } from '@tanstack/react-query';
import type { SortingState } from '@tanstack/react-table';

export const DATA_STORES_QUERY_KEY = ['admin', 'dataStores'] as const;
export const DATA_STORES_LIST_QUERY_KEY = [...DATA_STORES_QUERY_KEY, 'list'] as const;

export interface DataStoresQueryParams {
    pageIndex: number;
    pageSize: number;
    search: string;
    sort: SortingState;
    provider?: string;
}

/** Refetches the datastores list and/or the single GET /datastores/:id cache — never prefix-invalidates wizard sub-queries (that caused refetch storms). */
export function invalidateDataStoresQueries(queryClient: QueryClient, dataStoreId?: string) {
    void queryClient.invalidateQueries({ queryKey: DATA_STORES_LIST_QUERY_KEY });
    if (dataStoreId) {
        void queryClient.invalidateQueries({
            queryKey: [...DATA_STORES_QUERY_KEY, 'detail', dataStoreId],
            exact: true,
        });
    }
}
