import type { Adjustments, CropState, DuotoneColors, LutTexture } from '../types';

import type { CropBox } from './crop-utils';
import { constrainCropToImageWithMinSize, getRotatedDimensions } from './crop-utils';
import { mapCropBoxToRotatedSpaceForRotation } from './rotation-crop-mapping';
import {
    buildTexTransformForFullImageWithDimensions,
    buildTexTransformFromCropWithDimensions,
    isQuarterTurnRotationDegrees,
} from './tex-transform-utils';
import { renderImageWithFilters } from './webgl-render-image';

export interface RenderParams {
    image: HTMLImageElement;
    imageWidth: number;
    imageHeight: number;
    cropState: CropState;
    isCropMode?: boolean;
    filterEnabled?: boolean;
    filterIntensity?: number;
    selectedLut?: LutTexture;
    selectedDuotone?: DuotoneColors;
    adjustments?: Adjustments;
    adjustmentsEnabled?: boolean;
    fullCanvasOutput: HTMLCanvasElement;
    croppedCanvasOutput: HTMLCanvasElement;
    isExport: boolean;
    originalCropState: CropState;
}

export const renderImageWithCropAndFilters = async (params: RenderParams): Promise<HTMLCanvasElement> => {
    const {
        image,
        imageWidth,
        imageHeight,
        cropState,
        isCropMode,
        filterEnabled,
        filterIntensity,
        selectedLut,
        selectedDuotone,
        adjustments,
        adjustmentsEnabled,
        fullCanvasOutput,
        croppedCanvasOutput,
        isExport,
        originalCropState,
    } = params;

    const rawCrop: CropBox = {
        x: cropState.x,
        y: cropState.y,
        width: cropState.width,
        height: cropState.height,
    };

    const hasUserCrop = cropState.width > 0 && cropState.height > 0;
    const safeCrop = hasUserCrop
        ? constrainCropToImageWithMinSize(rawCrop, { width: imageWidth, height: imageHeight }, 1)
        : {
              x: 0,
              y: 0,
              width: imageWidth,
              height: imageHeight,
          };

    // If we are in Crop/Fit Mode (editing) and NOT exporting, we want to return the full image
    // so the user can see the full context with the overlay on top.
    // If we are exporting, we want the final cropped/padded result.
    // While actively editing Crop (including sub-modes like Fit), we return the full image
    // so the user sees full context with an overlay on top.
    // Outside crop mode (e.g. filters/adjust), we want to render the final result (cropped or padded).
    const shouldReturnFullImage = !isExport && !!isCropMode;

    const hasCropDimensions = !shouldReturnFullImage && hasUserCrop && safeCrop.width > 0 && safeCrop.height > 0;
    const renderOutputWidth = hasCropDimensions ? Math.round(safeCrop.width) : imageWidth;
    const renderOutputHeight = hasCropDimensions ? Math.round(safeCrop.height) : imageHeight;

    const transformCrop = shouldReturnFullImage
        ? {
              x: 0,
              y: 0,
              width: imageWidth,
              height: imageHeight,
          }
        : safeCrop;

    const isQuarterTurnRotation = isQuarterTurnRotationDegrees(cropState.rotation ?? 0);

    const { width: renderOutputWidthRotated, height: renderOutputHeightRotated } = getRotatedDimensions(
        { width: renderOutputWidth, height: renderOutputHeight },
        isQuarterTurnRotation,
    );

    fullCanvasOutput.width = renderOutputWidthRotated;
    fullCanvasOutput.height = renderOutputHeightRotated;

    const { width: fullOutputWidth, height: fullOutputHeight } = getRotatedDimensions(
        { width: imageWidth, height: imageHeight },
        isQuarterTurnRotation,
    );

    const texTransform = hasCropDimensions
        ? buildTexTransformForFullImageWithDimensions(
              cropState.rotation ?? 0,
              cropState.straightenAngle ?? 0,
              cropState.flipX ?? false,
              cropState.flipY ?? false,
              imageWidth,
              imageHeight,
              fullOutputWidth,
              fullOutputHeight,
          )
        : buildTexTransformFromCropWithDimensions(
              cropState.rotation ?? 0,
              cropState.straightenAngle ?? 0,
              cropState.flipX ?? false,
              cropState.flipY ?? false,
              transformCrop.x,
              transformCrop.y,
              transformCrop.width,
              transformCrop.height,
              imageWidth,
              imageHeight,
              renderOutputWidthRotated,
              renderOutputHeightRotated,
          );

    // Render full image with filters
    await renderImageWithFilters({
        canvas: fullCanvasOutput,
        image,
        outputWidth: hasCropDimensions ? fullOutputWidth : renderOutputWidthRotated,
        outputHeight: hasCropDimensions ? fullOutputHeight : renderOutputHeightRotated,
        filterEnabled,
        filterIntensity,
        selectedLut,
        selectedDuotone,
        adjustments,
        adjustmentsEnabled,
        texTransform,
    });

    // If we should return full image (preview in Edit Mode), skip crop/fit application
    if (shouldReturnFullImage) {
        return fullCanvasOutput;
    }

    // Handle Fit Mode (Export or View Result)
    if (cropState.mode === 'fit' && croppedCanvasOutput) {
        const frameWidth = Math.round(originalCropState.width ?? cropState.width);
        const frameHeight = Math.round(originalCropState.height ?? cropState.height);

        croppedCanvasOutput.width = frameWidth;
        croppedCanvasOutput.height = frameHeight;

        const ctx2d = croppedCanvasOutput.getContext('2d');

        if (ctx2d) {
            // Fill with black
            ctx2d.fillStyle = '#000000';
            ctx2d.fillRect(0, 0, frameWidth, frameHeight);

            // Scale image to fit within the frame
            const imageW = fullCanvasOutput.width;
            const imageH = fullCanvasOutput.height;

            // Calculate scale to fit
            const scale = Math.min(frameWidth / imageW, frameHeight / imageH);

            const drawW = imageW * scale;
            const drawH = imageH * scale;

            const drawX = (frameWidth - drawW) / 2;
            const drawY = (frameHeight - drawH) / 2;

            ctx2d.drawImage(fullCanvasOutput, 0, 0, imageW, imageH, drawX, drawY, drawW, drawH);

            return croppedCanvasOutput;
        }
    }

    // If we need to crop from the full canvas (Crop Mode Export or View Result)
    if (hasUserCrop && croppedCanvasOutput) {
        croppedCanvasOutput.width = renderOutputWidthRotated;
        croppedCanvasOutput.height = renderOutputHeightRotated;
        const ctx2d = croppedCanvasOutput.getContext('2d');

        if (ctx2d) {
            const cropInRotated = mapCropBoxToRotatedSpaceForRotation(
                safeCrop,
                imageWidth,
                imageHeight,
                cropState.rotation,
            );

            ctx2d.clearRect(0, 0, croppedCanvasOutput.width, croppedCanvasOutput.height);
            ctx2d.drawImage(
                fullCanvasOutput,
                cropInRotated.x,
                cropInRotated.y,
                cropInRotated.width,
                cropInRotated.height,
                0,
                0,
                croppedCanvasOutput.width,
                croppedCanvasOutput.height,
            );

            return croppedCanvasOutput;
        }

        return fullCanvasOutput;
    }

    return fullCanvasOutput;
};
