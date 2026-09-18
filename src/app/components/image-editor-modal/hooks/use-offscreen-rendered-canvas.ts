import { useEffect, useRef, useState } from 'react';

import type { Adjustments, CropState, DuotoneColors, LutTexture } from '../types';
import { isWebGLSupported, renderImageWithCropAndFilters2D, renderImageWithCropAndFilters } from '../utils';
import { getRotatedDimensions } from '../utils/crop-utils';
import { mapCropBoxFromRotatedSpaceForRotation } from '../utils/rotation-crop-mapping';
import { webglCache } from '../utils/webgl-cache';

interface UseOffscreenRenderedCanvasArgs {
    imageRef: React.RefObject<HTMLImageElement | null>;
    imageWidth: number;
    imageHeight: number;
    isCropMode: boolean;
    isQuarterTurnRotation: boolean;
    cropState: CropState;
    filterEnabled: boolean;
    filterIntensity: number;
    selectedLut?: LutTexture;
    selectedDuotone?: DuotoneColors;
    adjustments: Adjustments;
    adjustmentsEnabled: boolean;
    deps?: unknown[];
}

export const useOffscreenRenderedCanvas = (args: UseOffscreenRenderedCanvasArgs) => {
    const {
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
        deps = [],
    } = args;

    const fullWebglCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const cropped2dCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const [renderVersion, setRenderVersion] = useState(0);
    const webglSupportedRef = useRef<boolean | null>(null);

    // Check WebGL support once
    if (webglSupportedRef.current === null) {
        webglSupportedRef.current = isWebGLSupported();
        if (!webglSupportedRef.current) {
            // eslint-disable-next-line no-console
            console.info('WebGL not supported, using Canvas 2D renderer');
        }
    }

    useEffect(() => {
        return () => {
            webglCache.destroyCache(fullWebglCanvasRef.current);
        };
    }, []);

    useEffect(() => {
        if (!imageWidth || !imageHeight) return;

        const img = imageRef.current;

        if (!img) return;

        if (!fullWebglCanvasRef.current) fullWebglCanvasRef.current = document.createElement('canvas');
        if (!cropped2dCanvasRef.current) cropped2dCanvasRef.current = document.createElement('canvas');

        const fullWebglCanvas = fullWebglCanvasRef.current!;
        const cropped2dCanvas = cropped2dCanvasRef.current!;

        // Map viewport-space crop to image-space crop for the renderer
        const viewDims = getRotatedDimensions({ width: imageWidth, height: imageHeight }, isQuarterTurnRotation);

        const cropInView = {
            x: cropState.x || 0,
            y: cropState.y || 0,
            width: cropState.width || viewDims.width,
            height: cropState.height || viewDims.height,
        };

        const cropInImageSpace = mapCropBoxFromRotatedSpaceForRotation(
            cropInView,
            imageWidth,
            imageHeight,
            cropState.rotation,
        );

        const renderParams = {
            image: img,
            imageWidth,
            imageHeight,
            cropState: { ...cropState, ...cropInImageSpace },
            isCropMode,
            filterEnabled,
            filterIntensity,
            selectedLut,
            selectedDuotone,
            adjustments,
            adjustmentsEnabled,
            fullCanvasOutput: fullWebglCanvas,
            croppedCanvasOutput: cropped2dCanvas,
            isExport: false,
            originalCropState: cropState,
        };

        // Choose renderer based on WebGL support
        const renderPromise = webglSupportedRef.current
            ? renderImageWithCropAndFilters(renderParams)
            : renderImageWithCropAndFilters2D(renderParams);

        renderPromise
            .then((resultCanvas) => {
                offscreenCanvasRef.current = resultCanvas;
                setRenderVersion((v) => v + 1);
            })
            .catch((error) => {
                console.error('Error rendering image:', error);
            });
    }, [
        imageWidth,
        imageHeight,
        imageRef,
        isCropMode,
        isQuarterTurnRotation,
        cropState.rotation,
        cropState.straightenAngle,
        cropState.flipX,
        cropState.flipY,
        filterEnabled,
        filterIntensity,
        selectedLut,
        selectedDuotone,
        adjustments,
        adjustmentsEnabled,
        ...deps,
    ]);

    return { offscreenCanvasRef, renderVersion };
};
