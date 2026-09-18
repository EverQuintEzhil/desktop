import { Skeleton } from '@/components/ui/skeleton';

const FILE_ROW_KEYS = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8'];

interface DataStoreFilesSkeletonProps {
    canUserEdit?: boolean;
    showAddFileZone?: boolean;
}

const DataStoreFilesListSkeleton = ({ canUserEdit = true }: { canUserEdit?: boolean }) => (
    <div className="data-store-files-uploaded flex flex-col gap-3">
        <div className="data-store-files-uploaded-header flex items-center justify-between gap-3 pl-4">
            <div className="data-store-files-uploaded-header-checkbox flex items-center gap-4">
                {canUserEdit ? <Skeleton className="size-4 shrink-0 rounded-sm" /> : null}
                <Skeleton className="h-3.5 w-28 rounded-sm" />
            </div>
        </div>

        <ul className="data-store-files-uploaded-list flex flex-col overflow-hidden rounded-2xl border border-border-secondary bg-card">
            {FILE_ROW_KEYS.map((key) => (
                <li
                    key={key}
                    className="group flex items-center gap-3 border-t border-border-secondary px-4 py-3 first:border-t-0"
                >
                    {canUserEdit ? <Skeleton className="size-4 shrink-0 rounded-sm" /> : null}
                    <Skeleton className="size-10 shrink-0 rounded-xl" />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <Skeleton className="h-3.5 w-[58%] max-w-xs rounded-sm" />
                        <Skeleton className="h-3 w-[38%] max-w-[200px] rounded-sm" />
                    </span>
                    <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
                    <Skeleton className="size-8 shrink-0 rounded-md" />
                </li>
            ))}
        </ul>
    </div>
);

const DataStoreFilesAddZoneSkeleton = () => (
    <div className="flex h-auto w-full items-center gap-3 rounded-2xl border border-dashed border-border-secondary bg-card px-4 py-4">
        <Skeleton className="size-10 shrink-0 rounded-full" />
        <span className="flex min-w-0 flex-col gap-1">
            <Skeleton className="h-3.5 w-16 rounded-sm" />
            <Skeleton className="h-3 w-44 max-w-full rounded-sm" />
        </span>
    </div>
);

export const DataStoreFilesSkeleton = ({ canUserEdit = true, showAddFileZone = true }: DataStoreFilesSkeletonProps) => (
    <div className="relative flex min-h-[60svh] w-full flex-col gap-4 p-4" aria-busy="true" aria-label="Loading files">
        {showAddFileZone ? <DataStoreFilesAddZoneSkeleton /> : null}
        <DataStoreFilesListSkeleton canUserEdit={canUserEdit} />
    </div>
);

export const DataStoreFilesListSkeletonOnly = DataStoreFilesListSkeleton;
