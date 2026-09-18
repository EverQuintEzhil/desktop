import { CircleAlertIcon, FrownIcon, SearchXIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

import { InfiniteScrollTrigger, SearchInput } from '@/components';
import { Button } from '@/components/ui/button';
import { useInfiniteScroll } from '@/hooks';
import { ANNOUNCEMENT_POST_TYPES } from '@/lib/api/app/blogs';

import { BlogPostCard, BlogSortMenu, BlogsMessage, BlogsSkeleton } from '../components';
import { BLOG_SORT_NEWEST, FEED_SORT_OPTIONS, resolveSort } from '../constants';
import { useBlogSearchParams } from '../hooks/use-blog-search-params';
import { useBlogsQuery } from '../hooks/use-blogs-query';

const FEED_MESSAGE_CLASS = 'rounded-3xl bg-card';

const AllPosts = () => {
    const { searchParams, patchSearchParams } = useBlogSearchParams();
    const [clearToken, setClearToken] = useState(0);
    const search = searchParams.get('search') ?? '';
    const sort = resolveSort(searchParams.get('sort'), FEED_SORT_OPTIONS, BLOG_SORT_NEWEST);

    const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useBlogsQuery({
        search,
        types: ANNOUNCEMENT_POST_TYPES,
        sortBy: sort,
    });

    const posts = useMemo(() => data?.pages.flatMap((page) => page.values) ?? [], [data]);
    const totalCount = data?.pages[0]?.pageInfo.totalCount ?? 0;
    const isFiltered = search !== '';

    // Remounting SearchInput runs its unmount cleanup, which cancels a debounce still holding the
    // term the reader just cleared — otherwise it lands 750ms later and refills the empty box.
    const handleClearAll = () => {
        setClearToken((token) => token + 1);
        patchSearchParams({ search: null });
    };

    const { loadMoreRef } = useInfiniteScroll({
        loading: isLoading,
        showMoreLoading: isFetchingNextPage,
        hasMore: hasNextPage,
        itemsLength: posts.length,
        onLoadMore: fetchNextPage,
    });

    const renderFilters = () => (
        <div className="blogs-feed-filters flex flex-wrap items-center gap-2.5">
            <div className="min-w-[240px] flex-1">
                <SearchInput
                    key={clearToken}
                    search={search}
                    autoFocus={false}
                    searchOnChange
                    onChange={(value) => patchSearchParams({ search: value })}
                    placeholder="Search blog posts..."
                    inputClassName="h-10 rounded-full border-none bg-card pl-9 text-sm shadow-xs"
                />
            </div>
            <BlogSortMenu
                value={sort}
                options={FEED_SORT_OPTIONS}
                onChange={(value) => patchSearchParams({ sort: value })}
            />
            {isFiltered ? (
                <Button variant="ghost" size="sm" className="rounded-full" onClick={handleClearAll}>
                    Clear
                </Button>
            ) : null}
        </div>
    );

    const renderSummary = () => {
        if (isLoading || isError) {
            return null;
        }

        const noun = totalCount === 1 ? 'post' : 'posts';

        return (
            <p className="blogs-feed-summary text-sm text-text-secondary">
                {isFiltered ? `${totalCount} matching ${noun}` : `${totalCount} ${noun}`}
            </p>
        );
    };

    const renderPosts = () => {
        if (isLoading) {
            return <BlogsSkeleton variant="feed" />;
        }

        if (isError) {
            return (
                <BlogsMessage
                    className={FEED_MESSAGE_CLASS}
                    icon={CircleAlertIcon}
                    title="Posts could not be loaded"
                    hint="Check your connection and try again."
                />
            );
        }

        if (posts.length === 0) {
            if (isFiltered) {
                return (
                    <BlogsMessage
                        className={FEED_MESSAGE_CLASS}
                        icon={SearchXIcon}
                        title="No posts found"
                        hint="Try a different search term."
                    />
                );
            }

            return <BlogsMessage className={FEED_MESSAGE_CLASS} icon={FrownIcon} title="No blogs found?" />;
        }

        return (
            <ul className="article-list article-list-items flex flex-col gap-5">
                {posts.map((post) => (
                    <BlogPostCard key={post._id} post={post} />
                ))}
            </ul>
        );
    };

    return (
        <div className="blogs-feed mx-auto flex w-full max-w-[820px] flex-col gap-5">
            {renderFilters()}
            {renderSummary()}
            <div className="blogs-feed-list flex flex-col">
                {renderPosts()}
                <InfiniteScrollTrigger isLoading={isFetchingNextPage} hasMore={hasNextPage} loadMoreRef={loadMoreRef} />
            </div>
        </div>
    );
};

export default AllPosts;
