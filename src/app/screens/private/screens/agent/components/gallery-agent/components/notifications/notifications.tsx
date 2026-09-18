import { CircleAlertIcon, ClockIcon, FrownIcon, RotateCwIcon, XIcon } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Image } from '@/components';
import InfiniteScrollTrigger from '@/components/infinite-scroll-trigger';
import { Button } from '@/components/ui/button';
import ConfirmationModal from '@/components/ui/confirmation-modal';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import type { JobType } from '@/types/admin';

import { dismissJobToasts } from '../../utils/job-toasts';
import { showJobErrorToast } from '../../utils/show-job-status-toast';

import FailReasonModal from './components/fail-reason-modal';
import { getFailReasonText, getThumbUrl } from './notifications.utils';
import './notifications.scss';

type NotificationItemType = 'video' | 'image';

interface NotificationsJobsProps {
    jobs: JobType[];
    isJobsLoading: boolean;
    showMoreLoading: boolean;
    hasMore: boolean;
    onLoadMore: () => void;
    loadMoreRef: React.Ref<HTMLDivElement | null>;
}

interface NotificationsProps extends NotificationsJobsProps {
    itemType: NotificationItemType;
    onJobClick?: (job: JobType) => void;
    onCancelJob?: (job: JobType) => void | Promise<void>;
    onRequeue?: (job: JobType, prompt?: string) => void | Promise<void>;
}

