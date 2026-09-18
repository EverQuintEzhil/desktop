import { Skeleton } from '@/components/ui/skeleton';

import { Section } from './shared';

export default function SkeletonSection() {
    return (
        <Section title="Skeleton" description="Loading placeholders">
            <div className="skeleton-container max-w-md space-y-4">
                <div className="flex gap-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex flex-1 flex-col gap-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                    </div>
                </div>
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-8 w-full" />
            </div>
        </Section>
    );
}
