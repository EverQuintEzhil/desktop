import { Skeleton } from '@/components/ui/skeleton';

/** Mirrors a real row's padding and icon size, so the table does not resize when the rows land. */
const RoutinesTableSkeleton = () => (
    <div className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-card">
        {['a', 'b', 'c'].map((key) => (
            <div key={key} className="flex items-center gap-2.5 px-4 py-3">
                <Skeleton className="size-8 rounded-lg" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-20" />
            </div>
        ))}
    </div>
);

export default RoutinesTableSkeleton;
