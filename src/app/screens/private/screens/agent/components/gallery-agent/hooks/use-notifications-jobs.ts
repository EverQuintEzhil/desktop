import { type InfiniteData, useInfiniteQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useInfiniteScroll } from '@/hooks';
import { appMediaApi } from '@/lib/api/app/media';
import type { JobType } from '@/types/admin';
import { showErrorToast, showSuccessToast } from '@/utils';

import { dedupeById } from '../utils/dedupe-by-id';
import { isPendingStatus } from '../utils/job-status';

const POLL_INTERVAL_MS = 10000; // 10 seconds
const PAGE_SIZE = 20;

export interface UseNotificationsJobsOptions {
    agentId: string;
    onJobCompleted?: (completedJobs: JobType[]) => void;
    onJobFailed?: (failedJobs: JobType[]) => void;
}

export interface UseNotificationsJobsReturn {
    jobs: JobType[];
    settlingJobIds: Set<string>;
    isJobsLoading: boolean;
    showMoreLoading: boolean;
    hasMore: boolean;
    onLoadMore: () => void;
    loadMoreRef: React.Ref<HTMLDivElement | null>;
    refresh: () => void;
    cancelJob: (jobId: string) => Promise<void>;
    requeueJobs: (jobIds: string[], prompt?: string) => Promise<void>;
}

interface JobsPage {
    jobs: JobType[];
    pageInfo: { page: number; totalPages: number };
}

type JobsInfiniteData = InfiniteData<JobsPage, number>;

type JobsQueryKey = readonly ['notification-jobs', string];

export const getNotificationJobsQueryKey = (agentId: string): JobsQueryKey => ['notification-jobs', agentId] as const;

const fetchJobsPage = async (agentId: string, page: number, signal?: AbortSignal): Promise<JobsPage> => {
    const response = await appMediaApi.listJobs<JobType>(
        {
            agentId,
            mineOnly: true,
            page,
            size: PAGE_SIZE,
        },
        { signal },
    );

    return { jobs: response.values ?? [], pageInfo: response.pageInfo };
};

export function useNotificationsJobs(options: UseNotificationsJobsOptions): UseNotificationsJobsReturn {
    const { agentId, onJobCompleted, onJobFailed } = options;

    const onJobCompletedRef = useRef(onJobCompleted);
    const onJobFailedRef = useRef(onJobFailed);

    onJobCompletedRef.current = onJobCompleted;
    onJobFailedRef.current = onJobFailed;

    const previousPendingJobIdsRef = useRef<Set<string>>(new Set());

    const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, refetch } = useInfiniteQuery<
        JobsPage,
        Error,
        JobsInfiniteData,
        JobsQueryKey,
        number
    >({
        queryKey: getNotificationJobsQueryKey(agentId),
        queryFn: ({ pageParam, signal }) => fetchJobsPage(agentId, pageParam, signal),
        initialPageParam: 0,
        enabled: !!agentId,
        getNextPageParam: (lastPage) =>
            lastPage.pageInfo.page < lastPage.pageInfo.totalPages - 1 ? lastPage.pageInfo.page + 1 : undefined,
        refetchInterval: (query) => {
            const pages = query.state.data?.pages ?? [];
            const hasPending = pages.some((page) => page.jobs.some((job) => isPendingStatus(job.status)));

            return hasPending ? POLL_INTERVAL_MS : false;
        },
        refetchOnWindowFocus: false,
    });

    const jobs = useMemo(() => dedupeById((data?.pages ?? []).flatMap((page) => page.jobs)), [data]);
    const currentPendingJobIds = useMemo(
        () => new Set(jobs.filter((job) => isPendingStatus(job.status)).map((job) => job._id)),
        [jobs],
    );
    const settlingJobIds = useMemo(
        () =>
            new Set(
                jobs
                    .filter(
                        (job) => previousPendingJobIdsRef.current.has(job._id) && !currentPendingJobIds.has(job._id),
                    )
                    .map((job) => job._id),
            ),
        [currentPendingJobIds, jobs],
    );

    const showMoreLoading = isFetchingNextPage;
    const hasMore = Boolean(hasNextPage);

    useEffect(() => {
        if (!data) return;

        const previousPending = previousPendingJobIdsRef.current;
        const settled = jobs.filter((job) => previousPending.has(job._id) && !currentPendingJobIds.has(job._id));
        const completedJobs = settled.filter((job) => job.status === 'completed');
        const failedJobs = settled.filter((job) => job.status === 'failed');

        if (completedJobs.length > 0) onJobCompletedRef.current?.(completedJobs);
        if (failedJobs.length > 0) onJobFailedRef.current?.(failedJobs);

        previousPendingJobIdsRef.current = currentPendingJobIds;
    }, [currentPendingJobIds, data, jobs]);

    const onLoadMore = useCallback(() => {
        if (isFetchingNextPage || !hasNextPage) return;
        fetchNextPage();
    }, [isFetchingNextPage, hasNextPage, fetchNextPage]);

    const refresh = useCallback(() => {
        refetch();
    }, [refetch]);

    // Rejects on failure so the caller can react — the notifications confirmation modal keeps
    // itself open and owns the failure toast, so this path must not toast the failure itself.
    // `refetch` reports a failed refresh in its resolved result rather than by rejecting, so the
    // await below cannot turn a successful cancel into a reported failure.
    const cancelJob = useCallback(
        async (jobId: string) => {
            await appMediaApi.cancelJob(jobId);
            await refetch();
            showSuccessToast('Generation Cancelled');
        },
        [refetch],
    );

    const requeueJobs = useCallback(
        async (jobIds: string[], prompt?: string) => {
            try {
                await appMediaApi.requeueJob(jobIds, prompt);
                await refetch();
            } catch {
                showErrorToast('Failed to requeue generation');
            }
        },
        [refetch],
    );

    const { loadMoreRef } = useInfiniteScroll({
        loading: isLoading,
        showMoreLoading,
        hasMore,
        itemsLength: jobs.length,
        onLoadMore,
    });

    return {
        jobs,
        settlingJobIds,
        isJobsLoading: isLoading,
        showMoreLoading,
        hasMore,
        onLoadMore,
        loadMoreRef,
        refresh,
        cancelJob,
        requeueJobs,
    };
}
