import { CheckIcon, CopyIcon, RotateCwIcon, XIcon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { TextareaRoot } from '@/components/ui/textarea-form';
import type { JobType } from '@/types/admin';

import { getFailReasonText, getJobModelDisplay } from '../../notifications.utils';

export interface FailReasonModalProps {
    job: JobType | null;
    editedPrompt: string;
    onEditedPromptChange: (value: string) => void;
    isRequeueing: boolean;
    onClose: () => void;
    onTryAgain: () => void | Promise<void>;
}

interface CopyButtonProps {
    text: string;
}

const CopyButton = ({ text }: CopyButtonProps) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            /* silent */
        }
    };

    return (
        <Button variant="ghost" size="icon-xs" onClick={handleCopy} aria-label="Copy to clipboard">
            {copied ? <CheckIcon className="text-success" /> : <CopyIcon />}
        </Button>
    );
};

const FailReasonModal = (props: FailReasonModalProps) => {
    const { job, editedPrompt, onEditedPromptChange, isRequeueing, onClose, onTryAgain } = props;

    if (!job) return null;

    const { model: modelName, provider } = getJobModelDisplay(job);
    const modalStatus = String(job.status ?? '').toLowerCase();
    const isCancelled = modalStatus === 'cancelled' || modalStatus === 'killed';
    const errorMessage =
        getFailReasonText(job.failReason?.message) || 'No additional error details are available for this job.';

    return (
        <Dialog
            open={Boolean(job)}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <DialogContent
                className="w-[calc(100%-2rem)] max-w-[560px] overflow-hidden p-0 max-md:flex max-md:h-svh max-md:max-h-svh max-md:w-[calc(100%)] max-md:max-w-full max-md:flex-col"
                aria-describedby={undefined}
            >
                <DialogHeader className="shrink-0 flex-row items-center justify-between gap-3">
                    <DialogTitle>{isCancelled ? 'Generation Cancelled' : 'Generation Failed'}</DialogTitle>
                    <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
                        <XIcon />
                    </Button>
                </DialogHeader>
                <DialogBody className="flex flex-col gap-4 py-4 max-md:min-h-0 max-md:flex-1 max-md:overflow-hidden max-md:py-3">
                    {(modelName || provider) && (
                        <div className="flex shrink-0 flex-col gap-1.5">
                            <span className="text-xs font-medium tracking-wide text-text-secondary uppercase">
                                Model
                            </span>
                            <div className="flex flex-wrap items-center gap-2 rounded-md bg-background p-3">
                                <span className="text-sm font-medium wrap-break-word">
                                    {modelName || 'Unknown model'}
                                </span>
                                {provider && <span className="text-xs text-text-secondary">{provider}</span>}
                            </div>
                        </div>
                    )}
                    <div className="flex flex-col gap-1.5 max-md:min-h-0">
                        <div className="flex shrink-0 items-center justify-between">
                            <span className="text-xs font-medium tracking-wide text-text-secondary uppercase">
                                Original Prompt
                            </span>
                            <CopyButton text={job.message || ''} />
                        </div>
                        <div className="scrollbar-vertical scrollbar-controller max-h-[25svh] rounded-md bg-background p-3 max-md:max-h-none max-md:min-h-0 max-md:flex-1">
                            <p className="text-sm wrap-break-word whitespace-pre-wrap">{job.message || 'Untitled'}</p>
                        </div>
                    </div>
                    {!isCancelled && (
                        <div className="flex flex-col gap-1.5 max-md:min-h-0 max-md:flex-1">
                            <div className="flex shrink-0 items-center justify-between">
                                <span className="text-xs font-medium tracking-wide text-text-secondary uppercase">
                                    Error
                                </span>
                                <CopyButton text={errorMessage} />
                            </div>
                            <div className="scrollbar-vertical scrollbar-controller max-h-[35svh] rounded-md bg-background p-3 max-md:max-h-none max-md:min-h-0 max-md:flex-1">
                                <pre className="font-mono text-xs wrap-break-word whitespace-pre-wrap text-destructive">
                                    {errorMessage}
                                </pre>
                            </div>
                        </div>
                    )}
                    <div className="flex flex-col gap-1.5 max-md:min-h-0">
                        <div className="flex shrink-0 items-center justify-between">
                            <span className="text-xs font-medium tracking-wide text-text-secondary uppercase">
                                Edit Prompt to Try Again
                            </span>
                        </div>
                        <TextareaRoot
                            autoFocus
                            className="max-h-[25svh] min-h-[4rem] resize-none rounded-md bg-background p-3 text-sm max-md:max-h-none max-md:min-h-0 max-md:flex-1"
                            value={editedPrompt}
                            onChange={(e) => onEditedPromptChange(e.target.value)}
                            placeholder="Enter prompt..."
                            aria-invalid={!editedPrompt.trim()}
                        />
                        {!editedPrompt.trim() && (
                            <span className="text-xs text-destructive">Prompt cannot be empty</span>
                        )}
                    </div>
                </DialogBody>
                <DialogFooter className="shrink-0 justify-end border-t border-border max-md:pt-4 max-md:pb-4">
                    <Button size="sm" disabled={isRequeueing || !editedPrompt.trim()} onClick={onTryAgain}>
                        <RotateCwIcon className={isRequeueing ? 'animate-spin' : ''} />
                        Try Again
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default FailReasonModal;
