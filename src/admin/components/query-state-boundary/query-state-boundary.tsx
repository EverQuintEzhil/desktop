import { RefreshCwIcon, TriangleAlertIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import SpinnerBlade from '@/components/ui/spinner';

interface Props {
    isError: boolean;
    hasData: boolean;
    children: ReactNode;
    isLoading?: boolean;
    /** A screen-shaped skeleton for the first load, in place of the generic spinner. */
    renderLoading?: () => ReactNode;
    onRetry?: () => void;
    errorMessage?: string;
}

const QueryStateBoundary = (props: Props) => {
    const { isError, hasData, children, isLoading, renderLoading, onRetry, errorMessage } = props;

    if (isLoading) {
        if (renderLoading) return renderLoading();

        return (
            <div className="flex items-center justify-center py-16">
                <SpinnerBlade />
            </div>
        );
    }

    if (isError && !hasData) {
        return (
            <div className="flex flex-col items-center justify-center gap-5 px-6 py-20 text-center">
                <Card className="flex flex-col items-center justify-center gap-5 p-8 text-center">
                    <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive ring-8 ring-destructive/5">
                        <TriangleAlertIcon className="size-6" />
                    </div>
                    <div className="flex max-w-sm flex-col gap-1.5">
                        <h3 className="text-base font-semibold text-foreground">Something went wrong</h3>
                        <p className="text-sm font-normal text-muted-foreground">
                            {errorMessage || "We couldn't load this data. Please try again."}
                        </p>
                    </div>
                    {onRetry && (
                        <Button variant="outline" size="sm" className="rounded-full px-6" onClick={onRetry}>
                            <RefreshCwIcon />
                            Retry
                        </Button>
                    )}
                </Card>
            </div>
        );
    }

    if (isError && hasData) {
        return (
            <>
                <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-normal text-destructive">
                    <span>{errorMessage || "Couldn't refresh — showing previous results."}</span>
                    {onRetry && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 rounded-full font-normal text-destructive hover:text-destructive"
                            onClick={onRetry}
                        >
                            <RefreshCwIcon />
                            Retry
                        </Button>
                    )}
                </div>
                {children}
            </>
        );
    }

    return children;
};

export default QueryStateBoundary;
