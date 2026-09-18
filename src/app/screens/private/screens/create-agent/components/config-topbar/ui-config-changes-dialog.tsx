import { ArrowRightIcon, XIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import ConfirmationModal from '@/components/ui/confirmation-modal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { ChatAgentUiType } from '@/types/ui';

import {
    computeScalarChanges,
    computeQuestionDiff,
    hasNonModelChanges,
    type ScalarChange,
} from '../../lib/ui-config-diff';

interface UiConfigChangesDialogProps {
    open: boolean;
    original?: ChatAgentUiType;
    current?: ChatAgentUiType;
    onClose: () => void;
    onDiscard: () => void;
}

const UiConfigChangesDialog = ({ open, original, current, onClose, onDiscard }: UiConfigChangesDialogProps) => {
    const scalarChanges = useMemo(() => computeScalarChanges(original, current), [original, current]);

    const questionDiff = useMemo(() => computeQuestionDiff(original, current), [original, current]);

    const hasQuestionChange = questionDiff.added.length > 0 || questionDiff.removed.length > 0;

    const hasChanges = scalarChanges.length > 0 || hasQuestionChange;

    const hasOtherChanges = useMemo(() => hasNonModelChanges(original, current), [original, current]);

    const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

    const handleDiscard = () => {
        setShowDiscardConfirm(false);
        onDiscard();
        onClose();
    };

    const renderValue = (value: string, kind: ScalarChange['kind'], side: 'old' | 'new') => {
        if (kind === 'boolean') {
            const isOn = value === 'On';
            const variant = side === 'new' && isOn ? 'default' : 'secondary';

            return (
                <Badge variant={variant} className={cn(side === 'old' && 'line-through opacity-70')}>
                    {value}
                </Badge>
            );
        }

        return (
            <span className={cn('text-sm', side === 'old' ? 'text-text-secondary line-through' : 'text-foreground')}>
                {value}
            </span>
        );
    };

    const renderScalarRow = (change: ScalarChange) => (
        <div
            key={change.id}
            className="flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-b-0"
        >
            <span className="text-sm font-medium text-foreground">{change.label}</span>
            <div className="flex min-w-0 items-center gap-2">
                {renderValue(change.oldValue, change.kind, 'old')}
                <ArrowRightIcon className="size-3.5 shrink-0 text-text-secondary" aria-hidden="true" />
                {renderValue(change.newValue, change.kind, 'new')}
            </div>
        </div>
    );

    const renderQuestionRow = () => {
        if (!hasQuestionChange) return null;

        return (
            <div className="flex flex-col gap-2 border-b border-border py-2.5 last:border-b-0">
                <span className="text-sm font-medium text-foreground">Starter questions</span>
                <div className="flex flex-col gap-1">
                    {questionDiff.removed.map((q) => (
                        <span key={`removed-${q}`} className="text-sm text-muted-foreground line-through">
                            <span aria-hidden="true" className="text-destructive no-underline">
                                {'− '}
                            </span>
                            {q}
                        </span>
                    ))}
                    {questionDiff.added.map((q) => (
                        <span key={`added-${q}`} className="text-sm text-foreground">
                            <span aria-hidden="true" className="text-emerald-600 dark:text-emerald-400">
                                {'+ '}
                            </span>
                            {q}
                        </span>
                    ))}
                </div>
            </div>
        );
    };

    const renderBody = () => {
        if (!hasChanges) {
            return (
                <div className="flex items-center justify-center py-10 text-sm text-text-secondary">
                    {hasOtherChanges ? 'Other settings were updated.' : 'No changes to show.'}
                </div>
            );
        }

        return (
            <div className="flex flex-col">
                {scalarChanges.map((change) => renderScalarRow(change))}
                {renderQuestionRow()}
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
                        <DialogTitle className="text-sm font-medium text-foreground">
                            Chat appearance changes
                        </DialogTitle>
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
                title="Discard appearance changes"
                message="Discard your unpublished appearance changes? This cannot be undone."
                confirmButtonText="Discard"
                onConfirm={handleDiscard}
                onClose={() => setShowDiscardConfirm(false)}
            />
        </>
    );
};

export default UiConfigChangesDialog;
