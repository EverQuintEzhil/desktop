import { CornerDownRight, XIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { useSelectionQuoteContext } from './selection-quote';

export const ComposerQuoteBanner = () => {
    const quoteContext = useSelectionQuoteContext();

    if (!quoteContext?.pendingQuote) return null;

    return (
        <div className="quote-banner my-2 flex w-full">
            <div className="inline-flex max-w-[min(100%)] items-start gap-2 self-start rounded-lg border border-border bg-muted px-3 py-2">
                <CornerDownRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <span className="line-clamp-2 min-w-0 flex-1 text-sm wrap-break-word text-muted-foreground">
                    {`“${quoteContext.pendingQuote}”`}
                </span>
                <Button
                    variant="ghost"
                    size="icon-xs"
                    className="-mr-1 shrink-0 rounded-full"
                    aria-label="Remove quote"
                    onClick={quoteContext.clearPendingQuote}
                >
                    <XIcon />
                </Button>
            </div>
        </div>
    );
};
