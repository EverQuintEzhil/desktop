import { Skeleton } from '@/components/ui/skeleton';

const GRID_CLASS_NAME = 'grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4';
const SKELETON_KEYS = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'];

interface Props {
    view: 'grid' | 'list';
}

const renderGridSkeletons = () => (
    <div className={GRID_CLASS_NAME}>
        {SKELETON_KEYS.map((key) => (
            <div key={key} className="flex flex-col overflow-hidden rounded-2xl bg-card">
                <Skeleton className="aspect-video w-full rounded-none" />
                <div className="flex flex-col gap-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                        <Skeleton className="h-4 w-2/3 rounded-md" />
                        <Skeleton className="size-5 shrink-0 rounded-md" />
                    </div>
                    <Skeleton className="h-3 w-1/3 rounded-md" />
                    <Skeleton className="h-4 w-1/3 rounded-md" />
                </div>
            </div>
        ))}
    </div>
);

const renderListSkeletons = () => (
    <div className="flex flex-col">
        {SKELETON_KEYS.map((key) => (
            <div key={key} className="flex min-h-[92px] items-center gap-4 border-b border-border-secondary px-3 py-5">
                <Skeleton className="size-12 shrink-0 rounded-2xl bg-foreground/10" />
                <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                    <Skeleton className="h-4 w-1/2 rounded-md bg-foreground/10" />
                    <Skeleton className="h-3.5 w-1/3 rounded-md bg-foreground/10" />
                </div>
                <Skeleton className="size-5 shrink-0 rounded-md bg-foreground/10" />
            </div>
        ))}
    </div>
);

const LibrarySkeletons = (props: Props) => {
    const { view } = props;

    return view === 'grid' ? renderGridSkeletons() : renderListSkeletons();
};

export type { Props as LibrarySkeletonsProps };
export default LibrarySkeletons;
