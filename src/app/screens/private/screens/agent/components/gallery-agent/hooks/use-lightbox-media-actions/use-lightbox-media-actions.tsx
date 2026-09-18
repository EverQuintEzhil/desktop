import { useEffect, useMemo, useState } from 'react';

import { useDownloadMedia, useImageCopyExport } from '@/app/hooks';
import type { FileType, ModelValueType } from '@/types/admin';
import type { GeneratedItem as GalleryGeneratedItem, GeneratedItem } from '@/types/gallery';
import type { AgentUiType } from '@/types/ui';

import { useCanSeeUsage } from '../../../token-usage-dialog/usage-visibility';
import useMaskImage from '../use-mask-image';

import { LightboxHeader } from './components/lightbox-header';
import { getBlackThemePopupStyle, getParameterButtonStyles } from './lightbox-media-actions.styles';
import { useLightboxDelete } from './use-lightbox-delete';
import { useLightboxEditPrompt } from './use-lightbox-edit-prompt';
import { useLightboxRelatedFiles } from './use-lightbox-related-files';
import { useLightboxRemix } from './use-lightbox-remix';
import { useLightboxVisibility } from './use-lightbox-visibility';
import './use-lightbox-media-actions.scss';

export interface UseLightboxMediaActionsOptions {
    isOpen: boolean;
    isVideo: boolean;
    currentItem: GeneratedItem | null;
    downloadName?: string;
    agentId?: string;
    agentUiConfig?: AgentUiType | null;
    onClose: () => void;
    onRemix?: (prompt: string, image: GeneratedItem, maskUrl?: string, editedFile?: FileType) => void;
    onEditPromptSubmit?: (prompt: string) => void;
    onLikeItemClicked?: (item: GeneratedItem) => void;
    onItemChange?: (item: GeneratedItem) => void;
    onDeleteItemAsyncClicked?: (item: GeneratedItem) => Promise<GeneratedItem[]>;
    escapeClosesLightbox?: boolean;
    showCloseButton?: boolean;
    renderHeaderLeft?: () => React.ReactNode;
    onAfterDelete?: (remainingItems?: GeneratedItem[]) => void;
    initialShowRemixInput?: boolean;
    controlledShowRemixInput?: boolean;
    controlledSetShowRemixInput?: (v: boolean) => void;
    controlledShowCropExportModal?: boolean;
    controlledSetShowCropExportModal?: (v: boolean) => void;
    controlledShowEditPromptModal?: boolean;
    controlledSetShowEditPromptModal?: (v: boolean) => void;
    showComparisonTabs?: boolean;
    activeTab?: 'original' | 'edited' | 'comparison';
    onActiveTabChange?: (tab: 'original' | 'edited' | 'comparison') => void;
    relatedFileIds?: string[];
    onChangeFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
    renderFiles: () => React.ReactNode;
    fileInputDisabled: boolean;
    selectedModel?: ModelValueType | null;
    setDefaultParameters?: (defaultParameters: unknown, modelId: string) => void;
    resetDefaultParameters?: () => void;
}

export interface RenderLightboxHeaderOptions {
    isMyItem: boolean;
}

