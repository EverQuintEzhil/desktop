import { clamp } from 'lodash';

// Small epsilon value for floating point comparisons
export const EPS = 1e-6;

export interface CropBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface ImageDimensions {
    width: number;
    height: number;
}

/**
 * Swap dimensions if quarter-turn rotated (90° or 270°)
 */
export const getRotatedDimensions = (dimensions: ImageDimensions, isQuarterTurnRotation: boolean): ImageDimensions => {
    return isQuarterTurnRotation ? { width: dimensions.height, height: dimensions.width } : dimensions;
};

/**
 * Swap crop box dimensions if quarter-turn rotated (90° or 270°)
 */
export const getRotatedCropBox = (crop: CropBox, isQuarterTurnRotation: boolean): CropBox => {
    return isQuarterTurnRotation ? { ...crop, width: crop.height, height: crop.width } : crop;
};

/**
 * Calculate new crop state when rotating image by 90 degrees
 * Maintains aspect ratio and fits crop within new rotated bounds
 */
export const calculateCropAfterRotate90 = (
    currentCrop: CropBox,
    currentViewDimensions: ImageDimensions,
    lockedAspectRatio: number | null,
): CropBox => {
    const currentRatio = currentCrop.width / Math.max(1, currentCrop.height);
    const targetRatio = lockedAspectRatio || currentRatio;

    // New viewport dimensions (swapped because of 90 deg rotation)
    const nextViewW = currentViewDimensions.height;
    const nextViewH = currentViewDimensions.width;

    // Calculate new crop dimensions to fit in nextViewW/H with targetRatio
    let w = nextViewW;
    let h = w / targetRatio;

    if (h > nextViewH) {
        h = nextViewH;
        w = h * targetRatio;
    }

    // Center it
    const x = (nextViewW - w) / 2;
    const y = (nextViewH - h) / 2;

    return {
        x,
        y,
        width: w,
        height: h,
    };
};

export const parseAspectRatioPreset = (preset: string): number | null => {
    const value = String(preset || '')
        .trim()
        .toLowerCase();

    if (!value || value === 'free' || value === 'original') {
        return null;
    }

    const match = value.match(/^([0-9]+(?:\.[0-9]+)?)\s*:\s*([0-9]+(?:\.[0-9]+)?)$/);

    if (!match) {
        return null;
    }

    const w = parseFloat(match[1]);
    const h = parseFloat(match[2]);

    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
        return null;
    }

    return w / h;
};

export const constrainCropToImage = (crop: CropBox, imageDimensions: ImageDimensions): CropBox => {
    const constrainedCrop = { ...crop };

    constrainedCrop.x = clamp(crop.x, 0, imageDimensions.width - crop.width);
    constrainedCrop.y = clamp(crop.y, 0, imageDimensions.height - crop.height);

    constrainedCrop.width = Math.min(crop.width, imageDimensions.width - constrainedCrop.x);
    constrainedCrop.height = Math.min(crop.height, imageDimensions.height - constrainedCrop.y);

    return constrainedCrop;
};

export const constrainCropToImageWithMinSize = (
    crop: CropBox,
    imageDimensions: ImageDimensions,
    minSize: number = 50,
): CropBox => {
    const imageW = Math.max(0, imageDimensions.width || 0);
    const imageH = Math.max(0, imageDimensions.height || 0);

    if (imageW <= 0 || imageH <= 0) {
        return { ...crop };
    }

    const enforcedMin = Math.max(1, minSize);
    const minW = Math.min(enforcedMin, imageW);
    const minH = Math.min(enforcedMin, imageH);

    let width = Number.isFinite(crop.width) ? crop.width : minW;
    let height = Number.isFinite(crop.height) ? crop.height : minH;

    width = clamp(width, minW, imageW);
    height = clamp(height, minH, imageH);

    let x = Number.isFinite(crop.x) ? crop.x : 0;
    let y = Number.isFinite(crop.y) ? crop.y : 0;

    x = clamp(x, 0, imageW - width);
    y = clamp(y, 0, imageH - height);

    return {
        x,
        y,
        width,
        height,
    };
};

