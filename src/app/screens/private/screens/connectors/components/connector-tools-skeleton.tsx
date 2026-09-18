import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const ConnectorToolsSkeleton = () => (
    <Card className="connector-tools-skeleton gap-0 overflow-hidden p-0 shadow-none">
        <div className="connector-tools-skeleton-header flex flex-col gap-1 border-b border-border px-4 py-4">
            <Skeleton className="h-4 w-32 rounded-sm" />
            <Skeleton className="h-3 w-72 max-w-full rounded-sm" />
        </div>
        <div className="connector-tools-skeleton-groups divide-y divide-border">
            {Array.from({ length: 2 }, (_, groupIndex) => (
                <div key={`tool-group-skeleton-${groupIndex}`} className="flex flex-col">
                    <div className="flex flex-wrap items-center gap-4 px-4 py-4">
                        <div className="flex min-w-0 flex-1 items-start gap-2 sm:min-w-55">
                            <Skeleton className="mt-0.5 size-4 shrink-0 rounded-sm" />
                            <div className="flex min-w-0 flex-1 flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <Skeleton className={cn('h-5 rounded-sm', groupIndex === 0 ? 'w-28' : 'w-36')} />
                                    <Skeleton className="size-5 shrink-0 rounded-full" />
                                </div>
                                <Skeleton className="h-4 w-full max-w-xs rounded-sm" />
                            </div>
                        </div>
                        <Skeleton className="h-8 w-[236px] shrink-0 rounded-full" />
                    </div>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-5 bg-muted py-2.5 pr-4 pl-9.5">
                        <Skeleton className="h-3 w-8 rounded-sm" />
                        <Skeleton className="h-3 w-12 rounded-sm" />
                    </div>
                    <div className="divide-y divide-border">
                        {Array.from({ length: groupIndex === 0 ? 2 : 3 }, (_, rowIndex) => (
                            <div
                                key={`tool-row-skeleton-${groupIndex}-${rowIndex}`}
                                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 py-3 pr-4 pl-9.5"
                            >
                                <div className="flex min-w-0 items-center gap-2.5">
                                    <Skeleton className="size-3.5 shrink-0 rounded-sm" />
                                    <Skeleton
                                        className={cn('h-4 shrink-0 rounded-sm', rowIndex % 2 === 0 ? 'w-40' : 'w-52')}
                                    />
                                    <Skeleton
                                        className={cn(
                                            'hidden h-3 rounded-sm sm:block',
                                            rowIndex % 3 === 0 ? 'w-full max-w-xs' : 'w-4/5 max-w-sm',
                                        )}
                                    />
                                </div>
                                <Skeleton className="h-8 w-[108px] shrink-0 rounded-full sm:w-[236px]" />
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    </Card>
);

export default ConnectorToolsSkeleton;
