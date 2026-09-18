import { CircleAlertIcon, SearchXIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';

import BlogBreadcrumb from '@/app/components/blog-breadcrumb';
import BlogByline from '@/app/components/blog-byline';
import CollectionIcon from '@/app/components/collection-icon';
import { useBlogCategoriesQuery } from '@/app/hooks/use-blog-categories-query';
import { InfiniteScrollTrigger, SearchInput } from '@/components';
import { Skeleton } from '@/components/ui/skeleton';
import { useInfiniteScroll } from '@/hooks';
import { KNOWLEDGE_POST_TYPES } from '@/lib/api/app/blogs';

import { BlogArticleRow, BlogSortMenu, BlogsMessage, BlogsSkeleton } from '../components';
import { HELP_CENTER_PATH, BLOG_SORT_ARTICLE_ORDER, COLLECTION_SORT_OPTIONS, resolveSort } from '../constants';
import { useBlogCategoryQuery } from '../hooks/use-blog-category-query';
import { useBlogSearchParams } from '../hooks/use-blog-search-params';
import { useBlogsQuery } from '../hooks/use-blogs-query';

const CollectionDetail = () => {
    const { categoryId } = useParams();
    const { searchParams, patchSearchParams } = useBlogSearchParams();
    const search = searchParams.get('search') ?? '';
    const sort = resolveSort(searchParams.get('sort'), COLLECTION_SORT_OPTIONS, BLOG_SORT_ARTICLE_ORDER);

    const { data: category, isLoading: isCategoryLoading, isError: isCategoryError } = useBlogCategoryQuery(categoryId);
    const { data: categories } = useBlogCategoriesQuery();

    const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useBlogsQuery({
        search,
        categoryId,
        types: KNOWLEDGE_POST_TYPES,
        sortBy: sort,
        enabled: Boolean(categoryId),
    });

    const posts = useMemo(() => data?.pages.flatMap((page) => page.values) ?? [], [data]);
    const totalCount = data?.pages[0]?.pageInfo.totalCount ?? 0;

    // GET /tags/:id returns the tag row raw, with no postCount; only the cached list carries one.
    const listedCategory = categories?.find((entry) => entry._id === categoryId);
    const listedPostCount = listedCategory?.postCount;
    // `data`, not `totalCount`: the header renders as soon as GET /tags/:id lands, and coalescing
    // an in-flight posts query to 0 flashed "0 articles" before the real number arrived.
    const loadedPostCount = data ? totalCount : undefined;
    const collectionCount = listedPostCount ?? (search ? undefined : loadedPostCount);

    const { loadMoreRef } = useInfiniteScroll({
        loading: isLoading,
        showMoreLoading: isFetchingNextPage,
        hasMore: hasNextPage,
        itemsLength: posts.length,
        onLoadMore: fetchNextPage,
    });

    const renderHeader = () => {
        if (isCategoryLoading) {
            return (
                <>
                    <div className="collection-detail-header flex items-center gap-4" aria-busy="true">
                        <Skeleton className="size-14 shrink-0 rounded-2xl bg-border-secondary" />
                        <div className="collection-detail-header-body flex flex-1 flex-col gap-2.5">
                            <Skeleton className="h-7 w-1/3 rounded-sm bg-border-secondary" />
                            <Skeleton className="h-4 w-2/3 rounded-sm bg-border-secondary" />
                        </div>
                    </div>
                    <Skeleton
                        className="collection-detail-byline h-3.5 w-[180px] rounded-sm bg-border-secondary"
                        aria-busy="true"
                    />
                </>
            );
        }

        const countLabel =
            typeof collectionCount === 'number'
                ? `${collectionCount} ${collectionCount === 1 ? 'article' : 'articles'}`
                : undefined;

        return (
            <>
                <div className="collection-detail-header flex items-center gap-4">
                    <CollectionIcon icon={category?.icon} alt={category?.name} size="lg" />
                    <div className="collection-detail-header-body flex min-w-0 flex-col gap-1.5">
                        <h1 className="text-3xl leading-tight font-semibold text-(--text-primary)">
                            {category?.name ?? 'Collection'}
                        </h1>
                        {category?.description ? (
                            <p className="text-h5 leading-relaxed font-medium text-text-secondary">
                                {category.description}
                            </p>
                        ) : null}
                    </div>
                </div>
                <BlogByline
                    layout="inline"
                    meta={countLabel}
                    date={category?.updatedAt}
                    className="collection-detail-byline"
                />
            </>
        );
    };

    const renderSearchSummary = () => {
        if (!search || isLoading || isError) {
            return null;
        }

        return (
            <p className="collection-detail-summary text-sm text-text-secondary">
                {totalCount} {totalCount === 1 ? 'result' : 'results'} for “{search}”
            </p>
        );
    };

    const renderArticles = () => {
        if (isLoading) {
            return <BlogsSkeleton variant="rows" />;
        }

        if (isError) {
            return (
                <BlogsMessage
                    icon={CircleAlertIcon}
                    title="Articles could not be loaded"
                    hint="Check your connection and try again."
                />
            );
        }

        if (posts.length === 0) {
            return (
                <BlogsMessage
                    icon={SearchXIcon}
                    title={search ? 'No articles found' : 'No articles in this collection yet'}
                    hint={search ? 'Try a different search term.' : undefined}
                />
            );
        }

        return (
            <ul className="collection-detail-articles flex flex-col">
                {posts.map((post) => (
                    <BlogArticleRow key={post._id} post={post} />
                ))}
            </ul>
        );
    };

    if (isCategoryError) {
        return (
            <BlogsMessage
                icon={CircleAlertIcon}
                title="Collection could not be loaded"
                hint="It may have been renamed or removed."
            />
        );
    }

    return (
        <div className="blogs-collection-detail mx-auto flex w-full max-w-[820px] flex-col gap-5">
            <BlogBreadcrumb
                items={[{ label: 'All Collections', to: HELP_CENTER_PATH }, { label: category?.name ?? 'Collection' }]}
            />
            {renderHeader()}
            <div className="collection-detail-filters flex flex-wrap items-center gap-2.5">
                <div className="min-w-[200px] flex-1">
                    {/* Remounting on the collection id runs SearchInput's unmount cleanup, which cancels a
                    debounce still holding a term typed here — otherwise it lands on the next collection. */}
                    <SearchInput
                        key={categoryId}
                        search={search}
                        autoFocus={false}
                        searchOnChange
                        onChange={(value) => patchSearchParams({ search: value })}
                        placeholder="Search in this collection..."
                        inputClassName="h-10 rounded-full border-none bg-card pl-9 text-sm shadow-xs"
                    />
                </div>
                <BlogSortMenu
                    value={sort}
                    options={COLLECTION_SORT_OPTIONS}
                    onChange={(value) => patchSearchParams({ sort: value })}
                />
            </div>
            {renderSearchSummary()}
            {renderArticles()}
            <InfiniteScrollTrigger isLoading={isFetchingNextPage} hasMore={hasNextPage} loadMoreRef={loadMoreRef} />
        </div>
    );
};

export default CollectionDetail;
