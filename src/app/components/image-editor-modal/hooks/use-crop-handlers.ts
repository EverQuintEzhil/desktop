import { useCallback } from 'react';

import type { CropState } from '../types';
import type { CropBox, ImageDimensions } from '../utils/crop-utils';
import {
    calculateCropAfterRotate90,
    constrainCropToImageWithMinSize,
    fitCropUniformToBounds,
    getRotatedDimensions,
} from '../utils/crop-utils';
import { isQuarterTurnRotationDegrees, normalizeRotationDegrees } from '../utils/tex-transform-utils';

interface UseCropHandlersParams {
    imageWidth: number;
    imageHeight: number;
    viewImageDimensions: ImageDimensions;
    cropState: CropState;
    updateCropState: (updates: Partial<CropState>) => void;
    resetCropState: () => void;
    recordSnapshot: () => void;
}

export const useCropHandlers = (params: UseCropHandlersParams) => {
    const { imageWidth, imageHeight, viewImageDimensions, cropState, updateCropState, resetCropState, recordSnapshot } =
        params;

    const handleCropChange = useCallback(
        (newCrop: CropBox) => {
            const fit = fitCropUniformToBounds(newCrop, viewImageDimensions);
            const constrained = constrainCropToImageWithMinSize(fit, viewImageDimensions, 1);

            updateCropState({
                x: constrained.x,
                y: constrained.y,
                width: constrained.width,
                height: constrained.height,
            });
        },
        [viewImageDimensions, updateCropState],
    );

    const handleRotate90 = useCallback(() => {
        recordSnapshot();
        const nextRotation = normalizeRotationDegrees(cropState.rotation + 90);

        if (imageWidth > 0 && imageHeight > 0) {
            if (cropState.mode === 'fit') {
                // In fit mode, rotating the image should NOT rotate the frame's aspect orientation.
                // Instead, keep the target aspect ratio the same and recompute the minimal frame
                // (in view space) that contains the rotated image when the image is fitted inside.
                const nextQuarter = isQuarterTurnRotationDegrees(nextRotation);
                const nextView = getRotatedDimensions({ width: imageWidth, height: imageHeight }, nextQuarter);

                const imageW = Math.max(1, nextView.width);
                const imageH = Math.max(1, nextView.height);
                const imageRatio = imageW / imageH;
                const ratio = cropState.lockedAspectRatio;
                const targetRatio = ratio && Number.isFinite(ratio) && ratio > 0 ? ratio : imageRatio;

                let w: number;
                let h: number;

                if (targetRatio < imageRatio) {
                    // Target is taller than image: match width, extend height.
                    w = imageW;
                    h = w / targetRatio;
                } else {
                    // Target is wider than image: match height, extend width.
                    h = imageH;
                    w = h * targetRatio;
                }

                updateCropState({
                    rotation: nextRotation,
                    x: (imageW - w) / 2,
                    y: (imageH - h) / 2,
                    width: w,
                    height: h,
                });

                return;
            }

            const currentCrop: CropBox = {
                x: cropState.x || 0,
                y: cropState.y || 0,
                width: cropState.width || viewImageDimensions.width,
                height: cropState.height || viewImageDimensions.height,
            };

            const nextCrop = calculateCropAfterRotate90(currentCrop, viewImageDimensions, cropState.lockedAspectRatio);

            updateCropState({
                rotation: nextRotation,
                x: nextCrop.x,
                y: nextCrop.y,
                width: nextCrop.width,
                height: nextCrop.height,
            });

            return;
        }

        updateCropState({ rotation: nextRotation });
    }, [recordSnapshot, cropState, viewImageDimensions, imageWidth, imageHeight, updateCropState]);

    const handleToggleFlipX = useCallback(() => {
        recordSnapshot();
        updateCropState({ flipX: !cropState.flipX });
    }, [recordSnapshot, cropState.flipX, updateCropState]);

    const handleToggleFlipY = useCallback(() => {
        recordSnapshot();
        updateCropState({ flipY: !cropState.flipY });
    }, [recordSnapshot, cropState.flipY, updateCropState]);

    const handleStraightenChange = useCallback(
        (value: number) => {
            updateCropState({ straightenAngle: value });
        },
        [updateCropState],
    );

    const handleResetCrop = useCallback(() => {
        recordSnapshot();
        resetCropState();
    }, [recordSnapshot, resetCropState]);

    const handleModeChange = useCallback(
        (mode: 'crop' | 'fit') => {
            if (mode === cropState.mode) return;

            recordSnapshot();

            const imageW = Math.max(1, viewImageDimensions.width);
            const imageH = Math.max(1, viewImageDimensions.height);
            const imageRatio = imageW / imageH;
            const ratio = cropState.lockedAspectRatio;
            const targetRatio = ratio && Number.isFinite(ratio) && ratio > 0 ? ratio : imageRatio;

            if (mode === 'fit') {
                let w: number;
                let h: number;

                // Smallest frame (at the requested aspect) that contains the entire image when fitted inside.
                // This yields padding on the "extra" axis.
                if (targetRatio < imageRatio) {
                    // Target is taller than image: match width, extend height.
                    w = imageW;
                    h = w / targetRatio;
                } else {
                    // Target is wider than image: match height, extend width.
                    h = imageH;
                    w = h * targetRatio;
                }

                updateCropState({
                    mode,
                    x: (imageW - w) / 2,
                    y: (imageH - h) / 2,
                    width: w,
                    height: h,
                });

                return;
            }

            // Switching to crop: compute an in-bounds crop rect in overlay(view) space.
            let w = imageW;
            let h = imageH;

            if (ratio && Number.isFinite(ratio) && ratio > 0) {
                h = w / ratio;
                if (h > imageH) {
                    h = imageH;
                    w = h * ratio;
                }
            }

            const overlayCrop: CropBox = {
                x: (imageW - w) / 2,
                y: (imageH - h) / 2,
                width: w,
                height: h,
            };

            const constrained = constrainCropToImageWithMinSize(overlayCrop, viewImageDimensions, 1);

            updateCropState({
                mode,
                x: constrained.x,
                y: constrained.y,
                width: constrained.width,
                height: constrained.height,
            });
        },
        [
            cropState.mode,
            cropState.rotation,
            cropState.lockedAspectRatio,
            viewImageDimensions,
            recordSnapshot,
            updateCropState,
        ],
    );

    return {
        handleCropChange,
        handleModeChange,
        handleRotate90,
        handleToggleFlipX,
        handleToggleFlipY,
        handleStraightenChange,
        handleResetCrop,
    };
};
