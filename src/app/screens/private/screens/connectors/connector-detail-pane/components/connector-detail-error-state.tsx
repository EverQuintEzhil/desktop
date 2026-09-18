import { CircleAlert, RefreshCw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface Props {
    onRetry: () => void;
    onBackToConnectors: () => void;
}

const ConnectorDetailErrorState = ({ onRetry, onBackToConnectors }: Props) => (
    <div className="flex min-h-[calc(100svh-10rem)] flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <Card className="w-full max-w-lg border-border/70 bg-card p-8 text-center shadow-none">
            <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive ring-1 ring-destructive/15">
                <CircleAlert className="size-8" />
            </div>

            <div className="mx-auto flex max-w-sm flex-col gap-2">
                <Badge
                    variant="secondary"
                    className="mx-auto w-fit border-transparent bg-destructive/10 text-destructive"
                >
                    Connector unavailable
                </Badge>
                <h2 className="text-xl font-semibold tracking-tight">Failed to load connector</h2>
                <p className="text-sm leading-6 text-muted-foreground">
                    We couldn&apos;t load this connector&apos;s details. Try again, or return to the connector list and
                    select it again.
                </p>
            </div>

            <div className="flex flex-col justify-center gap-2 pt-2 sm:flex-row">
                <Button type="button" onClick={onRetry}>
                    <RefreshCw className="size-4" />
                    Retry
                </Button>
                <Button type="button" variant="outline" onClick={onBackToConnectors}>
                    Back to connectors
                </Button>
            </div>
        </Card>
    </div>
);

export default ConnectorDetailErrorState;
