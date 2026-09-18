import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import ConnectorToolsSkeleton from '../../components/connector-tools-skeleton';

const ConnectorDetailLoading = () => (
    <div className="connector-detail-loading mx-auto flex w-full max-w-4xl flex-col">
        <header className="connector-detail-loading-header flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-1 items-start gap-3.5">
                <Skeleton className="size-13 shrink-0 rounded-xl bg-foreground/10" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-6 w-28 rounded-sm bg-foreground/10" />
                        <Skeleton className="h-5 w-16 rounded-full bg-foreground/10" />
                    </div>
                    <Skeleton className="h-4 w-full max-w-xl rounded-sm bg-foreground/10" />
                    <Skeleton className="h-4 w-3/5 max-w-md rounded-sm bg-foreground/10" />
                </div>
            </div>
            <div className="flex items-center gap-2 sm:shrink-0">
                <Skeleton className="h-8 w-24 rounded-md bg-foreground/10" />
                <Skeleton className="size-9 rounded-md bg-foreground/10" />
            </div>
        </header>
        <Card className="connector-detail-loading-info mt-4 gap-0 border-transparent p-5 shadow-none">
            <div className="flex items-center gap-2.5">
                <Skeleton className="size-4 shrink-0 rounded-sm" />
                <Skeleton className="h-5 w-40 rounded-sm" />
            </div>
            <div className="grid gap-x-6 gap-y-4 pt-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:pl-6">
                <div className="flex min-w-0 flex-col gap-1 py-1">
                    <Skeleton className="h-3 w-20 rounded-sm" />
                    <div className="flex items-center gap-1">
                        <Skeleton className="h-4 w-56 max-w-full rounded-sm" />
                        <Skeleton className="size-4 shrink-0 rounded-sm" />
                    </div>
                </div>
                <div className="flex flex-col gap-1 py-1 sm:min-w-35">
                    <Skeleton className="h-3 w-16 rounded-sm" />
                    <Skeleton className="h-4 w-20 rounded-sm" />
                </div>
            </div>
        </Card>
        <div className="connector-detail-loading-tools mt-4 flex flex-col gap-4">
            <ConnectorToolsSkeleton />
        </div>
    </div>
);

export default ConnectorDetailLoading;
