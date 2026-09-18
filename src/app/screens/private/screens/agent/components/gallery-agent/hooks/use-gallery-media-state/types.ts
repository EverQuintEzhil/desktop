import type { InfiniteData } from '@tanstack/react-query';
import type React from 'react';

import type { FileType, JobType } from '@/types/admin';
import type { GalleryState, GeneratedItem } from '@/types/gallery';

import type { LightboxMediaProps } from '../../components/lightbox-media';
import type { UseNotificationsJobsReturn } from '../use-notifications-jobs';

export type GalleryTab = 'my' | 'fav' | 'firmwide';

export interface UseGalleryMediaStateReturn {
    state: GalleryState;
    retryFetch: () => Promise<void>;
    searchQuery: string;
    setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
    activeTab: GalleryTab;
    setActiveTab: React.Dispatch<React.SetStateAction<GalleryTab>>;
    isConfirmationModalOpen: GeneratedItem | null;
    lightboxImage: GeneratedItem | null;
    setLightboxImage: React.Dispatch<React.SetStateAction<GeneratedItem | null>>;
    lightboxJob: JobType | null;
    setLightboxJob: React.Dispatch<React.SetStateAction<JobType | null>>;
    isDeleteSubmitting: boolean;
    notificationsJobs: UseNotificationsJobsReturn;
    loadMore: () => void;
    removeItem: (id: string) => GeneratedItem[];
    handleNotificationJobClick: (job: JobType) => void;
    onConfirmClick: () => Promise<void>;
    closeConfirmModal: () => void;
    onDeleteItemClicked: (item: GeneratedItem) => void;
    onItemChange: (item: GeneratedItem) => void;
    onLikeItemClicked: (item: GeneratedItem) => void;
    renderConfirmationModal: (deleteMessage: string) => React.ReactNode;
    renderLightbox: (viewProps: GalleryMediaLightboxViewProps) => React.ReactNode;
    renderLightboxFileId: (viewProps: GalleryMediaLightboxViewProps) => React.ReactNode;
}

export interface GalleryMediaLightboxViewProps extends Pick<
    LightboxMediaProps,
    | 'agent'
    | 'query'
    | 'setQuery'
    | 'plusOptions'
    | 'fileInputRef'
    | 'onChangeFile'
    | 'renderFiles'
    | 'fileInputDisabled'
> {
    isVideo: boolean;
    downloadNamePrefix: string;
    onRemix?: (prompt: string, image: GeneratedItem, maskUrl?: string, editedFile?: FileType) => void;
    onEditPromptSubmit?: (prompt: string) => void;
    onDeleteItemAsyncClicked?: (item: GeneratedItem) => Promise<GeneratedItem[]>;
}

export interface GalleryPage {
    items: GeneratedItem[];
    pageInfo: { page: number; totalPages: number };
}

export type GalleryQueryKey = readonly ['gallery-media', string, string | null, GalleryTab, string];

export type GalleryInfiniteData = InfiniteData<GalleryPage, number>;

export type StableFileKeys = Record<string, string>;

export interface UseGalleryMediaStateOptions {
    agentId: string;
    agentSlug: string;
    userId: string;
    userName: string;
    placeholderExtension: 'png' | 'mp4';
    isVideo: boolean;
    creatorId?: string;
    fixedTab?: GalleryTab;
}
