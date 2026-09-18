import { Skeleton } from '@/components/ui/skeleton';

const ListSkeleton = () => (
    <ul className="flex flex-col overflow-hidden rounded-2xl border border-border-secondary bg-card">
        {Array.from({ length: 5 }).map((_, index) => (
            <li
                key={index}
                className="flex items-center gap-3 border-t border-border-secondary px-4 py-3 first:border-t-0"
            >
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <Skeleton className="h-3.5 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                </div>
                <Skeleton className="size-8 shrink-0 rounded-full" />
            </li>
        ))}
    </ul>
);

export default ListSkeleton;