export const fitCropUniformToBounds = (crop: CropBox, bounds: { width: number; height: number }): CropBox => {
    const bw = Math.max(EPS, bounds.width);
    const bh = Math.max(EPS, bounds.height);
    const w = Math.max(EPS, crop.width);
    const h = Math.max(EPS, crop.height);
    const scale = Math.min(1, bw / w, bh / h);

    const nextW = w * scale;
    const nextH = h * scale;

    const cx = crop.x + w * 0.5;
    const cy = crop.y + h * 0.5;

    const x = clamp(cx - nextW * 0.5, 0, bw - nextW);
    const y = clamp(cy - nextH * 0.5, 0, bh - nextH);

    return {
        x,
        y,
        width: nextW,
        height: nextH,
    };
};

export const applyAspectRatioToCrop = (
    crop: CropBox,
    aspectRatio: number,
    imageDimensions: ImageDimensions,
    minSize: number = 50,
): CropBox => {
    if (!Number.isFinite(aspectRatio) || aspectRatio <= EPS) {
        return constrainCropToImageWithMinSize(crop, imageDimensions, minSize);
    }

    const imageW = Math.max(0, imageDimensions.width || 0);
    const imageH = Math.max(0, imageDimensions.height || 0);

    if (imageW <= 0 || imageH <= 0) {
        return { ...crop };
    }

    const current = constrainCropToImageWithMinSize(crop, imageDimensions, minSize);

    const centerX = current.x + current.width * 0.5;
    const centerY = current.y + current.height * 0.5;

    const enforcedMin = Math.max(1, minSize);
    const minW = Math.min(enforcedMin, imageW);
    const minH = Math.min(enforcedMin, imageH);

    const maxWAtCenter = Math.max(0, 2 * Math.min(centerX, imageW - centerX));
    const maxHAtCenter = Math.max(0, 2 * Math.min(centerY, imageH - centerY));

    const fitCentered = (targetW: number, targetH: number) => {
        let w = Math.max(minW, targetW);
        let h = Math.max(minH, targetH);

        // Ensure ratio exact before fitting.
        if (w / Math.max(EPS, h) > aspectRatio) {
            w = h * aspectRatio;
        } else {
            h = w / aspectRatio;
        }

        const scaleToCenterFit = Math.min(1, maxWAtCenter / Math.max(EPS, w), maxHAtCenter / Math.max(EPS, h));

        w *= scaleToCenterFit;
        h *= scaleToCenterFit;

        // Re-enforce ratio after scaling.
        if (w / Math.max(EPS, h) > aspectRatio) {
            w = h * aspectRatio;
        } else {
            h = w / aspectRatio;
        }

        return { w, h, area: w * h };
    };

    // Prefer keeping size by expanding the other dimension (vs shrinking).
    const keepWidth = fitCentered(current.width, current.width / aspectRatio);
    const keepHeight = fitCentered(current.height * aspectRatio, current.height);

    const best = keepWidth.area >= keepHeight.area ? keepWidth : keepHeight;

    const x = clamp(centerX - best.w * 0.5, 0, imageW - best.w);
    const y = clamp(centerY - best.h * 0.5, 0, imageH - best.h);

    return {
        x,
        y,
        width: best.w,
        height: best.h,
    };
};