export function useLightboxMediaActions(options: UseLightboxMediaActionsOptions) {
    const {
        isOpen,
        isVideo,
        currentItem,
        downloadName,
        agentId,
        agentUiConfig,
        onClose,
        onRemix,
        onEditPromptSubmit,
        onLikeItemClicked,
        onItemChange,
        onDeleteItemAsyncClicked,
        escapeClosesLightbox = true,
        showCloseButton = true,
        renderHeaderLeft,
        onAfterDelete,
        initialShowRemixInput = false,
        controlledShowRemixInput,
        controlledSetShowRemixInput,
        controlledShowCropExportModal,
        controlledSetShowCropExportModal,
        controlledShowEditPromptModal,
        controlledSetShowEditPromptModal,
        showComparisonTabs,
        activeTab,
        onActiveTabChange,
        relatedFileIds,
        onChangeFile,
        renderFiles,
        fileInputDisabled,
        selectedModel,
        setDefaultParameters,
        resetDefaultParameters,
    } = options;

    const [exportMenuOpen, setExportMenuOpen] = useState(false);
    const [ellipsisMenuOpen, setEllipsisMenuOpen] = useState(false);
    const [usageDialogOpen, setUsageDialogOpen] = useState(false);
    const [internalShowRemixInput, setInternalShowRemixInput] = useState(initialShowRemixInput);
    const [internalShowCropExportModal, setInternalShowCropExportModal] = useState(false);

    const canSeeUsage = useCanSeeUsage(agentUiConfig);
    const tokenUsageOpen = canSeeUsage && usageDialogOpen;

    const showRemixInput = controlledShowRemixInput ?? internalShowRemixInput;
    const setShowRemixInput = controlledSetShowRemixInput ?? setInternalShowRemixInput;
    const showCropExportModal = controlledShowCropExportModal ?? internalShowCropExportModal;
    const setShowCropExportModal = controlledSetShowCropExportModal ?? setInternalShowCropExportModal;

    const maskSupported = !isVideo;

    const { downloadMedia, downloading } = useDownloadMedia();
    const { copyImage, exportImageAs, copying, exporting } = useImageCopyExport();

    const maskImage = useMaskImage({
        isOpen,
        showRemixInput,
        maskSupported,
        currentItem: (currentItem ?? undefined) as unknown as GalleryGeneratedItem,
        brushSize: typeof window !== 'undefined' && window.innerWidth < 768 ? 35 : 90,
    });

    const visibility = useLightboxVisibility({ currentItem, onItemChange, onLikeItemClicked });
    const deleteFlow = useLightboxDelete({ onDeleteItemAsyncClicked, onAfterDelete });
    const relatedFiles = useLightboxRelatedFiles({ relatedFileIds });

    const remix = useLightboxRemix({
        isOpen,
        initialShowRemixInput,
        maskSupported,
        showRemixInput,
        setShowRemixInput,
        currentItem,
        agentId,
        onRemix,
        onClose,
        setDefaultParameters,
        resetDefaultParameters,
        maskImage,
    });

    const blackThemePopupStyle = useMemo(() => getBlackThemePopupStyle(), []);
    const parameterButtonStyles = useMemo(() => getParameterButtonStyles(), []);

    const editPrompt = useLightboxEditPrompt({
        currentItem,
        relatedFiles: relatedFiles.relatedFiles,
        selectedModel,
        controlledShowEditPromptModal,
        controlledSetShowEditPromptModal,
        setDefaultParameters,
        resetDefaultParameters,
        onChangeFile,
        renderFiles,
        fileInputDisabled,
        onEditPromptSubmit,
        blackThemePopupStyle,
        parameterButtonStyles,
    });

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            if (tokenUsageOpen) return;
            if (relatedFiles.relatedCarouselOpen) {
                relatedFiles.closeRelatedCarousel();
                event.preventDefault();
            } else if (showRemixInput) {
                setShowRemixInput(false);
                event.preventDefault();
            } else if (escapeClosesLightbox) {
                event.preventDefault();
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown, true);
        } else {
            document.removeEventListener('keydown', handleKeyDown, true);
        }

        return () => document.removeEventListener('keydown', handleKeyDown, true);
    }, [isOpen, relatedFiles.relatedCarouselOpen, showRemixInput, onClose, escapeClosesLightbox, tokenUsageOpen]);

    const handleDownloadClicked = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (showRemixInput) return;
        const mediaUrl = currentItem?.url;

        if (isVideo && mediaUrl) {
            downloadMedia(mediaUrl, `${downloadName ?? 'media'}`, true);

            return;
        }
        if (!isVideo) {
            setShowCropExportModal(true);
        }
    };

    const renderLightboxHeader = (opts: RenderLightboxHeaderOptions) => (
        <LightboxHeader
            isMyItem={opts.isMyItem}
            currentItem={currentItem}
            isVideo={isVideo}
            downloadName={downloadName}
            showCloseButton={showCloseButton}
            renderHeaderLeft={renderHeaderLeft}
            showComparisonTabs={showComparisonTabs}
            activeTab={activeTab}
            onActiveTabChange={onActiveTabChange}
            showRemixInput={showRemixInput}
            setShowRemixInput={setShowRemixInput}
            isPublic={visibility.isPublic}
            isPublicLoading={visibility.isPublicLoading}
            handlePublicChange={visibility.handlePublicChange}
            onLikeItemClicked={onLikeItemClicked}
            handleLikeItemClicked={visibility.handleLikeItemClicked}
            canSeeUsage={canSeeUsage}
            tokenUsageOpen={tokenUsageOpen}
            setTokenUsageOpen={setUsageDialogOpen}
            downloading={downloading}
            exporting={exporting}
            copying={copying}
            downloadMedia={downloadMedia}
            copyImage={copyImage}
            exportImageAs={exportImageAs}
            handleDownloadClicked={handleDownloadClicked}
            onDeleteItemAsyncClicked={onDeleteItemAsyncClicked}
            onDeleteClicked={deleteFlow.onDeleteClicked}
            onClose={onClose}
            ellipsisMenuOpen={ellipsisMenuOpen}
            setEllipsisMenuOpen={setEllipsisMenuOpen}
            setExportMenuOpen={setExportMenuOpen}
        />
    );

    return {
        maskSupported,
        maskImage,
        isPublic: visibility.isPublic,
        isPublicLoading: visibility.isPublicLoading,
        isUploadingPenImage: remix.isUploadingPenImage,
        showRemixInput,
        setShowRemixInput,
        showCropExportModal,
        setShowCropExportModal,
        showEditPromptModal: editPrompt.showEditPromptModal,
        setShowEditPromptModal: editPrompt.setShowEditPromptModal,
        openEditPromptModal: editPrompt.openEditPromptModal,
        editPromptValue: editPrompt.editPromptValue,
        setEditPromptValue: editPrompt.setEditPromptValue,
        editPromptTextAreaRef: editPrompt.editPromptTextAreaRef,
        exportMenuOpen,
        setExportMenuOpen,
        downloadMedia,
        downloading,
        copyImage,
        exportImageAs,
        copying,
        exporting,
        blackThemePopupStyle,
        parameterButtonStyles,
        handlePublicChange: visibility.handlePublicChange,
        handleLikeItemClicked: visibility.handleLikeItemClicked,
        handleRemix: remix.handleRemix,
        handleDownloadClicked,
        onDeleteClicked: deleteFlow.onDeleteClicked,
        closeConfirmModal: deleteFlow.closeConfirmModal,
        renderConfirmationModal: deleteFlow.renderConfirmationModal,
        renderLightboxHeader,
        renderEditPromptModal: editPrompt.renderEditPromptModal,
        renderRelatedFilesThumbnails: relatedFiles.renderRelatedFilesThumbnails,
        renderRelatedFilesCarousel: relatedFiles.renderRelatedFilesCarousel,
        relatedCarouselOpen: relatedFiles.relatedCarouselOpen,
        tokenUsageOpen,
    };
}
