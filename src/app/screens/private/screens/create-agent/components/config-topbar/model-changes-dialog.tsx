import { ArrowRightIcon, XIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import ConfirmationModal from '@/components/ui/confirmation-modal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { ChatAgentUiType } from '@/types/ui';

import { getModelChange } from '../../lib/ui-config-diff';

interface ModelChangesDialogProps {
    open: boolean;
    original?: ChatAgentUiType;
    current?: ChatAgentUiType;
    onClose: () => void;
    onDiscard: () => void;
}

const ModelChangesDialog = ({ open, original, current, onClose, onDiscard }: ModelChangesDialogProps) => {
    const change = useMemo(() => getModelChange(original, current), [original, current]);

    const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

    const handleDiscard = () => {
        setShowDiscardConfirm(false);
        onDiscard();
        onClose();
    };

    const renderDefaultRow = () => {
        if (!change || (change.defaultOld === undefined && change.defaultNew === undefined)) {
            return null;
        }

        return (
            <div className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-b-0">
                <span className="text-sm font-medium text-foreground">Default model</span>
                <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm text-text-secondary line-through">{change.defaultOld}</span>
                    <ArrowRightIcon className="size-3.5 shrink-0 text-text-secondary" aria-hidden="true" />
                    <span className="truncate text-sm font-medium text-foreground">{change.defaultNew}</span>
                </div>
            </div>
        );
    };

    const renderModelGroup = (label: string, names: string[], tone: 'added' | 'removed') => {
        if (names.length === 0) {
            return null;
        }

        return (
            <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium tracking-wide text-text-secondary uppercase">{label}</span>
                <div className="flex flex-wrap gap-1.5">
                    {names.map((name) => (
                        <Badge
                            key={`${tone}-${name}`}
                            variant="outline"
                            className={cn(
                                'gap-1 border-border font-normal text-foreground',
                                tone === 'removed' && 'text-muted-foreground line-through',
                            )}
                        >
                            <span
                                aria-hidden="true"
                                className={
                                    tone === 'removed' ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'
                                }
                            >
                                {tone === 'removed' ? '−' : '+'}
                            </span>
                            {name}
                        </Badge>
                    ))}
                </div>
            </div>
        );
    };

    const renderModelList = () => {
        if (!change || (change.added.length === 0 && change.removed.length === 0)) {
            return null;
        }

        return (
            <div className="flex flex-col gap-3 border-b border-border py-3 last:border-b-0">
                {renderModelGroup('Removed', change.removed, 'removed')}
                {renderModelGroup('Added', change.added, 'added')}
            </div>
        );
    };

    const renderBody = () => {
        if (!change) {
            return (
                <div className="flex items-center justify-center py-10 text-sm text-text-secondary">
                    No changes to show.
                </div>
            );
        }

        return (
            <div className="flex flex-col">
                {renderDefaultRow()}
                {renderModelList()}
            </div>
        );
    };

    return (
        <>
            <Dialog
                open={open}
                onOpenChange={(o) => {
                    if (!o) onClose();
                }}
            >
                <DialogContent className="flex max-h-[80vh] max-w-[560px] flex-col gap-0 overflow-hidden rounded-xl border-border bg-card p-0">
                    <DialogHeader className="shrink-0 flex-row items-center justify-between border-b border-border bg-card px-4 py-2.5">
                        <DialogTitle className="text-sm font-medium text-foreground">Model changes</DialogTitle>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                className="h-8 rounded-full border-destructive bg-card px-4 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => setShowDiscardConfirm(true)}
                            >
                                Discard changes
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                className="rounded-full text-muted-foreground"
                                onClick={onClose}
                                aria-label="Close"
                            >
                                <XIcon className="size-3.5" />
                            </Button>
                        </div>
                    </DialogHeader>
                    <div className="scrollbar-controller scrollbar-vertical min-h-0 flex-1">
                        <div className="bg-card p-4">{renderBody()}</div>
                    </div>
                </DialogContent>
            </Dialog>
            <ConfirmationModal
                isOpen={showDiscardConfirm}
                title="Discard model changes"
                message="Discard your unpublished model changes? This cannot be undone."
                confirmButtonText="Discard"
                onConfirm={handleDiscard}
                onClose={() => setShowDiscardConfirm(false)}
            />
        </>
    );
};

export default ModelChangesDialog;
