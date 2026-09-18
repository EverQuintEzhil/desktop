import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';

import ImageEditorModal from '@/app/components/image-editor-modal';
import { useOverlayManager } from '@/app/hooks';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
import { getFilesBaseUrl } from '@/lib/axios';
import type { GalleryAgentType, FileType } from '@/types/admin';
import type { GeneratedItem } from '@/types/gallery';
import { makeSafeDownloadFilename } from '@/utils';

import { useLightboxMediaActions } from '../../hooks/use-lightbox-media-actions';
import DrawingToolbar from '../drawing-toolbar';
import LightImageTitleSection from '../light-image-title-section';
import RemixInput, { type RemixInputPlusOptions } from '../remix-input';

import LightboxSlide from './lightbox-slide/lightbox-slide';
import useLightboxCarousel from './use-lightbox-carousel';
import './light-box-carousel-image-with-title.scss';

interface PropsType {
    agent: GalleryAgentType;
    isOpen: boolean;
    onClose: () => void;
    onRemix?: (prompt: string, image: GeneratedItem, maskUrl?: string, editedFile?: FileType) => void;
    onEditPromptSubmit?: (prompt: string) => void;
    query?: string;
    setQuery?: (value: string) => void;
    plusOptions?: RemixInputPlusOptions;
    onLikeItemClicked?: (item: GeneratedItem) => void;
    onDeleteItemAsyncClicked?: (item: GeneratedItem) => Promise<GeneratedItem[]>;
    onItemChange?: (item: GeneratedItem) => void;
    startIndex?: number;
    totalItems?: number;
    pages?: number;
    page?: number;
    history?: Array<GeneratedItem>;
    isVideo?: boolean;
    isFetching?: boolean;
    onShowMore?: () => void;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    onChangeFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
    renderFiles: () => React.ReactNode;
    fileInputDisabled: boolean;
    openRemixOnMount?: boolean;
}

const shouldCarouselWatchDrag = (_api: NonNullable<CarouselApi>, event: MouseEvent | TouchEvent): boolean => {
    if (event instanceof MouseEvent) {
        return false;
    }

    const target = event.target;

    return !(target instanceof Element && target.closest('.comparison-container'));
};

