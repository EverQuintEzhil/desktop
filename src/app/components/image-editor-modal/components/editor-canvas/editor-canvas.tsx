import { useEffect, useMemo, useRef, type CSSProperties } from 'react';

import { useEditorContext } from '../../context/editor-context';
import {
    useCanvasRenderer,
    useContainerSize,
    useCropHandlers,
    useOffscreenRenderedCanvas,
    useScrollTracking,
    useSourceImage,
    useZoomScroll,
} from '../../hooks';
import type { ActiveMode, DuotoneColors, LutTexture } from '../../types';
import { constrainCropToImageWithMinSize, getRotatedDimensions } from '../../utils/crop-utils';
import { isQuarterTurnRotationDegrees } from '../../utils/tex-transform-utils';
import { CropOverlay } from '../crop';
import { CropSubToolbar } from '../crop-sub-toolbar';
import FitOverlay from '../fit-overlay/fit-overlay';

import './editor-canvas.scss';

export interface EditorCanvasProps {
    activeMode: ActiveMode;
    safeImageUrl: string;
    selectedLut?: LutTexture;
    selectedDuotone?: DuotoneColors;
    exporting: boolean;
    recordSnapshot: () => void;
    onDoneCrop: () => void;
    zoomLevel: number;
    onZoomChange: (level: number) => void;
    onFitZoomComputed: (level: number) => void;
}

