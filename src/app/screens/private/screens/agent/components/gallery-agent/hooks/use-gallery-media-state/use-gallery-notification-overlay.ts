import type { QueryClient } from '@tanstack/react-query';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { NavigateFunction } from 'react-router-dom';

import type { JobType } from '@/types/admin';
import type { GeneratedItem } from '@/types/gallery';

import { showGenerationFailedToast } from '../../utils/show-generation-failed-toast';
import { showGenerationReadyToast } from '../../utils/show-generation-ready-toast';
import { useNotificationsJobs } from '../use-notifications-jobs';
import type { UseNotificationsJobsReturn } from '../use-notifications-jobs';

import { FILE_READY_DELAY_MS, LIGHTBOX_FILE_ID_PARAM } from './constants';
import { buildDisplayHistory, getFileIdFromJob, runningJobToPlaceholder } from './gallery-media-helpers';
import type { GalleryInfiniteData, GalleryQueryKey, GalleryTab } from './types';

interface UseGalleryNotificationOverlayArgs {
    agentId: string;
    agentSlug: string;
    userId: string;
    userName: string;
    placeholderExtension: 'png' | 'mp4';
    isVideo: boolean;
    activeTab: GalleryTab;
    serverItems: GeneratedItem[];
    queryClient: QueryClient;
    queryKey: GalleryQueryKey;
    navigate: NavigateFunction;
    setLightboxImage: React.Dispatch<React.SetStateAction<GeneratedItem | null>>;
    fetchFileById: (fileId: string) => Promise<GeneratedItem | null>;
}

export interface UseGalleryNotificationOverlayResult {
    notificationsJobs: UseNotificationsJobsReturn;
    displayHistory: GeneratedItem[];
    displayHistoryRef: React.RefObject<GeneratedItem[]>;
}

export const useGalleryNotificationOverlay = (
    args: UseGalleryNotificationOverlayArgs,
): UseGalleryNotificationOverlayResult => {
    const {
        agentId,
        agentSlug,
        userId,
        userName,
        placeholderExtension,
        isVideo,
        activeTab,
        serverItems,
        queryClient,
        queryKey,
        navigate,
        setLightboxImage,
        fetchFileById,
    } = args;

    const [insertingJobIds, setInsertingJobIds] = useState<Set<string>>(new Set());
    const [stableFileKeys, setStableFileKeys] = useState<Record<string, string>>({});
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;

        return () => {
            isMountedRef.current = false;
        };
    }, []);

    const notificationsJobs = useNotificationsJobs({
        agentId,
        onJobFailed: (failedJobs) => {
            failedJobs.forEach((job) =>
                showGenerationFailedToast({
                    job,
                    onNavigate: (path) => navigate(path),
                }),
            );
        },
        onJobCompleted: async (completedJobs) => {
            const fileWithJobs = completedJobs
                .map((job) => {
                    const fileId = getFileIdFromJob(job);

                    return fileId ? { job, fileId } : null;
                })
                .filter((f): f is { job: JobType; fileId: string } => f != null);

            if (fileWithJobs.length === 0) return;

            const insertingIds = fileWithJobs.map((f) => f.job._id);

            setStableFileKeys((prev) => {
                const next = { ...prev };

                fileWithJobs.forEach(({ fileId, job }) => {
                    next[fileId] = job._id;
                });

                return next;
            });

            setInsertingJobIds((prev) => {
                const next = new Set(prev);

                insertingIds.forEach((id) => next.add(id));

                return next;
            });

            try {
                await new Promise((resolve) => setTimeout(resolve, FILE_READY_DELAY_MS));
                const files = await Promise.all(fileWithJobs.map((f) => fetchFileById(f.fileId)));

                if (!isMountedRef.current) return;
                const validFilesWithJobs = files
                    .map((file, i) => (file ? { file, job: fileWithJobs[i].job } : null))
                    .filter((x): x is { file: GeneratedItem; job: JobType } => x != null);

                if (validFilesWithJobs.length === 0) return;

                if (activeTab === 'my') {
                    queryClient.setQueryData<GalleryInfiniteData>(queryKey, (old) => {
                        if (!old || old.pages.length === 0) return old;

                        const [firstPage, ...rest] = old.pages;
                        const existingIds = new Set(firstPage.items.map((item) => item._id));
                        const newFiles = validFilesWithJobs
                            .map(({ file, job }) => ({ ...file, uniqueId: job._id }))
                            .filter((file) => !existingIds.has(file._id));

                        if (newFiles.length === 0) return old;

                        return {
                            ...old,
                            pages: [{ ...firstPage, items: [...newFiles, ...firstPage.items] }, ...rest],
                        };
                    });
                }

                validFilesWithJobs.forEach(({ file }) => {
                    showGenerationReadyToast({
                        file,
                        isVideo,
                        onView: () => {
                            if (window.location.pathname.startsWith(`/agent/${agentSlug}`)) {
                                setLightboxImage(file);
                            } else {
                                navigate(`/agent/${agentSlug}?${LIGHTBOX_FILE_ID_PARAM}=${file._id}`);
                            }
                        },
                    });
                });
            } finally {
                if (isMountedRef.current) {
                    setInsertingJobIds((prev) => {
                        const next = new Set(prev);

                        insertingIds.forEach((id) => next.delete(id));

                        return next;
                    });
                }
            }
        },
    });

    const displayHistory = useMemo(
        () =>
            buildDisplayHistory(
                serverItems,
                notificationsJobs.jobs,
                activeTab,
                insertingJobIds,
                notificationsJobs.settlingJobIds,
                stableFileKeys,
                (job) => runningJobToPlaceholder(job, userId ?? '', placeholderExtension, userName),
            ),
        [
            serverItems,
            notificationsJobs.jobs,
            activeTab,
            insertingJobIds,
            notificationsJobs.settlingJobIds,
            stableFileKeys,
            userId,
            placeholderExtension,
            userName,
        ],
    );

    const displayHistoryRef = useRef<GeneratedItem[]>(displayHistory);

    displayHistoryRef.current = displayHistory;

    return { notificationsJobs, displayHistory, displayHistoryRef };
};