export const applyCropResize = (
    currentCrop: CropBox,
    handlePosition: string,
    deltaX: number,
    deltaY: number,
    aspectRatio: number | null,
    imageDimensions: ImageDimensions,
    minSize: number = 50,
    mode: 'crop' | 'fit' = 'crop',
): CropBox => {
    const imageW = Math.max(0, imageDimensions.width || 0);
    const imageH = Math.max(0, imageDimensions.height || 0);

    if (mode === 'crop' && (imageW <= 0 || imageH <= 0)) {
        return { ...currentCrop };
    }

    const enforcedMin = Math.max(1, minSize);
    const minW = mode === 'crop' ? Math.min(enforcedMin, imageW) : enforcedMin;
    const minH = mode === 'crop' ? Math.min(enforcedMin, imageH) : enforcedMin;

    // In fit mode, we don't constrain start crop to image
    const start =
        mode === 'fit'
            ? { ...currentCrop }
            : constrainCropToImageWithMinSize(currentCrop, imageDimensions, enforcedMin);

    let left = start.x;
    let top = start.y;
    let right = start.x + start.width;
    let bottom = start.y + start.height;

    switch (handlePosition) {
        case 'nw':
            left += deltaX;
            top += deltaY;
            break;
        case 'n':
            top += deltaY;
            break;
        case 'ne':
            right += deltaX;
            top += deltaY;
            break;
        case 'e':
            right += deltaX;
            break;
        case 'se':
            right += deltaX;
            bottom += deltaY;
            break;
        case 's':
            bottom += deltaY;
            break;
        case 'sw':
            left += deltaX;
            bottom += deltaY;
            break;
        case 'w':
            left += deltaX;
            break;
        default:
            break;
    }

    const ratio =
        typeof aspectRatio === 'number' && Number.isFinite(aspectRatio) && aspectRatio > EPS ? aspectRatio : null;

    if (ratio && ['nw', 'ne', 'se', 'sw'].includes(handlePosition)) {
        const driveByWidth = Math.abs(deltaX) >= Math.abs(deltaY);

        const fixedX = handlePosition === 'nw' || handlePosition === 'sw' ? start.x + start.width : start.x;
        const fixedY = handlePosition === 'nw' || handlePosition === 'ne' ? start.y + start.height : start.y;

        const moveXDir = handlePosition === 'nw' || handlePosition === 'sw' ? -1 : 1;
        const moveYDir = handlePosition === 'nw' || handlePosition === 'ne' ? -1 : 1;

        // In fit mode, max dimensions are effectively infinite (or very large)
        const getMaxForRatioResize = () => {
            if (mode === 'fit') {
                return {
                    maxW: Number.MAX_SAFE_INTEGER,
                    maxH: Number.MAX_SAFE_INTEGER,
                };
            }

            return {
                maxW: moveXDir === -1 ? fixedX : imageW - fixedX,
                maxH: moveYDir === -1 ? fixedY : imageH - fixedY,
            };
        };

        const { maxW, maxH } = getMaxForRatioResize();

        const minWidthForRatio = Math.max(minW, minH * ratio);
        const minHeightForRatio = Math.max(minH, minW / ratio);

        const movedX = moveXDir === -1 ? left : right;
        const movedY = moveYDir === -1 ? top : bottom;

        let nextW = Math.abs(movedX - fixedX);
        let nextH = Math.abs(movedY - fixedY);

        nextW = Math.max(nextW, minWidthForRatio);
        nextH = Math.max(nextH, minHeightForRatio);

        if (driveByWidth) {
            nextW = clamp(nextW, minWidthForRatio, Math.max(minWidthForRatio, maxW));
            nextH = nextW / ratio;

            if (nextH > maxH) {
                nextH = maxH;
                nextW = nextH * ratio;
            }
        } else {
            nextH = clamp(nextH, minHeightForRatio, Math.max(minHeightForRatio, maxH));
            nextW = nextH * ratio;

            if (nextW > maxW) {
                nextW = maxW;
                nextH = nextW / ratio;
            }
        }

        nextW = clamp(nextW, minWidthForRatio, Math.max(minWidthForRatio, maxW));
        nextH = clamp(nextH, minHeightForRatio, Math.max(minHeightForRatio, maxH));

        // Re-enforce ratio
        if (nextW / Math.max(EPS, nextH) > ratio) {
            nextW = nextH * ratio;
        } else {
            nextH = nextW / ratio;
        }

        if (moveXDir === -1) {
            right = fixedX;
            left = fixedX - nextW;
        } else {
            left = fixedX;
            right = fixedX + nextW;
        }

        if (moveYDir === -1) {
            bottom = fixedY;
            top = fixedY - nextH;
        } else {
            top = fixedY;
            bottom = fixedY + nextH;
        }

        // In fit mode, we don't clamp to image bounds
        if (mode === 'crop') {
            left = clamp(left, 0, Math.max(0, imageW - minW));
            top = clamp(top, 0, Math.max(0, imageH - minH));
            right = clamp(right, left + minW, imageW);
            bottom = clamp(bottom, top + minH, imageH);
        }
    } else {
        // Non-corner handles (or no ratio)
        // In fit mode, we don't clamp to image bounds
        if (mode === 'crop') {
            left = clamp(left, 0, imageW);
            right = clamp(right, 0, imageW);
            top = clamp(top, 0, imageH);
            bottom = clamp(bottom, 0, imageH);
        }

        const affectsLeft = handlePosition.includes('w');
        const affectsRight = handlePosition.includes('e');
        const affectsTop = handlePosition.includes('n');
        const affectsBottom = handlePosition.includes('s');

        // Min size checks
        if (right - left < minW) {
            if (affectsLeft && !affectsRight) {
                left = right - minW;
            } else if (affectsRight && !affectsLeft) {
                right = left + minW;
            } else {
                const cx = (left + right) / 2;

                left = cx - minW / 2;
                right = cx + minW / 2;
            }
        }

        if (bottom - top < minH) {
            if (affectsTop && !affectsBottom) {
                top = bottom - minH;
            } else if (affectsBottom && !affectsTop) {
                bottom = top + minH;
            } else {
                const cy = (top + bottom) / 2;

                top = cy - minH / 2;
                bottom = cy + minH / 2;
            }
        }

        // Clamping to image bounds (only for crop mode)
        if (mode === 'crop') {
            if (left < 0) {
                const shift = -left;

                left = 0;
                if (!affectsRight) right = clamp(right + shift, minW, imageW);
            }
            if (top < 0) {
                const shift = -top;

                top = 0;
                if (!affectsBottom) bottom = clamp(bottom + shift, minH, imageH);
            }
            if (right > imageW) {
                const shift = right - imageW;

                right = imageW;
                if (!affectsLeft) left = clamp(left - shift, 0, Math.max(0, imageW - minW));
            }
            if (bottom > imageH) {
                const shift = bottom - imageH;

                bottom = imageH;
                if (!affectsTop) top = clamp(top - shift, 0, Math.max(0, imageH - minH));
            }

            left = clamp(left, 0, Math.max(0, imageW - minW));
            top = clamp(top, 0, Math.max(0, imageH - minH));
            right = clamp(right, left + minW, imageW);
            bottom = clamp(bottom, top + minH, imageH);
        }
    }

    if (mode === 'fit') {
        return {
            x: left,
            y: top,
            width: right - left,
            height: bottom - top,
        };
    }

    return constrainCropToImageWithMinSize(
        {
            x: left,
            y: top,
            width: right - left,
            height: bottom - top,
        },
        imageDimensions,
        enforcedMin,
    );
};

