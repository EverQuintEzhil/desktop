import { useQueryClient } from '@tanstack/react-query';
import { CheckIcon, CopyIcon, FrownIcon, RotateCwIcon, XIcon } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TextareaRoot } from '@/components/ui/textarea-form';
import { appMediaApi } from '@/lib/api/app/media';
import { cn } from '@/lib/utils';
import type { JobType } from '@/types/admin';
import { showErrorToast, showSuccessToast } from '@/utils';

import { getNotificationJobsQueryKey } from '../hooks/use-notifications-jobs';

import { getJobToastLifecycleHandlers, registerJobToast } from './job-toasts';

const getJobAgentSlug = (job: JobType): string | undefined => {
    if (typeof job.agentId === 'object' && job.agentId?.slug) {
        return job.agentId.slug;
    }

    return job.agent?.slug;
};

const getJobAgentId = (job: JobType): string | undefined => {
    if (typeof job.agentId === 'string') {
        return job.agentId;
    }

    return job.agentId?._id ?? job.agent?._id;
};

function CopyButton({ text }: { text: string }) {
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
}

export interface GenerationFailedToastProps {
    job: JobType;
    closeToast?: () => void;
    onNavigate?: (path: string) => void;
}

function GenerationFailedToast({ job, closeToast, onNavigate }: GenerationFailedToastProps) {
    const failReason = job.failReason?.message;
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isRequeuing, setIsRequeuing] = useState(false);
    const [editedPrompt, setEditedPrompt] = useState(job.message || '');
    const toastContentRef = useRef<HTMLDivElement>(null);
    const queryClient = useQueryClient();
    const agentSlug = getJobAgentSlug(job);
    const agentId = getJobAgentId(job);

    const handleRequeue = async () => {
        if (isRequeuing) return;

        setIsRequeuing(true);
        try {
            const promptToSend = editedPrompt !== (job.message || '') ? editedPrompt : undefined;

            await appMediaApi.requeueJob([job._id], promptToSend);
            // Refresh the agent's job list so the requeued job shows up as a pending
            // placeholder in the grid and in the notification panel. Mirrors the
            // refetch() the notification panel's own requeue button does.
            if (agentId) {
                queryClient.invalidateQueries({ queryKey: getNotificationJobsQueryKey(agentId) });
            }
            showSuccessToast('Generation requeued');
            setIsModalOpen(false);
            closeToast?.();
            // The requeued job only renders on its agent's generation page, so take
            // the user there — handles requeuing from any other page.
            if (agentSlug) {
                onNavigate?.(`/agent/${agentSlug}`);
            }
        } catch {
            showErrorToast('Failed to requeue generation');
        } finally {
            setIsRequeuing(false);
        }
    };

    const hideToast = () => {
        const toastEl = toastContentRef.current?.closest('[data-sonner-toast]');

        if (toastEl instanceof HTMLElement) {
            toastEl.style.display = 'none';
        }
    };

    const handleClick = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('[data-toast-close], [data-close-button]')) return;
        if (failReason) {
            setIsModalOpen(true);
            hideToast();

            return;
        }

        // No error detail to show — send the user to the agent's generation page
        // so the toast is still actionable when clicked from another page.
        if (agentSlug) {
            onNavigate?.(`/agent/${agentSlug}`);
        }
        closeToast?.();
    };

    const handleModalClose = (open: boolean) => {
        setIsModalOpen(open);

        if (!open) {
            closeToast?.();
        }
    };

    const renderCloseButton = () => (
        <button
            data-close-button
            data-toast-close
            type="button"
            aria-label="Close toast"
            className={cn(
                'absolute top-0 left-0 z-1 flex size-5 translate-x-[-35%] translate-y-[-35%]',
                'cursor-pointer items-center justify-center rounded-full border border-border-secondary',
                'text-text-primary bg-card p-0 transition-colors hover:bg-background',
            )}
            onClick={(e) => {
                e.stopPropagation();
                closeToast?.();
            }}
        >
            <XIcon className="size-3" />
        </button>
    );

    return (
        <>
            <div ref={toastContentRef} className="flex w-full items-start justify-start gap-2">
                {renderCloseButton()}
                <div
                    role="button"
                    tabIndex={0}
                    onClick={handleClick}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleClick(e as unknown as React.MouseEvent);
                        }
                    }}
                    className="flex min-w-0 flex-1 cursor-pointer items-start justify-start gap-2"
                >
                    <div className="toast-media-preview mt-1 flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-background">
                        <FrownIcon className="toast-media-fallback size-8 text-2xl text-destructive" />
                    </div>
                    <div className="toast-media-text flex min-w-0 flex-1 flex-col overflow-hidden">
                        <span className="truncate text-sm font-medium">{job.message || 'Untitled'}</span>
                        <span className="text-xs text-text-secondary">Generation failed</span>
                        {failReason && <span className="line-clamp-1 text-xs text-destructive">{failReason}</span>}
                    </div>
                </div>
            </div>
            {failReason && (
                <Dialog open={isModalOpen} onOpenChange={handleModalClose}>
                    <DialogContent className="w-full max-w-[560px]" aria-describedby={undefined}>
                        <DialogHeader className="flex-row items-center justify-between gap-3">
                            <DialogTitle>Generation Failed</DialogTitle>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Close"
                                onClick={() => handleModalClose(false)}
                            >
                                <XIcon />
                            </Button>
                        </DialogHeader>
                        <DialogBody className="flex flex-col gap-4 py-4">
                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium tracking-wide text-text-secondary uppercase">
                                        Original Prompt
                                    </span>
                                    <CopyButton text={job.message || ''} />
                                </div>
                                <div className="scrollbar-vertical scrollbar-controller max-h-[25svh] rounded-md bg-background p-3">
                                    <p className="text-sm wrap-break-word whitespace-pre-wrap">
                                        {job.message || 'Untitled'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium tracking-wide text-text-secondary uppercase">
                                        Edit Prompt to Try Again
                                    </span>
                                </div>
                                <TextareaRoot
                                    autoFocus
                                    className="max-h-[25svh] min-h-[4rem] resize-none rounded-md bg-background p-3 text-sm"
                                    value={editedPrompt}
                                    onChange={(e) => setEditedPrompt(e.target.value)}
                                    placeholder="Enter prompt..."
                                    aria-invalid={!editedPrompt.trim()}
                                />
                                {!editedPrompt.trim() && (
                                    <span className="text-xs text-destructive">Prompt cannot be empty</span>
                                )}
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium tracking-wide text-text-secondary uppercase">
                                        Error
                                    </span>
                                    <CopyButton text={failReason} />
                                </div>
                                <div className="scrollbar-vertical scrollbar-controller max-h-[35svh] rounded-md bg-background p-3">
                                    <pre className="font-mono text-xs wrap-break-word whitespace-pre-wrap text-destructive">
                                        {failReason}
                                    </pre>
                                </div>
                            </div>
                        </DialogBody>
                        <DialogFooter className="justify-end border-t border-border">
                            <Button size="sm" disabled={isRequeuing || !editedPrompt.trim()} onClick={handleRequeue}>
                                <RotateCwIcon className={isRequeuing ? 'animate-spin' : ''} />
                                Try Again
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}

export interface ShowGenerationFailedToastOptions {
    job: JobType;
    onNavigate?: (path: string) => void;
}

export function showGenerationFailedToast({ job, onNavigate }: ShowGenerationFailedToastOptions) {
    const toastId = toast.custom(
        (id) => <GenerationFailedToast job={job} closeToast={() => toast.dismiss(id)} onNavigate={onNavigate} />,
        {
            duration: job.failReason?.message ? Infinity : 10000,
            closeButton: false,
            className: 'toast-generation-failed',
            style: {
                borderRadius: 12,
                boxShadow: 'var(--shadow-sm)',
                backgroundColor: 'var(--white)',
                padding: 12,
                width: 'var(--width)',
            },
            ...getJobToastLifecycleHandlers(),
        },
    );

    registerJobToast(toastId);
}
