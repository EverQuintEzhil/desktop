import { CheckIcon, XIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';

import type { AutoCompleteStagingFooterActions } from '../types';

export interface StagingFooterProps {
    pendingSelectedCount: number;
    stagingFooterActions: AutoCompleteStagingFooterActions;
}

const StagingFooter = ({ pendingSelectedCount, stagingFooterActions }: StagingFooterProps) => (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-2 py-2">
        <div className="flex min-h-9 items-center">
            {stagingFooterActions.onClearStaging ? (
                <Button
                    size="xs"
                    type="button"
                    variant="outline"
                    disabled={pendingSelectedCount === 0}
                    onClick={() => stagingFooterActions.onClearStaging?.()}
                >
                    Clear All
                </Button>
            ) : null}
        </div>
        <div className="flex items-center gap-2">
            <Button
                aria-label="Discard staged selections"
                className="text-muted-foreground"
                size="icon-xs"
                type="button"
                variant="ghost"
                onClick={() => stagingFooterActions.onCancel()}
            >
                <XIcon aria-hidden className="size-3" />
            </Button>
            <Button
                aria-label="Add staged selections"
                size="icon-xs"
                type="button"
                variant="default"
                onClick={() => stagingFooterActions.onConfirm()}
            >
                <CheckIcon aria-hidden className="size-3" />
            </Button>
        </div>
    </div>
);

export default StagingFooter;