export const applyCropMove = (
    currentCrop: CropBox,
    deltaX: number,
    deltaY: number,
    imageDimensions: ImageDimensions,
): CropBox => {
    const newCrop = {
        ...currentCrop,
        x: currentCrop.x + deltaX,
        y: currentCrop.y + deltaY,
    };

    return constrainCropToImageWithMinSize(newCrop, imageDimensions, 1);
};

export const getAspectRatioFromPreset = (preset: string): number | null => {
    return parseAspectRatioPreset(preset);
};

export const cropToPercentage = (crop: CropBox, imageDimensions: ImageDimensions) => ({
    x: (crop.x / imageDimensions.width) * 100,
    y: (crop.y / imageDimensions.height) * 100,
    width: (crop.width / imageDimensions.width) * 100,
    height: (crop.height / imageDimensions.height) * 100,
});

export const percentageToCrop = (percentCrop: CropBox, imageDimensions: ImageDimensions): CropBox => ({
    x: (percentCrop.x / 100) * imageDimensions.width,
    y: (percentCrop.y / 100) * imageDimensions.height,
    width: (percentCrop.width / 100) * imageDimensions.width,
    height: (percentCrop.height / 100) * imageDimensions.height,
});

export { ASPECT_RATIO_PRESETS } from './aspect-ratio-presets';
export type { PagePresetDesignUnit, PageSizePreset, PagePresetGroup } from './page-size-presets';
export { PAGE_SIZE_PRESET_GROUPS } from './page-size-presets';
