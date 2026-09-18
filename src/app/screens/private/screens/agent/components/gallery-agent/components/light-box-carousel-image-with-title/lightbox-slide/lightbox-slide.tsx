import React from 'react';

import ImageComparisonSlider from '@/app/components/image-comparison-slider';
import Video from '@/app/components/video';
import type { UseMaskImageResult } from '@/app/screens/private/screens/agent/components/gallery-agent/hooks/use-mask-image';
import Image from '@/components/image';
import type { GeneratedItem } from '@/types/gallery';

import { MaskCursorPenCrosshair } from '../../mask-cursor-pen-crosshair/mask-cursor-pen-crosshair';

type MaskImageSlice = Pick<
    UseMaskImageResult,
    | 'maskCanvasRef'
    | 'maskPreviewCanvasRef'
    | 'penCanvasRef'
    | 'maskCursorRef'
    | 'onMaskPointerDown'
    | 'onMaskPointerMove'
    | 'onMaskPointerUp'
    | 'onMaskPointerLeave'
    | 'penToolSize'
    | 'toolMode'
    | 'activeCursorSize'
>;

interface LightboxSlideProps {
    item: GeneratedItem | undefined;
    index: number;
    isActiveSlide: boolean;
    isVideo: boolean;
    showRemixInput: boolean;
    maskSupported: boolean;
    maskImage: MaskImageSlice;
    activeTab: 'original' | 'edited' | 'comparison';
    filesBaseUrl: string;
    activeVideoRef: React.RefObject<HTMLVideoElement | null>;
    onActiveContainerRef: (el: HTMLDivElement | null) => void;
}

const LightboxSlide = ({
    item,
    index,
    isActiveSlide,
    isVideo,
    showRemixInput,
    maskSupported,
    maskImage,
    activeTab,
    filesBaseUrl,
    activeVideoRef,
    onActiveContainerRef,
}: LightboxSlideProps) => {
    if (item?.isRunning) {
        return (
            <div className="lightbox-state-content lightbox-running flex h-full w-full items-center justify-center">
                <div className="flex h-full w-full max-w-[74vw] flex-col items-center justify-center gap-4 bg-white/20">
                    <div className="lightbox-loading-spinner" />
                    <span className="text-sm">Loading...</span>
                </div>
            </div>
        );
    }

    if (isVideo) {
        return (
            <Video
                hideThumbnail={isActiveSlide}
                ref={(videoEl) => {
                    if (isActiveSlide) {
                        activeVideoRef.current = videoEl;
                        videoEl?.play().catch(() => {});
                    } else if (activeVideoRef.current === videoEl) {
                        activeVideoRef.current = null;
                    }

                    if (videoEl && !isActiveSlide) {
                        videoEl.pause();
                    }
                }}
                src={item?.url}
                playsInline
                loop
                autoPlay={isActiveSlide}
                thumbnail={`${item?.url}?thumbnail=true`}
                showOnlyThumbnail={!isActiveSlide}
                controls={isActiveSlide}
                loadingOption="thumbnail"
                className="lightbox-carousel-video"
            />
        );
    }

    const relatedFileId = item?.related_file_ids?.[0];
    const hasRelatedFile = Boolean(filesBaseUrl && relatedFileId);
    const originalImageUrl = hasRelatedFile ? `${filesBaseUrl}/${relatedFileId}` : undefined;

    const showComparisonSlider =
        hasRelatedFile && originalImageUrl && !showRemixInput && (!isActiveSlide || activeTab === 'comparison');
    const showSingleOriginalOrEdited =
        hasRelatedFile && originalImageUrl && !showRemixInput && isActiveSlide && activeTab !== 'comparison';
    const imageSrc = showSingleOriginalOrEdited && activeTab === 'original' ? originalImageUrl : (item?.url ?? '');
    const imageAlt = item?.title || index.toString();
    const imageAspectRatio =
        item?.meta?.aspect_ratio ?? (item?.meta?.width && item?.meta?.height ? item.meta.width / item.meta.height : 1);

    const showMaskOverlay = isActiveSlide && showRemixInput && maskSupported;

    return (
        <div
            ref={(el) => {
                if (isActiveSlide) {
                    onActiveContainerRef(el);
                }
            }}
            className={`image-container lightbox-image-container${showMaskOverlay ? ' remix-active' : ''}`}
            onClick={(e) => e.stopPropagation()}
        >
            {showComparisonSlider && (
                <div
                    className="comparison-slider-wrapper flex h-full items-center justify-center"
                    style={
                        {
                            aspectRatio: imageAspectRatio,
                            width: `min(74vw, calc((100svh - 40px - 37px - 88px - 48px) * ${imageAspectRatio}))`,
                        } as React.CSSProperties
                    }
                >
                    <ImageComparisonSlider originalSrc={originalImageUrl!} editedSrc={item?.url ?? ''} alt={imageAlt} />
                </div>
            )}
            {!showComparisonSlider && (
                <Image
                    src={imageSrc}
                    alt={imageAlt}
                    onClick={(e) => e.stopPropagation()}
                    placeholder={'/assets/images/broken-image.svg'}
                    className="lightbox-image-content"
                />
            )}
            {showMaskOverlay && (
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
                        {maskImage.toolMode !== 'pen' && <circle className="mask-cursor-ring" cx="50" cy="50" r="47" />}
                        {maskImage.toolMode === 'pen' && <MaskCursorPenCrosshair />}
                    </svg>
                </>
            )}
        </div>
    );
};

export default LightboxSlide;
