import { useInfiniteQuery } from '@tanstack/react-query';

import type { DataStoreProviderFilter } from '@/lib/api/admin/data-stores';

import { fetchDataStores } from '../utils/fetch-data-stores';

export const useDataStoresQuery = (search: string, open: boolean, provider: DataStoreProviderFilter) =>
    useInfiniteQuery({
        queryKey: ['create-agent', 'datastores', { search, provider }],
        queryFn: ({ pageParam }) => fetchDataStores(search, pageParam, provider),
        enabled: open,
        initialPageParam: 0,
        placeholderData: (previousData, previousQuery) => {
            const prevProvider = (previousQuery?.queryKey?.[2] as { provider?: DataStoreProviderFilter } | undefined)
                ?.provider;

            return prevProvider === provider ? previousData : undefined;
        },
        getNextPageParam: (lastPage) => {
            const { page, totalPages } = lastPage.pageInfo;

            return totalPages - page > 1 ? page + 1 : undefined;
        },
    });
