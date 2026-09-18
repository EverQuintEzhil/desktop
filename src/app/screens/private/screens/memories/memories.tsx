import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useInfiniteScroll } from '@/hooks';
import { MEMORIES_LIST_QUERY_KEY } from '@/lib/api/admin/memories';
import { cn } from '@/lib/utils';

import { useMemoriesCatalogQuery } from './hooks/use-memories-queries';
import MemoriesListPane, { type MemoryGroup, type MemoryListItem } from './memories-list-pane';
import MemoryDetailPane from './memory-detail-pane';

const Memories = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { memoryId } = useParams<{ memoryId: string }>();
    const [search, setSearch] = useState('');

    const {
        data,
        isLoading: isCatalogLoading,
        isError: isCatalogError,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useMemoriesCatalogQuery(search);

    const memories = useMemo(() => data?.pages.flatMap((p) => p.values) ?? [], [data]);

    const groups = useMemo<MemoryGroup[]>(() => {
        const items: MemoryListItem[] = memories.map((memory) => ({
            memory,
            status: memory.globalEnabled === false ? 'disabled' : 'enabled',
        }));

        return items.length > 0 ? [{ label: '', items }] : [];
    }, [memories]);

    const { loadMoreRef } = useInfiniteScroll({
        loading: isCatalogLoading,
        showMoreLoading: isFetchingNextPage,
        hasMore: hasNextPage,
        itemsLength: memories.length,
        onLoadMore: fetchNextPage,
    });

    const onSelect = (id: string) => navigate(`/settings/memories/${id}`);
    const onRetryList = async () => {
        await Promise.all([
            queryClient.refetchQueries({ queryKey: ['memories', 'catalog', search] }),
            queryClient.refetchQueries({ queryKey: MEMORIES_LIST_QUERY_KEY }),
        ]);
    };

    return (
        <div className="flex flex-col bg-muted/30 lg:-mx-8 lg:-my-6 lg:h-svh lg:min-h-0 lg:flex-row lg:overflow-hidden">
            <MemoriesListPane
                groups={groups}
                selectedId={memoryId}
                onSelect={onSelect}
                search={search}
                onSearchChange={setSearch}
                isLoading={isCatalogLoading}
                isError={isCatalogError}
                loadMoreRef={loadMoreRef}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                onRetry={onRetryList}
                className={cn('w-full lg:w-80 lg:shrink-0', memoryId && 'hidden lg:flex')}
            />
            <MemoryDetailPane
                memoryId={memoryId}
                className={cn('w-full min-w-0 flex-1', !memoryId && 'hidden lg:flex')}
            />
        </div>
    );
};

export default Memories;
