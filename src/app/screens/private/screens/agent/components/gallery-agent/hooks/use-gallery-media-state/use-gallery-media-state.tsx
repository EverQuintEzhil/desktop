import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import type { GalleryState } from '@/types/gallery';

import type { UseGalleryMediaStateOptions, UseGalleryMediaStateReturn } from './types';
import { useGalleryDeleteConfirmation } from './use-gallery-delete-confirmation';
import { useGalleryHistoryQuery } from './use-gallery-history-query';
import { useGalleryLightboxRenderers } from './use-gallery-lightbox-renderers';
import { useGalleryLightboxState } from './use-gallery-lightbox-state';
import { useGalleryLightboxUrlSync } from './use-gallery-lightbox-url-sync';
import { useGalleryNotificationOverlay } from './use-gallery-notification-overlay';
import { useGalleryTabAndSearch } from './use-gallery-tab-and-search';

export type {
    GalleryTab,
    UseGalleryMediaStateOptions,
    GalleryMediaLightboxViewProps,
    UseGalleryMediaStateReturn,
} from './types';

export function useGalleryMediaState(options: UseGalleryMediaStateOptions): UseGalleryMediaStateReturn {
    const { agentId, agentSlug, userId, placeholderExtension, userName, isVideo, creatorId, fixedTab } = options;

    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const { activeTab, setActiveTab, searchQuery, setSearchQuery } = useGalleryTabAndSearch({
        fixedTab,
        searchParams,
        setSearchParams,
    });

    const { lightboxImage, setLightboxImage, lightboxJob, setLightboxJob } = useGalleryLightboxState();

    const {
        queryKey,
        serverItems,
        fetchFileById,
        isLoading,
        errorMessage,
        isFetchingNextPage,
        lastPageInfo,
        retryFetch,
        loadMore,
        removeItem: removeItemFromHistory,
        onItemChange,
        onLikeItemClicked,
    } = useGalleryHistoryQuery({
        agentId,
        creatorId,
        activeTab,
        searchQuery,
        userId,
    });

    const { notificationsJobs, displayHistory, displayHistoryRef } = useGalleryNotificationOverlay({
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
    });

    useGalleryLightboxUrlSync({
        searchParams,
        setSearchParams,
        fetchFileById,
        displayHistoryRef,
        setLightboxImage,
    });

    const { handleNotificationJobClick, renderLightbox, renderLightboxFileId } = useGalleryLightboxRenderers({
        userId,
        userName,
        placeholderExtension,
        displayHistoryRef,
        lightboxImage,
        setLightboxImage,
        lightboxJob,
        setLightboxJob,
    });

    const removeItem = useCallback(
        (id: string) => removeItemFromHistory(id, displayHistoryRef.current),
        [removeItemFromHistory, displayHistoryRef],
    );

    const {
        isConfirmationModalOpen,
        isDeleteSubmitting,
        onConfirmClick,
        closeConfirmModal,
        onDeleteItemClicked,
        renderConfirmationModal,
    } = useGalleryDeleteConfirmation({ removeItem });

    const state: GalleryState = useMemo(
        () => ({
            history: displayHistory,
            loading: isLoading,
            error: errorMessage,
            page: lastPageInfo?.page ?? 0,
            pages: lastPageInfo?.totalPages ?? 0,
            showMoreLoading: isFetchingNextPage,
            isLoadedWithPlaceholders: !isLoading,
        }),
        [displayHistory, isLoading, errorMessage, isFetchingNextPage, lastPageInfo?.page, lastPageInfo?.totalPages],
    );

    return {
        state,
        retryFetch,
        searchQuery,
        setSearchQuery,
        activeTab,
        setActiveTab,
        isConfirmationModalOpen,
        lightboxImage,
        setLightboxImage,
        lightboxJob,
        setLightboxJob,
        isDeleteSubmitting,
        notificationsJobs,
        loadMore,
        removeItem,
        handleNotificationJobClick,
        onConfirmClick,
        closeConfirmModal,
        onDeleteItemClicked,
        onItemChange,
        onLikeItemClicked,
        renderConfirmationModal,
        renderLightbox,
        renderLightboxFileId,
    };
}