const EditorCanvas = (props: EditorCanvasProps) => {
    const {
        activeMode,
        safeImageUrl,
        selectedLut,
        selectedDuotone,
        exporting,
        recordSnapshot,
        onDoneCrop,
        zoomLevel = 100,
        onZoomChange,
        onFitZoomComputed,
    } = props;

    const isCropMode = activeMode === 'crop';
    const BASE_CONTENT_PADDING = 40;

    // Refs
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    // Image source
    const { imageRef, version: imageLoadVersion } = useSourceImage(safeImageUrl);
    const imageWidth = imageRef.current?.naturalWidth || 0;
    const imageHeight = imageRef.current?.naturalHeight || 0;
    const imageDimensions = { width: imageWidth, height: imageHeight };

    // Context
    const {
        cropState,
        updateCropState,
        resetCropState,
        filterEnabled,
        filterIntensity,
        adjustments,
        adjustmentsEnabled,
    } = useEditorContext();

    // Rotation state
    const isQuarterTurnRotation = isQuarterTurnRotationDegrees(cropState.rotation);

    // Dimension calculations
    const viewImageDimensions = getRotatedDimensions(imageDimensions, isQuarterTurnRotation);

    const hasCropForDisplay = !isCropMode && cropState.width > 0 && cropState.height > 0;
    const safeCropForDisplay = constrainCropToImageWithMinSize(
        {
            x: cropState.x,
            y: cropState.y,
            width: cropState.width,
            height: cropState.height,
        },
        imageDimensions,
        1,
    );

    const getZoomBaseDimensions = () => {
        if (!hasCropForDisplay) {
            return viewImageDimensions;
        }

        // In fit mode, cropState.width/height represent the output frame in view space already.
        if (cropState.mode === 'fit') {
            return {
                width: Math.max(1, Math.round(cropState.width)),
                height: Math.max(1, Math.round(cropState.height)),
            };
        }

        return {
            width: Math.max(1, Math.round(safeCropForDisplay.width)),
            height: Math.max(1, Math.round(safeCropForDisplay.height)),
        };
    };

    const zoomBaseDimensions = getZoomBaseDimensions();

    // Crop dependency tracking
    const cropXDep = isCropMode ? 0 : cropState.x;
    const cropYDep = isCropMode ? 0 : cropState.y;
    const cropWDep = isCropMode ? 0 : cropState.width;
    const cropHDep = isCropMode ? 0 : cropState.height;

    // Hooks
    const containerSize = useContainerSize(viewportRef);

    // content padding calculation for mobile responsiveness
    const contentPadding = useMemo(() => {
        const minDim = Math.min(containerSize.width || 0, containerSize.height || 0);

        if (minDim >= 640) return BASE_CONTENT_PADDING;

        const responsive = Math.round(minDim * 0.04);

        return Math.max(12, Math.min(BASE_CONTENT_PADDING, responsive));
    }, [containerSize.width, containerSize.height]);

    const { displaySize, handleWheel } = useZoomScroll({
        imageDimensions: zoomBaseDimensions,
        containerSize,
        zoomLevel,
        onZoomChange,
        onFitZoomComputed,
        scrollAreaRef,
        contentPadding,
    });

    const { scrollPosRef, scrollVersion } = useScrollTracking({
        scrollAreaRef,
        handleWheel,
    });

    const cropHandlers = useCropHandlers({
        imageWidth,
        imageHeight,
        viewImageDimensions,
        cropState,
        updateCropState,
        resetCropState,
        recordSnapshot,
    });

    // Initialize crop state on image load
    useEffect(() => {
        if (imageWidth > 0 && imageHeight > 0) {
            if (cropState.width === 0 || cropState.height === 0) {
                updateCropState({
                    x: 0,
                    y: 0,
                    width: viewImageDimensions.width,
                    height: viewImageDimensions.height,
                });
            }
        }
    }, [imageWidth, imageHeight, cropState.width, cropState.height, updateCropState]);

    // Render offscreen canvas
    const { offscreenCanvasRef, renderVersion } = useOffscreenRenderedCanvas({
        imageRef,
        imageWidth,
        imageHeight,
        isCropMode,
        isQuarterTurnRotation,
        cropState,
        filterEnabled,
        filterIntensity,
        selectedLut,
        selectedDuotone,
        adjustments,
        adjustmentsEnabled,
        deps: [cropXDep, cropYDep, cropWDep, cropHDep, imageLoadVersion],
    });

    // Render to viewport canvas with clipping
    useCanvasRenderer({
        canvasRef,
        offscreenCanvasRef,
        scrollPosRef,
        scrollAreaRef,
        containerSize,
        canvasDisplaySize: displaySize,
        zoomLevel,
        contentPadding,
        renderVersion,
        scrollVersion,
    });

    const renderCropOverlay = () => {
        if (!isCropMode || imageDimensions.width === 0 || imageDimensions.height === 0) {
            return null;
        }

        if (cropState.mode === 'fit') {
            return (
                <FitOverlay
                    crop={{
                        x: cropState.x || 0,
                        y: cropState.y || 0,
                        width: cropState.width || viewImageDimensions.width,
                        height: cropState.height || viewImageDimensions.height,
                    }}
                    imageDimensions={viewImageDimensions}
                    displaySize={displaySize}
                />
            );
        }

        return (
            <CropOverlay
                crop={{
                    x: cropState.x || 0,
                    y: cropState.y || 0,
                    width: cropState.width || viewImageDimensions.width,
                    height: cropState.height || viewImageDimensions.height,
                }}
                imageDimensions={viewImageDimensions}
                displaySize={displaySize}
                aspectRatio={cropState.lockedAspectRatio}
                onCropChange={cropHandlers.handleCropChange}
                onCropStart={recordSnapshot}
            />
        );
    };

    const canvasPaddingStyle = {
        '--canvas-padding': `${contentPadding}px`,
    } as CSSProperties;

    return (
        <div className="editor-canvas-wrapper relative flex flex-1 flex-col overflow-hidden max-lg:h-[calc(100svh-77px-50px)]">
            {isCropMode && (
                <CropSubToolbar
                    activeMode={cropState.mode}
                    onModeChange={cropHandlers.handleModeChange}
                    flipX={cropState.flipX}
                    flipY={cropState.flipY}
                    straightenAngle={cropState.straightenAngle}
                    onStraightenStart={recordSnapshot}
                    onStraightenChange={cropHandlers.handleStraightenChange}
                    onRotate90={cropHandlers.handleRotate90}
                    onToggleFlipX={cropHandlers.handleToggleFlipX}
                    onToggleFlipY={cropHandlers.handleToggleFlipY}
                    onResetCrop={cropHandlers.handleResetCrop}
                    onDone={onDoneCrop}
                    exporting={exporting}
                    downloading={false}
                />
            )}
            <div className="canvas-viewport relative grid h-full w-full flex-1 overflow-hidden" ref={viewportRef}>
                <canvas className="webgl-canvas" ref={canvasRef} aria-label="Editor canvas" />
                <div
                    className="canvas-scroll-area scrollbar-vertical scrollbar-horizontal scrollbar-controller relative z-3 grid h-full w-full"
                    ref={scrollAreaRef}
                >
                    <div className="canvas-content-wrapper" style={canvasPaddingStyle}>
                        <div
                            className="canvas-container relative block"
                            style={{
                                width: `${displaySize.width}px`,
                                height: `${displaySize.height}px`,
                            }}
                        >
                            {renderCropOverlay()}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EditorCanvas;
