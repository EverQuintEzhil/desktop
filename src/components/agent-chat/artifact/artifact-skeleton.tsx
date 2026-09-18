import { Skeleton } from '@/components/ui/skeleton';

const LINE_WIDTHS = ['w-2/5', 'w-full', 'w-4/5', 'w-full', 'w-3/5', 'w-11/12', 'w-2/3'];

export const ArtifactSkeleton = () => (
    <div
        data-slot="artifact-skeleton"
        className="artifact-skeleton flex min-h-0 flex-1 flex-col gap-3 rounded-xl border border-border p-4"
        aria-busy="true"
        aria-label="Loading artifact"
    >
        <Skeleton className="h-5 w-1/3" />
        {LINE_WIDTHS.map((width, line) => (
            <Skeleton key={`${line}-${width}`} className={`h-3 ${width}`} />
        ))}
    </div>
);
