import type React from 'react';
import { useCallback } from 'react';

import type { JobType } from '@/types/admin';
import type { GeneratedItem } from '@/types/gallery';
import { makeSafeDownloadFilename } from '@/utils';

import LightboxMedia, { LightboxMediaFileId } from '../../components/lightbox-media';
import { isPendingStatus } from '../../utils/job-status';

import { getFileIdFromJob, runningJobToPlaceholder } from './gallery-media-helpers';
import type { GalleryMediaLightboxViewProps } from './types';

interface UseGalleryLightboxRenderersArgs {
    userId: string;
    userName: string;
    placeholderExtension: 'png' | 'mp4';
    displayHistoryRef: React.RefObject<GeneratedItem[]>;
    lightboxImage: GeneratedItem | null;
    setLightboxImage: React.Dispatch<React.SetStateAction<GeneratedItem | null>>;
    lightboxJob: JobType | null;
    setLightboxJob: React.Dispatch<React.SetStateAction<JobType | null>>;
}

export interface UseGalleryLightboxRenderersResult {
    handleNotificationJobClick: (job: JobType) => void;
    renderLightbox: (viewProps: GalleryMediaLightboxViewProps) => React.ReactNode;
    renderLightboxFileId: (viewProps: GalleryMediaLightboxViewProps) => React.ReactNode;
}

export const useGalleryLightboxRenderers = (
    args: UseGalleryLightboxRenderersArgs,
): UseGalleryLightboxRenderersResult => {
    const {
        userId,
        userName,
        placeholderExtension,
        displayHistoryRef,
        lightboxImage,
        setLightboxImage,
        lightboxJob,
        setLightboxJob,
    } = args;

    const handleNotificationJobClick = useCallback(
        (job: JobType) => {
            const fileId = getFileIdFromJob(job);
            const existing = fileId ? displayHistoryRef.current.find((history) => history._id === fileId) : undefined;

            if (existing) {
                setLightboxImage(existing);

                return;
            }
            setLightboxJob(job);
        },
        [displayHistoryRef, setLightboxImage, setLightboxJob],
    );

    const renderLightbox = (viewProps: GalleryMediaLightboxViewProps) => {
        if (!lightboxImage) return null;

        const {
            agent,
            query,
            setQuery,
            plusOptions,
            isVideo,
            downloadNamePrefix,
            onRemix,
            onEditPromptSubmit,
            onDeleteItemAsyncClicked,
            fileInputRef,
            onChangeFile,
            renderFiles,
            fileInputDisabled,
        } = viewProps;

        return (
            <LightboxMedia
                lightboxImage={lightboxImage}
                isVideo={isVideo}
                isOpen
                onClose={() => setLightboxImage(null)}
                downloadName={makeSafeDownloadFilename(null, {
                    agentName: agent?.name ?? downloadNamePrefix,
                    createdAt: lightboxImage.created_at,
                    promptSummary: lightboxImage.ai?.arguments?.prompt || lightboxImage.title,
                })}
                agent={agent}
                onRemix={onRemix}
                onEditPromptSubmit={onEditPromptSubmit}
                onDeleteItemAsyncClicked={onDeleteItemAsyncClicked}
                query={query}
                setQuery={setQuery}
                plusOptions={plusOptions}
                fileInputRef={fileInputRef}
                onChangeFile={onChangeFile}
                renderFiles={renderFiles}
                fileInputDisabled={fileInputDisabled}
            />
        );
    };

    const renderLightboxFileId = (viewProps: GalleryMediaLightboxViewProps) => {
        if (!lightboxJob) return null;

        const fileId = getFileIdFromJob(lightboxJob);
        const {
            agent,
            query,
            setQuery,
            plusOptions,
            isVideo,
            downloadNamePrefix,
            onRemix,
            onEditPromptSubmit,
            onDeleteItemAsyncClicked,
            fileInputRef,
            onChangeFile,
            renderFiles,
            fileInputDisabled,
        } = viewProps;

        if (fileId) {
            return (
                <LightboxMediaFileId
                    fileId={fileId}
                    isVideo={isVideo}
                    isOpen
                    onClose={() => setLightboxJob(null)}
                    downloadName={makeSafeDownloadFilename(null, {
                        agentName: agent?.name ?? downloadNamePrefix,
                        createdAt: lightboxJob.createdAt ? new Date(lightboxJob.createdAt).getTime() : undefined,
                        promptSummary: lightboxJob.message || undefined,
                    })}
                    agent={agent}
                    query={query}
                    setQuery={setQuery}
                    plusOptions={plusOptions}
                    onRemix={onRemix}
                    onEditPromptSubmit={onEditPromptSubmit}
                    onDeleteItemAsyncClicked={onDeleteItemAsyncClicked}
                    fileInputRef={fileInputRef}
                    onChangeFile={onChangeFile}
                    renderFiles={renderFiles}
                    fileInputDisabled={fileInputDisabled}
                />
            );
        }
        if (isPendingStatus(lightboxJob.status)) {
            return (
                <LightboxMedia
                    lightboxImage={{
                        ...runningJobToPlaceholder(lightboxJob, userId ?? '', placeholderExtension, userName),
                        _id: lightboxJob._id,
                        isRunning: true,
                        title: lightboxJob.message || '',
                    }}
                    isVideo={isVideo}
                    isOpen
                    plusOptions={plusOptions}
                    onClose={() => setLightboxJob(null)}
                    fileInputRef={fileInputRef}
                    onChangeFile={onChangeFile}
                    renderFiles={renderFiles}
                    fileInputDisabled={fileInputDisabled}
                />
            );
        }

        return null;
    };

    return { handleNotificationJobClick, renderLightbox, renderLightboxFileId };
};
