import { Skeleton } from '@/components/ui/skeleton';

export type BlogsSkeletonVariant = 'feed' | 'grid' | 'rows';

export interface BlogsSkeletonProps {
    variant: BlogsSkeletonVariant;
    count?: number;
    label?: string;
}

const DEFAULT_COUNT: Record<BlogsSkeletonVariant, number> = {
    feed: 3,
    grid: 6,
    rows: 4,
};

const BlogsSkeleton = (props: BlogsSkeletonProps) => {
    const { variant, count, label } = props;
    const keys = Array.from({ length: count ?? DEFAULT_COUNT[variant] }, (_, index) => `${variant}-${index}`);

    const renderFeedCard = (key: string) => (
        <li
            key={key}
            className="blog-post-card blog-post-card-skeleton flex flex-col gap-3 overflow-hidden rounded-3xl px-7 pt-7 pb-5"
        >
            <div className="flex items-center gap-2.5">
                <Skeleton className="h-5 w-[110px] rounded-full" />
                <Skeleton className="h-3.5 w-[80px] rounded-sm" />
            </div>
            <Skeleton className="h-5 w-2/3 rounded-sm" />
            <Skeleton className="h-4 w-full rounded-sm" />
            <Skeleton className="h-4 w-4/5 rounded-sm" />
            <div className="flex items-center gap-2 pt-1">
                <Skeleton className="size-6 rounded-full" />
                <Skeleton className="h-3.5 w-[110px] rounded-sm" />
            </div>
        </li>
    );

    const renderGridCard = (key: string) => (
        <li key={key} className="collection-card-item flex">
            <div className="collection-card flex w-full flex-col gap-4 rounded-3xl bg-card px-6 pt-7 pb-5">
                <Skeleton className="size-14 rounded-2xl" />
                <Skeleton className="h-4 w-2/3 rounded-sm" />
                <Skeleton className="h-3 w-full rounded-sm" />
                <Skeleton className="h-3 w-4/5 rounded-sm" />
                <Skeleton className="mt-2 h-3 w-20 rounded-sm" />
            </div>
        </li>
    );

    const renderRow = (key: string) => (
        <li key={key} className="blog-article-row px-5">
            <div className="flex items-center gap-5 border-b border-border-secondary py-5">
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <Skeleton className="h-4 w-1/3 rounded-sm bg-border-secondary" />
                    <Skeleton className="h-3 w-2/3 rounded-sm bg-border-secondary" />
                </div>
                <Skeleton className="size-5 shrink-0 rounded-sm bg-border-secondary" />
            </div>
        </li>
    );

    if (variant === 'grid') {
        return (
            <ul
                aria-busy="true"
                aria-label={label ?? 'Loading collections'}
                className="collections-grid mx-auto grid w-full max-w-[820px] grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-6"
            >
                {keys.map(renderGridCard)}
            </ul>
        );
    }

    if (variant === 'rows') {
        return (
            <ul
                aria-busy="true"
                aria-label={label ?? 'Loading articles'}
                className="collection-detail-articles flex flex-col"
            >
                {keys.map(renderRow)}
            </ul>
        );
    }

    return (
        <ul
            aria-busy="true"
            aria-label={label ?? 'Loading posts'}
            className="article-list article-list-skeleton flex flex-col gap-5"
        >
            {keys.map(renderFeedCard)}
        </ul>
    );
};

export default BlogsSkeleton;
