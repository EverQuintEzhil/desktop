import { MousePointerClick, Plug, ShieldCheck, Wrench } from 'lucide-react';

import { LearnMoreLink } from '@/components';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { YOUTUBE_VIDEO_EMBED_KEYS } from '@/types/admin';

interface Props {
    className?: string;
}

const ConnectorDetailPlaceholder = ({ className }: Props) => (
    <div className={cn('flex items-center justify-center px-6 py-10', className)}>
        <Card className="w-full max-w-2xl border-border/70 bg-card p-8 text-center shadow-none">
            <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
                <Plug className="size-8" />
            </div>

            <div className="mx-auto flex max-w-md flex-col gap-2">
                <Badge variant="secondary" className="mx-auto w-fit border-transparent bg-primary/10 text-primary">
                    Connectors
                </Badge>
                <h2 className="text-2xl font-semibold tracking-tight">Select a connector to manage access</h2>
                <p className="text-sm leading-6 text-muted-foreground">
                    Choose a service from the list to review its connection status, authorization details, and available
                    tools.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-3">
                <div className="flex flex-col items-center gap-2 rounded-xl bg-muted/40 p-4">
                    <MousePointerClick className="size-5 text-primary" />
                    <span className="text-xs font-medium text-muted-foreground">Pick a service</span>
                </div>
                <div className="flex flex-col items-center gap-2 rounded-xl bg-muted/40 p-4">
                    <ShieldCheck className="size-5 text-primary" />
                    <span className="text-xs font-medium text-muted-foreground">Authorize securely</span>
                </div>
                <div className="flex flex-col items-center gap-2 rounded-xl bg-muted/40 p-4">
                    <Wrench className="size-5 text-primary" />
                    <span className="text-xs font-medium text-muted-foreground">Manage tools</span>
                </div>
            </div>

            <LearnMoreLink
                embedKey={YOUTUBE_VIDEO_EMBED_KEYS.connectors}
                label="Learn more about connectors"
                className="mx-auto w-fit"
            />
        </Card>
    </div>
);

export default ConnectorDetailPlaceholder;
