import { CircleAlertIcon } from 'lucide-react';
import { useMemo } from 'react';

import { useBlogCategoriesGridQuery } from '@/app/hooks/use-blog-categories-query';
import { InfiniteScrollTrigger, SearchInput } from '@/components';
import { useInfiniteScroll } from '@/hooks';
import { cn } from '@/lib/utils';

import { BlogsMessage, BlogsSkeleton, BlogSortMenu, CollectionCard } from '../components';
import { CATEGORY_SORT_DEFAULT, CATEGORY_SORT_OPTIONS, resolveSort } from '../constants';
import { useBlogSearchParams } from '../hooks/use-blog-search-params';

const COLLECTIONS_WIDTH_CLASS = 'mx-auto w-full max-w-[820px]';

const Collections = () => {
    const { searchParams, patchSearchParams } = useBlogSearchParams();
    const search = searchParams.get('search') ?? '';
    const query = search.trim();
    const sort = resolveSort(searchParams.get('sort'), CATEGORY_SORT_OPTIONS, CATEGORY_SORT_DEFAULT);

    const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useBlogCategoriesGridQuery(
        query,
        sort,
    );

    const categories = useMemo(() => data?.pages.flatMap((page) => page.values) ?? [], [data]);
    const totalCount = data?.pages[0]?.pageInfo.totalCount ?? 0;

    const { loadMoreRef } = useInfiniteScroll({
        loading: isLoading,
        showMoreLoading: isFetchingNextPage,
        hasMore: hasNextPage,
        itemsLength: categories.length,
        onLoadMore: fetchNextPage,
    });

    const renderGrid = () => {
        if (isLoading) {
            return <BlogsSkeleton variant="grid" />;
        }

        if (isError) {
            return (
                <BlogsMessage
                    className={cn(COLLECTIONS_WIDTH_CLASS, 'rounded-3xl bg-card')}
                    icon={CircleAlertIcon}
                    title="Collections could not be loaded"
                    hint="Check your connection and try again."
                />
            );
        }

        if (categories.length === 0) {
            return (
                <BlogsMessage
                    className={cn(COLLECTIONS_WIDTH_CLASS, 'rounded-3xl bg-card')}
                    title={query ? 'No collections found' : 'No collections yet'}
                    hint={
                        query
                            ? 'Try a different word from the collection name.'
                            : 'Categories appear here once articles are filed into them.'
                    }
                />
            );
        }

        return (
            <ul
                className={cn(
                    'collections-grid grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-6',
                    COLLECTIONS_WIDTH_CLASS,
                )}
            >
                {categories.map((category) => (
                    <CollectionCard key={category._id} category={category} />
                ))}
            </ul>
        );
    };

    // The rail and the header already say where the reader is, so the only caption worth the
    // space is how many collections a search matched.
    const renderCount = () => {
        if (!query || isLoading || isError || categories.length === 0) {
            return null;
        }

        const noun = totalCount === 1 ? 'collection' : 'collections';

        return (
            <p className={cn('collections-count text-sm text-text-secondary', COLLECTIONS_WIDTH_CLASS)}>
                {`${totalCount} ${noun} found`}
            </p>
        );
    };

    return (
        <div className="blogs-collections flex flex-col gap-7">
            <div className="blogs-collections-search flex justify-center">
                <div className="collections-filters flex w-full max-w-[820px] flex-wrap items-center gap-2.5">
                    <div className="min-w-[200px] flex-1">
                        <SearchInput
                            search={search}
                            autoFocus={false}
                            searchOnChange
                            debounceWait={300}
                            onChange={(value) => patchSearchParams({ search: value })}
                            placeholder="Search collections..."
                            inputClassName="h-12 rounded-full border-none bg-card pl-9 text-sm shadow-xs"
                        />
                    </div>
                    <BlogSortMenu
                        value={sort}
                        options={CATEGORY_SORT_OPTIONS}
                        onChange={(value) => patchSearchParams({ sort: value })}
                    />
                </div>
            </div>
            <section className="collections-section flex flex-col gap-5" aria-labelledby="collections-heading">
                <h1 id="collections-heading" className="sr-only">
                    Collections
                </h1>
                {renderCount()}
                {renderGrid()}
                <InfiniteScrollTrigger isLoading={isFetchingNextPage} hasMore={hasNextPage} loadMoreRef={loadMoreRef} />
            </section>
        </div>
    );
};

export default Collections;
