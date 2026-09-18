import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface Props {
    rows?: number;
    className?: string;
}

const DEFAULT_ROWS = 4;

/** Placeholder rows for a card-wrapped file list, shaped like the real thumb + name + meta row. */
const FileRowsSkeleton = ({ rows = DEFAULT_ROWS, className }: Props) => (
    <ul
        className={cn(
            'file-rows-skeleton flex flex-col overflow-hidden rounded-2xl border border-border-secondary bg-card',
            className,
        )}
    >
        {Array.from({ length: rows }).map((_, index) => (
            <li
                key={index}
                className="flex items-center gap-3 border-t border-border-secondary px-4 py-3 first:border-t-0"
            >
                <Skeleton className="size-9 shrink-0 rounded-xl" />
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <Skeleton className="h-3 w-2/3" />
                    <Skeleton className="h-2.5 w-1/3" />
                </span>
            </li>
        ))}
    </ul>
);

export default FileRowsSkeleton;
