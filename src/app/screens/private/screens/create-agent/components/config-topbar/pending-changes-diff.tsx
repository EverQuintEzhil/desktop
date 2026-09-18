import { diffLines } from 'diff';
import { ChevronRightIcon, XIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import ReactDiffViewer, { type ReactDiffViewerStylesOverride } from 'react-diff-viewer-continued';

import { Button } from '@/components/ui/button';
import ConfirmationModal from '@/components/ui/confirmation-modal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const DIFF_STYLES: ReactDiffViewerStylesOverride = {
    variables: {
        dark: {
            diffViewerBackground: '#000000',
            diffViewerColor: '#ffffff',
            addedColor: '#7ee787',
            addedBackground: 'rgba(63, 185, 80, 0.14)',
            removedColor: '#ffb3ad',
            removedBackground: 'rgba(248, 81, 73, 0.14)',
            wordAddedBackground: 'rgba(63, 185, 80, 0.3)',
            wordRemovedBackground: 'rgba(248, 81, 73, 0.3)',
            addedGutterBackground: 'rgba(63, 185, 80, 0.2)',
            removedGutterBackground: 'rgba(248, 81, 73, 0.2)',
            gutterBackground: '#000000',
            gutterColor: '#8b949e',
            codeFoldBackground: 'rgba(255, 255, 255, 0.04)',
            codeFoldContentColor: '#8b949e',
            codeFoldGutterBackground: '#000000',
            emptyLineBackground: '#000000',
        },
    },
    diffContainer: {
        minWidth: 'unset',
        maxWidth: '100%',
        overflowX: 'hidden',
        width: '100%',
        tableLayout: 'fixed',
        pre: {
            margin: 0,
            width: '100%',
            maxWidth: '100%',
            whiteSpace: 'pre-wrap',
            wordBreak: 'normal',
            overflowWrap: 'break-word',
        },
    },
    lineContent: {
        overflow: 'hidden',
        width: '100%',
        maxWidth: 0,
    },
    contentText: {
        whiteSpace: 'pre-wrap',
        wordBreak: 'normal',
        overflowWrap: 'break-word',
        lineBreak: 'auto',
    },
    line: {
        fontSize: '13px',
    },
    codeFold: {
        position: 'relative',
        height: '56px',
    },
    codeFoldExpandButton: {
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: '0 0 0 40px',
    },
};

interface PendingChangesDiffProps {
    open: boolean;
    originalText: string;
    newText: string;
    onClose: () => void;
    onDiscard: () => void;
}

const PendingChangesDiff = ({ open, originalText, newText, onClose, onDiscard }: PendingChangesDiffProps) => {
    const { addedCount, removedCount } = useMemo(() => {
        const parts = diffLines(originalText, newText);

        return {
            addedCount: parts.filter((p) => p.added).reduce((acc, p) => acc + (p.count ?? 0), 0),
            removedCount: parts.filter((p) => p.removed).reduce((acc, p) => acc + (p.count ?? 0), 0),
        };
    }, [originalText, newText]);

    const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

    const handleDiscard = () => {
        setShowDiscardConfirm(false);
        onDiscard();
        onClose();
    };

    return (
        <>
            <Dialog
                open={open}
                onOpenChange={(o) => {
                    if (!o) onClose();
                }}
            >
                <DialogContent className="flex max-h-[80vh] max-w-[680px] flex-col gap-0 overflow-hidden rounded-xl border-border bg-card p-0">
                    <DialogHeader className="shrink-0 flex-row items-center justify-between border-b border-border bg-card px-4 py-2.5">
                        <DialogTitle className="flex items-center gap-3 text-sm font-medium text-foreground">
                            Instruction changes
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                                    +{addedCount}
                                </span>
                                <span className="text-sm font-medium text-destructive">-{removedCount}</span>
                            </div>
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
                        <div className="bg-card p-4">
                            <div className="bg-black p-4">
                                <ReactDiffViewer
                                    oldValue={originalText}
                                    newValue={newText}
                                    splitView
                                    showDiffOnly
                                    hideSummary
                                    extraLinesSurroundingDiff={5}
                                    useDarkTheme
                                    codeFoldMessageRenderer={(total) => (
                                        <span className="flex w-full items-center gap-1.5 bg-foreground py-2 text-[13px] font-normal text-white/70">
                                            <ChevronRightIcon className="size-3.5 shrink-0" />
                                            <span>
                                                {total}
                                                {' unmodified lines'}
                                            </span>
                                        </span>
                                    )}
                                    styles={DIFF_STYLES}
                                />
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
            <ConfirmationModal
                isOpen={showDiscardConfirm}
                title="Discard instruction changes"
                message="Discard your unpublished instruction changes? This permanently deletes them and cannot be undone."
                confirmButtonText="Discard"
                onConfirm={handleDiscard}
                onClose={() => setShowDiscardConfirm(false)}
            />
        </>
    );
};

export default PendingChangesDiff;
