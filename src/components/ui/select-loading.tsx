import * as React from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';

export type SelectLoadingVariant = 'spinner' | 'skeleton';

interface SelectLoadingProps {
    variant: SelectLoadingVariant;
    text: React.ReactNode;
}

/**
 * Loading state for the first page of async options.
 *
 * The `spinner` default always renders words. Shapes alone read as an empty dropdown
 * here: `bg-muted` on a `--surface` popover is two near-identical greys, and the repo
 * bans `animate-pulse`, so a skeleton has neither contrast nor motion to carry it.
 *
 * `skeleton` is the opt-out for lists where the row shape matters more than the
 * message; it stays silent by design.
 */
export function SelectLoading({ variant, text }: SelectLoadingProps) {
    if (variant === 'skeleton') {
        return <SelectLoadingRows count={5} className="select-loading" label="Loading options" />;
    }

    return (
        <div
            className="select-loading flex items-center justify-center gap-2 px-3 py-4 text-sm text-(--text-secondary)"
            role="status"
            aria-live="polite"
        >
            <Spinner className="size-4" aria-hidden="true" />
            <span>{text}</span>
        </div>
    );
}

/** Loading state for a further page appended below the options already on screen. */
export function SelectLoadingMore({ variant }: { variant: SelectLoadingVariant }) {
    if (variant === 'skeleton') {
        return <SelectLoadingRows count={2} className="select-loading-more" label="Loading more options" />;
    }

    return (
        <div
            className="select-loading-more flex items-center justify-center py-2 text-(--text-secondary)"
            role="status"
            aria-label="Loading more options"
        >
            <Spinner className="size-4" aria-hidden="true" />
        </div>
    );
}

interface SelectLoadingRowsProps {
    count: number;
    className: string;
    label: string;
}

function SelectLoadingRows({ count, className, label }: SelectLoadingRowsProps) {
    return (
        <div className={`${className} flex flex-col gap-1 p-1`} role="status" aria-label={label}>
            {Array.from({ length: count }, (_, index) => (
                <Skeleton key={index} className="h-6 w-full rounded-lg" aria-hidden="true" />
            ))}
        </div>
    );
}
