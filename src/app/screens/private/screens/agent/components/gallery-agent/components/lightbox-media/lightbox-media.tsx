import { useEffect, useRef, useState } from 'react';

import ImageComparisonSlider from '@/app/components/image-comparison-slider';
import ImageEditorModal from '@/app/components/image-editor-modal';
import Video from '@/app/components/video';
import { useOverlayManager } from '@/app/hooks';
import Image from '@/components/image';
import { getFilesBaseUrl } from '@/lib/axios';
import type { GalleryAgentType, FileType } from '@/types/admin';
import type { GeneratedItem } from '@/types/gallery';

import { useLightboxMediaActions } from '../../hooks/use-lightbox-media-actions';
import DrawingToolbar from '../drawing-toolbar';
import LightImageTitleSection from '../light-image-title-section';
import { MaskCursorPenCrosshair } from '../mask-cursor-pen-crosshair/mask-cursor-pen-crosshair';
import RemixInput, { type RemixInputPlusOptions } from '../remix-input';

import './lightbox-media.scss';

export interface LightboxMediaProps {
    lightboxImage: GeneratedItem | null;
    isOpen: boolean;
    isVideo?: boolean;
    onClose: () => void;
    downloadName?: string;
    onDeleteItemAsyncClicked?: (item: GeneratedItem) => Promise<GeneratedItem[]>;
    agent?: GalleryAgentType;
    onRemix?: (prompt: string, image: GeneratedItem, maskUrl?: string, editedFile?: FileType) => void;
    onEditPromptSubmit?: (prompt: string) => void;
    query?: string;
    setQuery?: (value: string) => void;
    plusOptions?: RemixInputPlusOptions;
    onLikeItemClicked?: (item: GeneratedItem) => void;
    onItemChange?: (item: GeneratedItem) => void;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    onChangeFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
    renderFiles: () => React.ReactNode;
    fileInputDisabled: boolean;
    escapeClosesLightbox?: boolean;
    showCloseButton?: boolean;
    renderHeaderLeft?: () => React.ReactNode;
    openRemixOnMount?: boolean;
}

export interface LightboxMediaFileIdProps extends Omit<LightboxMediaProps, 'lightboxImage'> {
    fileId: string;
}