const LightBoxCarouselImageWithTitle = (props: PropsType) => {
    const {
        agent,
        isOpen,
        onClose,
        onRemix,
        onEditPromptSubmit,
        query,
        setQuery,
        plusOptions,
        onLikeItemClicked,
        onDeleteItemAsyncClicked,
        onItemChange,
        startIndex,
        pages = 0,
        page = 0,
        history,
        isVideo = false,
        isFetching = false,
        onShowMore,
        fileInputRef,
        onChangeFile,
        renderFiles,
        fileInputDisabled,
        openRemixOnMount = false,
    } = props;

    const [showRemixInput, setShowRemixInput] = useState(openRemixOnMount);
    const [showCropExportModal, setShowCropExportModal] = useState(false);
    const [showEditPromptModal, setShowEditPromptModal] = useState(false);
    const [showTitleModal, setShowTitleModal] = useState(false);
    const [activeTab, setActiveTab] = useState<'original' | 'edited' | 'comparison'>(() =>
        history?.[startIndex ?? 0]?.related_file_ids?.length ? 'comparison' : 'edited',
    );

    const imageWrapperRef = useRef<HTMLDivElement | null>(null);
    const [imageWrapperWidth, setImageWrapperWidth] = useState<number>(400);
    const skipInitialRemixResetRef = useRef(openRemixOnMount);

    const { setApi, currentIndex, isPreviousClickable, isNextClickable, goToPrevImage, goToNextImage, activeVideoRef } =
        useLightboxCarousel({
            startIndex,
            isOpen,
            history,
            isFetching,
            onShowMore,
            pages,
            page,
            isVideo,
        });

    const getNavigationCursor = (isClickable: boolean): string => {
        if (showRemixInput) return 'not-allowed';

        return isClickable ? 'pointer' : 'default';
    };

    const currentItem = history?.[currentIndex] || ({} as GeneratedItem);

    const downloadName = makeSafeDownloadFilename(null, {
        agentName: agent.name,
        createdAt: currentItem?.created_at,
        promptSummary: currentItem?.ai?.arguments?.prompt || currentItem?.title,
    });

    const filesBase = getFilesBaseUrl();
    const filesBaseUrl = filesBase ? `${filesBase}/download` : '';
    const currentItemHasRelatedFile = Boolean(filesBaseUrl && currentItem?.related_file_ids?.[0]);
    const relatedFileIds = currentItem?.related_file_ids ?? [];

    useEffect(() => {
        setActiveTab(currentItemHasRelatedFile ? 'comparison' : 'edited');
    }, [currentIndex, currentItemHasRelatedFile]);

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

    const actions = useLightboxMediaActions({
        isOpen,
        isVideo,
        currentItem,
        downloadName,
        agentId: agent?._id,
        agentUiConfig: agent?.uiConfig,
        onClose,
        onRemix,
        onEditPromptSubmit,
        onLikeItemClicked,
        onItemChange,
        onDeleteItemAsyncClicked,
        escapeClosesLightbox: false,
        onAfterDelete: (remaining) => {
            if (!remaining?.length) {
                onClose();
            } else if (isPreviousClickable) {
                goToPrevImage();
            }
        },
        controlledShowRemixInput: showRemixInput,
        controlledSetShowRemixInput: setShowRemixInput,
        controlledShowCropExportModal: showCropExportModal,
        controlledSetShowCropExportModal: setShowCropExportModal,
        controlledShowEditPromptModal: showEditPromptModal,
        controlledSetShowEditPromptModal: setShowEditPromptModal,
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

    const title = currentItem?.ai?.arguments?.prompt || currentItem?.title || '';
    const isMyItem = currentItem?.isMyItem || false;
    const {
        maskSupported,
        maskImage,
        blackThemePopupStyle,
        renderLightboxHeader,
        renderConfirmationModal,
        openEditPromptModal,
        renderEditPromptModal,
        renderRelatedFilesThumbnails,
        renderRelatedFilesCarousel,
        relatedCarouselOpen,
        tokenUsageOpen,
    } = actions;

    const handleActiveContainerRef = useCallback(
        (el: HTMLDivElement | null) => {
            maskImage.setMaskTargetEl(el);
            imageWrapperRef.current = el;
        },
        [maskImage.setMaskTargetEl],
    );

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (
                relatedCarouselOpen ||
                showRemixInput ||
                showCropExportModal ||
                showEditPromptModal ||
                showTitleModal ||
                tokenUsageOpen
            )
                return;

            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                goToNextImage();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                goToPrevImage();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown, true);
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown, true);
        };
    }, [
        isOpen,
        onClose,
        relatedCarouselOpen,
        showRemixInput,
        showCropExportModal,
        showEditPromptModal,
        showTitleModal,
        tokenUsageOpen,
        goToNextImage,
        goToPrevImage,
    ]);

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

    useEffect(() => {
        if (skipInitialRemixResetRef.current) {
            skipInitialRemixResetRef.current = false;

            return;
        }

        setShowRemixInput(false);
    }, [currentIndex]);

    if (!isOpen) {
        return null;
    }

    return (
        <>
            <div className="lightbox-overlay flex flex-col py-3" onClick={(e) => e.stopPropagation()}>
                <div className="lightbox-content flex h-full flex-col">
                    {renderLightboxHeader({ isMyItem })}
                    <Carousel
                        setApi={setApi}
                        opts={{
                            align: 'center',
                            loop: false,
                            containScroll: false,
                            watchDrag: showRemixInput ? false : shouldCarouselWatchDrag,
                        }}
                        className={['lightbox-image-slider flex-1 min-h-0 py-6', showRemixInput ? 'remix-open' : '']
                            .filter(Boolean)
                            .join(' ')}
                    >
                        <CarouselContent className="lightbox-carousel-content">
                            {(history ?? []).map((item, index) => {
                                const isCenter = index === currentIndex;
                                const isLeftAdj = index === currentIndex - 1;
                                const isRightAdj = index === currentIndex + 1;
                                const isOffscreen = !isCenter && !isLeftAdj && !isRightAdj;

                                const slideClass = [
                                    'lightbox-carousel-slide',
                                    isCenter ? 'current-image' : '',
                                    isLeftAdj ? 'is-left-adj' : '',
                                    isRightAdj ? 'is-right-adj' : '',
                                    isOffscreen ? 'is-offscreen' : '',
                                ]
                                    .filter(Boolean)
                                    .join(' ');

                                return (
                                    <CarouselItem key={item._id ?? index} className={slideClass}>
                                        <div className="lightbox-carousel-slide-panel">
                                            <LightboxSlide
                                                item={item}
                                                index={index}
                                                isActiveSlide={isCenter}
                                                isVideo={isVideo}
                                                showRemixInput={showRemixInput}
                                                maskSupported={maskSupported}
                                                maskImage={maskImage}
                                                activeTab={activeTab}
                                                filesBaseUrl={filesBaseUrl}
                                                activeVideoRef={activeVideoRef}
                                                onActiveContainerRef={handleActiveContainerRef}
                                            />
                                        </div>
                                    </CarouselItem>
                                );
                            })}
                        </CarouselContent>
                        {!showRemixInput && (
                            <div
                                className="previous-navigation"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (isPreviousClickable) {
                                        goToPrevImage();
                                    }
                                }}
                                style={{ cursor: getNavigationCursor(isPreviousClickable) }}
                            />
                        )}
                        {!showRemixInput && (
                            <div
                                className="next-navigation"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (!isFetching && isNextClickable) {
                                        goToNextImage();
                                    }
                                }}
                                style={{ cursor: getNavigationCursor(isNextClickable) }}
                            />
                        )}
                        {!showRemixInput && (
                            <button
                                className="mobile-nav-arrow mobile-nav-arrow--prev"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    goToPrevImage();
                                }}
                                disabled={!isPreviousClickable}
                                aria-label="Previous image"
                            >
                                <ChevronLeft size={24} />
                            </button>
                        )}
                        {!showRemixInput && (
                            <button
                                className="mobile-nav-arrow mobile-nav-arrow--next"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    goToNextImage();
                                }}
                                disabled={!isNextClickable || isFetching}
                                aria-label="Next image"
                            >
                                <ChevronRight size={24} />
                            </button>
                        )}
                    </Carousel>
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
                    <div className="flex w-full flex-col items-center justify-center gap-2">
                        {!showRemixInput && (
                            <div className="lightbox-title-row flex w-[50vw] flex-col gap-2 max-lg:w-full max-lg:max-w-[810px] max-lg:px-4">
                                {renderRelatedFilesThumbnails()}
                                <LightImageTitleSection
                                    title={title}
                                    isRemixAvailable={Boolean(onRemix && !currentItem?.isRunning)}
                                    onTitleModalOpenChange={setShowTitleModal}
                                />
                            </div>
                        )}
                        {!currentItem?.isRunning && agent && query !== undefined && setQuery && plusOptions && (
                            <RemixInput
                                agent={agent}
                                showRemixInput={showRemixInput}
                                onToggle={(e) => {
                                    e.stopPropagation();
                                    setShowRemixInput(!showRemixInput);
                                }}
                                onRemix={onRemix ? actions.handleRemix : undefined}
                                query={query}
                                setQuery={setQuery}
                                plusOptions={plusOptions}
                                plusDropdownPopupStyles={blackThemePopupStyle}
                                modelSelectorPopupStyles={`${blackThemePopupStyle}
                                        padding: 0;
                                        overflow: hidden;
                                    `}
                                parameterSelectPopupStyles={`${blackThemePopupStyle} padding: 0; .select-list { padding: 0; }`}
                                parameterStepperPopupStyles={blackThemePopupStyle}
                                parameterButtonStyles={actions.parameterButtonStyles}
                                onEditPromptClick={openEditPromptModal}
                                isVideo={isVideo}
                                onCreateVideoClick={
                                    currentItem?._id
                                        ? (e) => {
                                              e.stopPropagation();
                                              if (agent.uiConfig?.videoAgentSlug) {
                                                  window.open(
                                                      `${window.location.origin}/agent/${agent.uiConfig.videoAgentSlug}?fileId=${currentItem._id}`,
                                                      '_blank',
                                                      'noopener,noreferrer',
                                                  );
                                              }
                                          }
                                        : undefined
                                }
                                isDarkMode={true}
                                isLoading={actions.isUploadingPenImage || fileInputDisabled}
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
            {showCropExportModal && (
                <ImageEditorModal
                    imageUrl={currentItem?.url}
                    imageName={downloadName || 'generated-image'}
                    isOpen={true}
                    onClose={() => setShowCropExportModal(false)}
                />
            )}
            {agent && setQuery && plusOptions && renderEditPromptModal({ agent, setQuery, plusOptions })}
            {renderConfirmationModal('Are you sure you want to Delete ?')}
            {renderRelatedFilesCarousel()}
        </>
    );
};

export default LightBoxCarouselImageWithTitle;
