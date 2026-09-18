import { DataStoreFilesSkeleton } from '@/admin/screens/private/screens/admin/components/data-stores/components/data-stores-detail/components/data-stores-files/data-store-files-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

export const DataStoreEditSkeleton = () => (
    <>
        <div className="secondary-header flex shrink-0 flex-col border-b border-border-secondary bg-card">
            <div className="metabar flex flex-wrap items-center gap-x-3 gap-y-1">
                <Skeleton className="h-3.5 w-24 max-w-[40vw] rounded-sm" />
                <span className="meta-details-dot inline-block h-1 w-1 shrink-0 rounded-full bg-gray-300" />
                <Skeleton className="h-3.5 w-10 rounded-sm" />
                <span className="meta-details-dot inline-block h-1 w-1 shrink-0 rounded-full bg-gray-300" />
                <Skeleton className="h-3.5 w-36 max-w-[40vw] rounded-sm" />
                <span className="meta-details-dot inline-block h-1 w-1 shrink-0 rounded-full bg-gray-300" />
                <Skeleton className="h-3.5 w-28 max-w-[30vw] rounded-sm" />
            </div>
        </div>
        <main
            className="tab-content-area data-store-edit-skeleton scrollbar-controller scrollbar-vertical flex min-h-0 flex-1 flex-col bg-card"
            aria-busy="true"
            aria-label="Loading data store"
        >
            <div className="data-store-files-container flex flex-1 flex-col bg-card pb-8">
                <DataStoreFilesSkeleton />
            </div>
        </main>
    </>
);
