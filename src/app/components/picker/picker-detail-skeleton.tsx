import type { ReactNode } from 'react';

import { Card } from '@/components/ui/card';

interface PickerDetailSkeletonProps {
    hasServerUrl?: boolean;
    variant?: 'default' | 'dataStore';
}

const DataStoreDetailSection = ({ labelWidth, children }: { labelWidth: string; children: ReactNode }) => (
    <div className="flex min-w-0 flex-col gap-2">
        <div className={`h-3.5 rounded bg-foreground/10 ${labelWidth}`} />
        <div className="rounded-xl border bg-card px-5 py-4">{children}</div>
    </div>
);

const DataStoreDetailSkeleton = () => (
    <>
        <DataStoreDetailSection labelWidth="w-20">
            <div className="flex flex-col gap-2">
                <div className="h-3 w-full rounded bg-foreground/10" />
                <div className="h-3 w-[85%] rounded bg-foreground/10" />
                <div className="h-3 w-[60%] rounded bg-foreground/10" />
            </div>
        </DataStoreDetailSection>

        <DataStoreDetailSection labelWidth="w-14">
            <div className="h-3.5 w-24 rounded bg-foreground/10" />
        </DataStoreDetailSection>

        <DataStoreDetailSection labelWidth="w-14">
            <div className="h-3.5 w-32 rounded bg-foreground/10" />
        </DataStoreDetailSection>

        <DataStoreDetailSection labelWidth="w-12">
            <div className="flex flex-wrap gap-2">
                <div className="h-6 w-20 rounded bg-foreground/10" />
                <div className="h-6 w-24 rounded bg-foreground/10" />
                <div className="h-6 w-16 rounded bg-foreground/10" />
            </div>
        </DataStoreDetailSection>
    </>
);

export const PickerDetailSkeleton = ({ hasServerUrl, variant = 'default' }: PickerDetailSkeletonProps) => {
    if (variant === 'dataStore') {
        return <DataStoreDetailSkeleton />;
    }

    return (
        <>
            <Card className="flex flex-col gap-1 p-4 shadow-none">
                <div className="mb-1 h-3.5 w-16 rounded bg-foreground/10" />
                <div className="mt-2 mb-1 flex flex-col gap-2">
                    <div className="h-3 w-full rounded bg-foreground/10" />
                    <div className="h-3 w-[85%] rounded bg-foreground/10" />
                    <div className="h-3 w-[60%] rounded bg-foreground/10" />
                </div>
            </Card>

            <div className="mt-3 grid grid-cols-2 gap-3">
                <Card className="flex flex-col gap-1 p-4 shadow-none">
                    <div className="mb-1 h-3.5 w-10 rounded bg-foreground/10" />
                    <div className="mt-0.5 mb-0.5 h-4 w-16 rounded bg-foreground/10" />
                </Card>
                <Card className="flex flex-col gap-1 p-4 shadow-none">
                    <div className="mb-1 h-3.5 w-12 rounded bg-foreground/10" />
                    <div className="mt-0.5 mb-0.5 h-4 w-20 rounded bg-foreground/10" />
                </Card>
            </div>

            {hasServerUrl && (
                <Card className="mt-3 flex flex-col gap-1 p-4 shadow-none">
                    <div className="mb-1 h-3.5 w-24 rounded bg-foreground/10" />
                    <div className="mt-0.5 mb-0.5 h-4 w-[80%] rounded bg-foreground/10" />
                </Card>
            )}
        </>
    );
};