const LightboxMedia = (props: LightboxMediaProps) => {
    const {
        lightboxImage,
        isOpen,
        isVideo = false,
        onClose,
        downloadName,
        onDeleteItemAsyncClicked,
        agent,
        onRemix,
        onEditPromptSubmit,
        query,
        setQuery,
        plusOptions,
        onLikeItemClicked,
        onItemChange,
        fileInputRef,
        onChangeFile,
        renderFiles,
        fileInputDisabled,
        escapeClosesLightbox = true,
        showCloseButton = true,
        renderHeaderLeft,
        openRemixOnMount = false,
    } = props;

    const filesBase = getFilesBaseUrl();
    const filesBaseUrl = filesBase ? `${filesBase}/download` : '';
    const currentItemHasRelatedFile = Boolean(filesBaseUrl && lightboxImage?.related_file_ids?.[0]);
    const relatedFileId = lightboxImage?.related_file_ids?.[0];
    const relatedFileIds = lightboxImage?.related_file_ids ?? [];
    const originalImageUrl =
        currentItemHasRelatedFile && relatedFileId ? `${filesBaseUrl}/${relatedFileId}` : undefined;

    const [activeTab, setActiveTab] = useState<'original' | 'edited' | 'comparison'>(() =>
        lightboxImage?.related_file_ids?.length ? 'comparison' : 'edited',
    );

    const [imageWrapperWidth, setImageWrapperWidth] = useState<number>(400);
    const imageWrapperRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        setActiveTab(currentItemHasRelatedFile ? 'comparison' : 'edited');
    }, [lightboxImage?._id, currentItemHasRelatedFile]);

    useEffect(() => {
        const el = imageWrapperRef.current;

        if (!el) return;
        const observer = new ResizeObserver((entries) => {
            const width = entries[0]?.contentRect.width;

            if (width) setImageWrapperWidth(width);
        });

        observer.observe(el);

        return () => observer.disconnect();
    }, []);

    const {
        maskSupported,
        maskImage,
        isUploadingPenImage,
        showRemixInput,
        setShowRemixInput,
        showCropExportModal,
        setShowCropExportModal,
        openEditPromptModal,
        renderEditPromptModal,
        blackThemePopupStyle,
        parameterButtonStyles,
        handleRemix,
        renderConfirmationModal,
        renderLightboxHeader,
        renderRelatedFilesThumbnails,
        renderRelatedFilesCarousel,
    } = useLightboxMediaActions({
        isOpen,
        isVideo,
        currentItem: lightboxImage,
        downloadName,
        agentId: agent?._id,
        agentUiConfig: agent?.uiConfig,
        onClose,
        onRemix,
        onEditPromptSubmit,
        onLikeItemClicked,
        onItemChange,
        onDeleteItemAsyncClicked,
        escapeClosesLightbox,
        showCloseButton,
        renderHeaderLeft,
        onAfterDelete: onClose,
        initialShowRemixInput: openRemixOnMount,
        showComparisonTabs: !isVideo && currentItemHasRelatedFile,
        activeTab,
        onActiveTabChange: setActiveTab,
        relatedFileIds,
        onChangeFile,
        renderFiles,
        fileInputDisabled,
        selectedModel: plusOptions?.selectedModel?.value,
        setDefaultParameters: plusOptions?.setDefaultParameters,
        resetDefaultParameters: plusOptions?.resetDefaultParameters,
    });

    useOverlayManager(isOpen);

    const showBrush = Boolean(plusOptions?.selectedModel?.value?.options?.mask);

    useEffect(() => {
        if (showBrush && maskImage.toolMode === 'pen') {
            maskImage.setToolMode('brush');
            maskImage.clearMask();
        } else if (!showBrush && maskImage.toolMode === 'brush') {
            maskImage.setToolMode('pen');
            maskImage.clearMask();
        }
    }, [showBrush, maskImage.toolMode, maskImage.setToolMode, maskImage.clearMask]);

    const mediaUrl = lightboxImage?.url;
    const title = lightboxImage?.title ?? '';
    const isMyItem = lightboxImage?.isMyItem ?? false;

    if (!isOpen) return null;

    const renderMedia = () => {
        if (lightboxImage?.isRunning) {
            return (
                <div className="lightbox-state-content lightbox-running w-full">
                    <div className="mx-auto flex h-full max-w-[74vw] flex-col items-center justify-center gap-4 bg-white/20">
                        <div className="lightbox-loading-spinner" />
                        <span className="text-sm text-white">Loading...</span>
                    </div>
                </div>
            );
        }

        if (!mediaUrl && !originalImageUrl) return null;

        if (isVideo) {
            return (
                <Video
                    hideThumbnail={true}
                    src={mediaUrl}
                    playsInline
                    loop
                    autoPlay
                    muted
                    thumbnail={`${mediaUrl}?thumbnail=true`}
                    showOnlyThumbnail={false}
                    controls
                    loadingOption="thumbnail"
                    className="lightbox-media-video max-h-full max-w-[74vw] object-contain"
                />
            );
        }

        const hasRelatedFile = currentItemHasRelatedFile && originalImageUrl;
        const showComparisonSlider = hasRelatedFile && !showRemixInput && activeTab === 'comparison';
        const showSingleOriginalOrEdited = hasRelatedFile && !showRemixInput && activeTab !== 'comparison';
        const imageAspectRatio =
            lightboxImage?.meta?.aspect_ratio ??
            (lightboxImage?.meta?.width && lightboxImage?.meta?.height
                ? lightboxImage.meta.width / lightboxImage.meta.height
                : 1);
        const singleImageSrc =
            showSingleOriginalOrEdited && activeTab === 'original' ? originalImageUrl : (mediaUrl ?? '');

        if (showComparisonSlider && originalImageUrl) {
            return (
                <div
                    className="comparison-slider-wrapper flex h-full items-center justify-center"
                    style={{
                        aspectRatio: String(imageAspectRatio),
                        width: `min(74vw, calc((100svh - 40px - 37px - 88px - 48px) * ${imageAspectRatio}))`,
                    }}
                >
                    <ImageComparisonSlider originalSrc={originalImageUrl} editedSrc={mediaUrl ?? ''} alt={title} />
                </div>
            );
        }

        return (
            <div
                className={`image-container lightbox-image-container relative inline-flex h-full leading-none items-center${showRemixInput && maskSupported ? ' remix-active' : ''}`}
                ref={(el) => {
                    maskImage.setMaskTargetEl(el as HTMLDivElement);
                    imageWrapperRef.current = el;
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <Image
                    src={showSingleOriginalOrEdited ? singleImageSrc : (mediaUrl ?? '')}
                    alt={title}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="/assets/images/broken-image.svg"
                    className="lightbox-image lightbox-image-content block h-full max-h-full w-auto max-w-full cursor-pointer object-contain"
                />
                {showRemixInput && maskSupported && (
                    <>
                        <canvas
                            className="mask-canvas"
                            ref={maskImage.maskCanvasRef}
                            onPointerDown={maskImage.onMaskPointerDown}
                            onPointerMove={maskImage.onMaskPointerMove}
                            onPointerUp={maskImage.onMaskPointerUp}
                            onPointerCancel={maskImage.onMaskPointerUp}
                            onPointerLeave={maskImage.onMaskPointerLeave}
                        />
                        <canvas className="mask-preview-canvas" ref={maskImage.maskPreviewCanvasRef} />
                        <canvas className="pen-canvas" ref={maskImage.penCanvasRef} />
                        <svg
                            ref={maskImage.maskCursorRef}
                            className={`mask-cursor mask-cursor--${maskImage.penToolSize}${maskImage.toolMode === 'pen' ? ' is-pen' : ''}`}
                            style={{
                                width: `${maskImage.activeCursorSize}px`,
                                height: `${maskImage.activeCursorSize}px`,
                            }}
                            viewBox="0 0 100 100"
                            aria-hidden="true"
                        >
                            {maskImage.toolMode !== 'pen' && (
                                <circle className="mask-cursor-ring" cx="50" cy="50" r="47" />
                            )}
                            {maskImage.toolMode === 'pen' && <MaskCursorPenCrosshair />}
                        </svg>
                    </>
                )}
            </div>
        );
    };

    return (
        <>
            <div
                className="lightbox-overlay flex flex-col py-3"
                onClick={(e) => {
                    e.stopPropagation();
                }}
            >
                <div className="lightbox-content flex h-full flex-col">
                    {renderLightboxHeader({ isMyItem })}
                    <div
                        className={[
                            'lightbox-media-container lightbox-image-slider flex-1 min-h-0 py-6',
                            'relative w-full flex items-center justify-center',
                            showRemixInput ? 'remix-open' : '',
                        ]
                            .filter(Boolean)
                            .join(' ')}
                    >
                        {renderMedia()}
                    </div>
                    {showRemixInput && maskSupported && !isVideo && (
                        <DrawingToolbar
                            toolMode={maskImage.toolMode}
                            setToolMode={maskImage.setToolMode}
                            penColor={maskImage.penColor}
                            setPenColor={maskImage.setPenColor}
                            penSize={maskImage.toolMode === 'brush' ? maskImage.brushToolSize : maskImage.penToolSize}
                            setPenSize={
                                maskImage.toolMode === 'brush' ? maskImage.setBrushToolSize : maskImage.setPenToolSize
                            }
                            canUndo={maskImage.canUndo}
                            canRedo={maskImage.canRedo}
                            onUndo={maskImage.undo}
                            onRedo={maskImage.redo}
                            onClear={maskImage.clearMask}
                            containerWidth={imageWrapperWidth}
                            showBrush={showBrush}
                        />
                    )}
                    <div className="flex w-full flex-col items-center gap-2">
                        {!showRemixInput && (
                            <div className="lightbox-title-row flex w-[50vw] flex-col gap-2 max-lg:w-full max-lg:max-w-[810px] max-lg:px-4">
                                {renderRelatedFilesThumbnails()}
                                <LightImageTitleSection
                                    title={title || 'Untitled'}
                                    isRemixAvailable={Boolean(onRemix && !lightboxImage?.isRunning)}
                                />
                            </div>
                        )}
                        {!lightboxImage?.isRunning && agent && query !== undefined && setQuery && plusOptions && (
                            <RemixInput
                                agent={agent}
                                showRemixInput={showRemixInput}
                                onToggle={(e) => {
                                    e.stopPropagation();
                                    setShowRemixInput(!showRemixInput);
                                }}
                                onRemix={onRemix ? handleRemix : undefined}
                                query={query}
                                setQuery={setQuery}
                                plusOptions={plusOptions}
                                plusDropdownPopupStyles={blackThemePopupStyle}
                                modelSelectorPopupStyles={`${blackThemePopupStyle} padding: 0; overflow: hidden;`}
                                parameterSelectPopupStyles={`${blackThemePopupStyle} padding: 0; .select-list { padding: 0; }`}
                                parameterStepperPopupStyles={blackThemePopupStyle}
                                parameterButtonStyles={parameterButtonStyles}
                                onEditPromptClick={openEditPromptModal}
                                isVideo={isVideo}
                                onCreateVideoClick={
                                    lightboxImage?._id
                                        ? (e) => {
                                              e.stopPropagation();
                                              if (agent.uiConfig?.videoAgentSlug) {
                                                  window.open(
                                                      `${window.location.origin}/agent/${agent.uiConfig.videoAgentSlug}?fileId=${lightboxImage._id}`,
                                                      '_blank',
                                                      'noopener,noreferrer',
                                                  );
                                              }
                                          }
                                        : undefined
                                }
                                isDarkMode={true}
                                isLoading={isUploadingPenImage || fileInputDisabled}
                                fileInputDisabled={fileInputDisabled}
                                renderFiles={renderFiles}
                            />
                        )}
                        <input
                            ref={fileInputRef}
                            className="file-upload hidden"
                            accept="image/*"
                            multiple
                            onChange={onChangeFile}
                            type="file"
                            disabled={fileInputDisabled}
                        />
                    </div>
                </div>
            </div>
            {showCropExportModal && mediaUrl && (
                <ImageEditorModal
                    imageUrl={mediaUrl}
                    imageName={downloadName || 'generated-image'}
                    isOpen
                    onClose={() => setShowCropExportModal(false)}
                />
            )}
            {agent && setQuery && plusOptions && renderEditPromptModal({ agent, setQuery, plusOptions })}
            {renderConfirmationModal('Are you sure you want to delete?')}
            {renderRelatedFilesCarousel()}
        </>
    );
};

export default LightboxMedia;
export { default as LightboxMediaFileId } from './components/lightbox-media-file-id/lightbox-media-file-id';