const Notifications = (props: NotificationsProps) => {
    const { itemType, jobs, isJobsLoading, showMoreLoading, hasMore, loadMoreRef, onJobClick, onCancelJob, onRequeue } =
        props;

    const [isBellPopupOpen, setIsBellPopupOpen] = useState(false);
    const [failReasonJob, setFailReasonJob] = useState<JobType | null>(null);
    const [cancelConfirmJob, setCancelConfirmJob] = useState<JobType | null>(null);
    const [editedPrompt, setEditedPrompt] = useState('');
    const [isCancelSubmitting, setIsCancelSubmitting] = useState(false);
    const [requeueingJobIds, setRequeuingJobIds] = useState<Set<string>>(new Set());
    const [initialJobIds, setInitialJobIds] = useState<Set<string>>(new Set());
    const [seenState, setSeenState] = useState<{ hasOpenedOnce: boolean; lastSeenJobIds: Set<string> }>({
        hasOpenedOnce: false,
        lastSeenJobIds: new Set(),
    });

    useEffect(() => {
        if (failReasonJob) {
            setEditedPrompt(failReasonJob.message || '');
        }
    }, [failReasonJob]);

    useEffect(() => {
        if (jobs.length > 0 && initialJobIds.size === 0) {
            setInitialJobIds(new Set(jobs.map((j) => j._id)));
        }
    }, [jobs, initialJobIds.size]);

    useEffect(() => {
        if (isBellPopupOpen && jobs.length > 0) {
            setSeenState({
                hasOpenedOnce: true,
                lastSeenJobIds: new Set(jobs.map((j) => j._id)),
            });
        }
    }, [isBellPopupOpen, jobs]);

    const seenJobIds = seenState.hasOpenedOnce ? seenState.lastSeenJobIds : initialJobIds;
    const subtitle = itemType === 'video' ? 'Video' : 'Image';

    const hasPendingJobs = jobs.some((j) => {
        const s = String(j.status ?? '').toLowerCase();

        return s === 'queued' || s === 'running' || s === 'retry-queued';
    });

    const hasUnreadJobs = jobs.some((j) => !seenJobIds.has(j._id));

    const pendingCount = jobs.filter((j) => {
        const s = String(j.status ?? '').toLowerCase();

        return s === 'queued' || s === 'running' || s === 'retry-queued';
    }).length;

    const handleRequeue = useCallback(
        async (e: React.MouseEvent | undefined, job: JobType, prompt?: string) => {
            e?.stopPropagation();
            setRequeuingJobIds((prev) => new Set(prev).add(job._id));
            try {
                await Promise.resolve(onRequeue?.(job, prompt));
            } finally {
                setRequeuingJobIds((prev) => {
                    const next = new Set(prev);

                    next.delete(job._id);

                    return next;
                });
            }
        },
        [onRequeue],
    );

    const renderSpinner = useCallback((size: 'sm' | 'md' | 'lg') => {
        const sizeMap = { sm: '12px', md: '20px', lg: '24px' };
        const s = sizeMap[size];

        return (
            <div
                className={`notification-spinner rounded-circle ${size === 'lg' ? 'flex items-center justify-center' : ''} ${size === 'sm' ? 'is-sm shrink-0' : ''}`}
                style={{ width: s, height: s }}
            />
        );
    }, []);

    const renderJobThumbContent = useCallback(
        (job: JobType, thumbUrl: string) => {
            const statusLower = String(job.status ?? '').toLowerCase();
            const pending = statusLower === 'queued' || statusLower === 'running' || statusLower === 'retry-queued';
            const failed = statusLower === 'failed';
            const isDeleted = Array.isArray(job.output)
                ? job.output.length > 0 && job.output.every((o) => o.isDeleted)
                : job.output?.isDeleted;

            if (pending) return renderSpinner('md');
            if (failed) return <FrownIcon className="notification-icon-lg size-8 text-2xl text-destructive" />;
            if (isDeleted) return <CircleAlertIcon className="notification-icon-lg size-8 text-2xl text-destructive" />;
            if (thumbUrl) {
                return (
                    <Image
                        className="notification-thumb-image size-full min-h-0 min-w-0 rounded-md"
                        src={thumbUrl}
                        placeholder="/assets/images/broken-image.svg"
                        alt={job.message || 'Untitled'}
                    />
                );
            }

            return <FrownIcon className="notification-icon-lg size-8 text-2xl" />;
        },
        [renderSpinner],
    );

    const renderJobItem = useCallback(
        (job: JobType) => {
            const statusLower = String(job.status ?? '').toLowerCase();
            const pending = statusLower === 'queued' || statusLower === 'running' || statusLower === 'retry-queued';
            const failed = statusLower === 'failed';
            const thumbUrl = getThumbUrl(job);
            const isDeleted = Array.isArray(job.output)
                ? job.output.length > 0 && job.output.every((o) => o.isDeleted)
                : job.output?.isDeleted;
            let statusSubtitle = subtitle;

            if (failed) statusSubtitle = 'Generation failed';
            else if (statusLower === 'retry-queued') statusSubtitle = 'Retrying...';
            else if (pending) statusSubtitle = 'Queued';
            else if (statusLower === 'cancelled') statusSubtitle = 'Cancelled';
            else if (statusLower === 'killed') statusSubtitle = 'Cancelled';
            if (isDeleted) statusSubtitle = `${subtitle} Deleted`;

            return (
                <li
                    key={job._id}
                    className="notification-list-item flex cursor-pointer items-center gap-2 rounded-lg p-2"
                    onClick={() => {
                        if (failed || statusLower === 'cancelled' || statusLower === 'killed') {
                            setFailReasonJob(job);
                        } else {
                            onJobClick?.(job);
                            setIsBellPopupOpen(false);
                        }
                    }}
                >
                    <div className="notification-item-thumb flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-background object-cover">
                        {renderJobThumbContent(job, thumbUrl)}
                    </div>
                    <div className="notification-item-text flex min-w-0 flex-1 flex-col gap-0 overflow-hidden">
                        <span className="truncate text-sm font-medium">{job.message || 'Untitled'}</span>
                        <span className="text-xs text-text-secondary">{statusSubtitle}</span>
                        {failed && job.failReason?.message && (
                            <span className="line-clamp-1 text-xs text-destructive">
                                {getFailReasonText(job.failReason.message)}
                            </span>
                        )}
                    </div>
                    {(failed || statusLower === 'killed') && (
                        <SimpleTooltip content="Try Again with recent prompt" side="bottom">
                            <Button
                                variant="outline"
                                size="icon-xs"
                                className="notification-requeue-button shrink-0 rounded-full"
                                aria-label="Try again with recent prompt"
                                disabled={requeueingJobIds.has(job._id) || pending}
                                onClick={(e) => handleRequeue(e, job)}
                            >
                                <RotateCwIcon className={requeueingJobIds.has(job._id) ? 'animate-spin' : ''} />
                            </Button>
                        </SimpleTooltip>
                    )}
                    {pending && onCancelJob && (
                        <Button
                            variant="outline"
                            size="icon-xs"
                            className="notification-cancel-button rounded-full"
                            aria-label="Cancel generation"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsBellPopupOpen(false);
                                setCancelConfirmJob(job);
                            }}
                        >
                            <XIcon />
                        </Button>
                    )}
                </li>
            );
        },
        [subtitle, onJobClick, onCancelJob, setIsBellPopupOpen, renderJobThumbContent, handleRequeue, requeueingJobIds],
    );

    const trigger = useMemo(() => {
        if (hasPendingJobs) {
            return (
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Notifications"
                    className="notification-pending-trigger relative flex h-[33px] w-[33px] shrink-0 cursor-pointer items-center justify-center rounded-full bg-card text-primary"
                >
                    <span className="text-sm">{pendingCount}</span>
                </Button>
            );
        }

        return (
            <Button
                variant="secondary"
                size="icon-sm"
                aria-label="Notifications"
                className="justify-center rounded-full"
            >
                <ClockIcon />
            </Button>
        );
    }, [hasPendingJobs, pendingCount]);

    const renderListContent = () => {
        if (isJobsLoading && jobs.length === 0) {
            return Array.from({ length: 3 }, (_, i) => (
                <li
                    key={`notification-skeleton-${i}`}
                    className="notification-skeleton-item flex cursor-default items-center justify-center p-2"
                >
                    <Skeleton className="h-12 w-12 shrink-0 rounded-sm" />
                    <div className="flex w-full flex-col gap-2">
                        <Skeleton className="h-[18px] w-full rounded-sm" />
                        <Skeleton className="h-[15px] w-1/2 rounded-sm" />
                    </div>
                </li>
            ));
        }
        if (!isJobsLoading && (!jobs || jobs.length === 0)) {
            return (
                <div className="flex items-center justify-center p-2">
                    <span className="text-sm">No recent items</span>
                </div>
            );
        }

        return jobs.map(renderJobItem);
    };

    const handleCancelConfirm = useCallback(async () => {
        if (!cancelConfirmJob || !onCancelJob) return;
        const job = cancelConfirmJob;

        setIsCancelSubmitting(true);

        try {
            await Promise.resolve(onCancelJob(job));
            setCancelConfirmJob(null);
        } catch {
            showJobErrorToast('Failed to cancel generation');
        } finally {
            setIsCancelSubmitting(false);
        }
    }, [cancelConfirmJob, onCancelJob]);

    const closeCancelConfirmModal = useCallback(() => {
        setCancelConfirmJob(null);
    }, []);

    const handleBellPopupOpenChange = useCallback((open: boolean) => {
        if (open) {
            dismissJobToasts();
        }

        setIsBellPopupOpen(open);
    }, []);

    const renderConfirmationModal = () => {
        return (
            <ConfirmationModal
                isOpen={Boolean(cancelConfirmJob)}
                onClose={closeCancelConfirmModal}
                onConfirm={handleCancelConfirm}
                title="Cancel generation"
                confirmButtonText="Yes, cancel"
                cancelButtonText="Keep"
                isButtonLoading={isCancelSubmitting}
            >
                <div className="mx-auto flex w-full max-w-[360px] flex-col items-center justify-center text-center">
                    <span className="text-sm">Are you sure you want to cancel this generation?</span>
                </div>
            </ConfirmationModal>
        );
    };

    const renderFailReasonModal = () => (
        <FailReasonModal
            job={failReasonJob}
            editedPrompt={editedPrompt}
            onEditedPromptChange={setEditedPrompt}
            isRequeueing={failReasonJob ? requeueingJobIds.has(failReasonJob._id) : false}
            onClose={() => setFailReasonJob(null)}
            onTryAgain={async () => {
                if (!failReasonJob) return;
                const promptToSend = editedPrompt !== (failReasonJob.message || '') ? editedPrompt : undefined;

                await handleRequeue(undefined, failReasonJob, promptToSend);
                setFailReasonJob(null);
            }}
        />
    );

    return (
        <>
            <Popover open={isBellPopupOpen} onOpenChange={handleBellPopupOpenChange}>
                <div className="relative flex shrink-0 items-center justify-center">
                    <PopoverTrigger asChild>{trigger}</PopoverTrigger>
                    {!hasPendingJobs && hasUnreadJobs && (
                        <div
                            role="status"
                            aria-label="Unread notifications"
                            className="notification-unread-dot pointer-events-none absolute top-0 right-0 h-[10px] w-[10px] rounded-circle border-2 border-(--white) bg-(--danger)"
                        />
                    )}
                </div>
                <PopoverContent
                    align="end"
                    side="bottom"
                    sideOffset={8}
                    className="notification-popover flex max-h-[70svh] w-full max-w-xs min-w-[280px] flex-col overflow-hidden p-2"
                    onInteractOutside={(event) => {
                        const target = event.target as HTMLElement | null;

                        if (target?.closest('[data-sonner-toaster], [data-sonner-toast]')) {
                            event.preventDefault();
                        }
                    }}
                    style={{ zIndex: 49 }}
                >
                    <div className="notification-popover-scroll scrollbar-controller scrollbar-vertical min-h-0 flex-1">
                        <ul className="notification-list m-0 flex list-none flex-col p-0">{renderListContent()}</ul>
                        <InfiniteScrollTrigger
                            isLoading={showMoreLoading}
                            hasMore={hasMore}
                            loadMoreRef={loadMoreRef}
                        />
                    </div>
                </PopoverContent>
            </Popover>
            {renderConfirmationModal()}
            {renderFailReasonModal()}
        </>
    );
};

export default Notifications;
