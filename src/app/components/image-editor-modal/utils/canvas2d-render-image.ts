import type { Adjustments, CropState, DuotoneColors, LutTexture } from '../types';

import { normalizeAdjustmentValue, normalizeGamma, normalizeShadows } from './adjustment-utils';
import { applyBlur } from './canvas2d-blur';
import {
    applyBrightness,
    applyContrast,
    applyExposure,
    applyGamma,
    applySaturation,
    applyTemperature,
    applyTint,
    applyTonalAdjustments,
    applyVibrance,
} from './canvas2d-color';
import { applyClarity, applySharpness } from './canvas2d-convolution';
import { applyDehaze, applyDenoise, applyDuotone, applyGrain, applyLUT, applyVignette } from './canvas2d-effects';
import type { CropBox } from './crop-utils';
import { constrainCropToImageWithMinSize, getRotatedDimensions } from './crop-utils';
import { mapCropBoxToRotatedSpaceForRotation } from './rotation-crop-mapping';
import { isQuarterTurnRotationDegrees } from './tex-transform-utils';

export const renderImageWithCropAndFilters2D = async (params: {
    image: HTMLImageElement;
    imageWidth: number;
    imageHeight: number;
    cropState: CropState;
    isCropMode?: boolean;
    filterEnabled: boolean;
    filterIntensity: number;
    selectedLut?: LutTexture;
    selectedDuotone?: DuotoneColors;
    adjustments: Adjustments;
    adjustmentsEnabled: boolean;
    fullCanvasOutput: HTMLCanvasElement;
    croppedCanvasOutput?: HTMLCanvasElement;
    isExport?: boolean;
    originalCropState: CropState;
}): Promise<HTMLCanvasElement> => {
    const {
        image,
        imageWidth,
        imageHeight,
        cropState,
        isCropMode = false,
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
    const renderW = hasCropDimensions ? Math.round(safeCrop.width) : imageWidth;
    const renderH = hasCropDimensions ? Math.round(safeCrop.height) : imageHeight;

    const isQuarterTurnRotation = isQuarterTurnRotationDegrees(cropState.rotation ?? 0);

    const { width: renderOutputWidth, height: renderOutputHeight } = getRotatedDimensions(
        { width: renderW, height: renderH },
        isQuarterTurnRotation,
    );

    const { width: fullOutputWidth, height: fullOutputHeight } = getRotatedDimensions(
        { width: imageWidth, height: imageHeight },
        isQuarterTurnRotation,
    );

    const tempCanvas = document.createElement('canvas');

    tempCanvas.width = imageWidth;
    tempCanvas.height = imageHeight;
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

    if (!tempCtx) throw new Error('Failed to get 2D context');

    tempCtx.drawImage(image, 0, 0);

    const imageData = tempCtx.getImageData(0, 0, imageWidth, imageHeight);

    if (adjustmentsEnabled) {
        const temperatureValue = normalizeAdjustmentValue(adjustments.temperature);
        const exposure = normalizeAdjustmentValue(adjustments.exposure);
        const gammaValue = normalizeGamma(adjustments.gamma);
        const shadowsValue = normalizeShadows(adjustments.shadows);
        const highlightsValue = normalizeAdjustmentValue(adjustments.highlights);
        const blacksValue = normalizeAdjustmentValue(adjustments.blacks);
        const whitesValue = normalizeAdjustmentValue(adjustments.whites);
        const brightness = normalizeAdjustmentValue(adjustments.brightness);
        const contrast = normalizeAdjustmentValue(adjustments.contrast);
        const saturation = normalizeAdjustmentValue(adjustments.saturation);
        const sharpnessValue = normalizeAdjustmentValue(adjustments.sharpness);
        const clarityValue = normalizeAdjustmentValue(adjustments.clarity);
        const tint = normalizeAdjustmentValue(adjustments.tint);
        const vibrance = normalizeAdjustmentValue(adjustments.vibrance);
        const dehaze = normalizeAdjustmentValue(adjustments.dehaze.amount);
        const grainAmount = adjustments.grain.amount / 100;
        const grainSize = adjustments.grain.size / 100;
        const denoiseAmount = adjustments.denoise.amount;
        const blurAmount = adjustments.blur.amount;

        if (Math.abs(temperatureValue) > 0.00001) {
            applyTemperature(imageData, temperatureValue);
        }

        if (Math.abs(tint) > 0.00001) {
            applyTint(imageData, tint);
        }

        if (Math.abs(gammaValue - 1.0) > 0.00001) {
            applyGamma(imageData, gammaValue);
        }

        if (Math.abs(exposure) > 0.00001) {
            applyExposure(imageData, exposure);
        }

        if (
            Math.abs(shadowsValue) > 0.00001 ||
            Math.abs(highlightsValue) > 0.00001 ||
            Math.abs(whitesValue) > 0.00001 ||
            Math.abs(blacksValue) > 0.00001
        ) {
            applyTonalAdjustments(imageData, shadowsValue, highlightsValue, whitesValue, blacksValue);
        }

        if (Math.abs(contrast) > 0.00001) {
            applyContrast(imageData, contrast);
        }

        if (Math.abs(brightness) > 0.00001) {
            applyBrightness(imageData, brightness);
        }

        if (Math.abs(saturation) > 0.00001) {
            applySaturation(imageData, saturation);
        }

        if (Math.abs(vibrance) > 0.00001) {
            applyVibrance(imageData, vibrance);
        }

        if (Math.abs(dehaze) > 0.00001) {
            applyDehaze(imageData, dehaze);
        }

        if (Math.abs(clarityValue) > 0.00001) {
            applyClarity(imageData, clarityValue, imageWidth, imageHeight);
        }

        if (Math.abs(sharpnessValue) > 0.00001) {
            applySharpness(imageData, sharpnessValue, imageWidth, imageHeight);
        }

        if (denoiseAmount > 0) {
            applyDenoise(imageData, denoiseAmount, imageWidth, imageHeight);
        }

        if (blurAmount > 0) {
            applyBlur(imageData, blurAmount, imageWidth, imageHeight);
        }

        if (grainAmount > 0.00001) {
            applyGrain(imageData, grainAmount, grainSize);
        }

        const vignetteSize = adjustments.vignette.size / 100;
        const vignetteAmount = adjustments.vignette.amount / 100;

        if (Math.abs(vignetteAmount) > 0.00001) {
            applyVignette(imageData, vignetteSize, vignetteAmount, imageWidth, imageHeight);
        }
    }

    if (filterEnabled) {
        const lutIntensity = filterIntensity / 100;

        if (selectedDuotone) {
            applyDuotone(imageData, selectedDuotone, lutIntensity);
        }

        if (selectedLut && filterIntensity > 0) {
            applyLUT(imageData, selectedLut, lutIntensity);
        }
    }

    tempCtx.putImageData(imageData, 0, 0);

    const outputCanvas = document.createElement('canvas');

    outputCanvas.width = hasCropDimensions ? fullOutputWidth : renderOutputWidth;
    outputCanvas.height = hasCropDimensions ? fullOutputHeight : renderOutputHeight;

    const outputCtx = outputCanvas.getContext('2d');

    if (!outputCtx) throw new Error('Failed to get output 2D context');

    outputCtx.translate(outputCanvas.width / 2, outputCanvas.height / 2);

    if (cropState.flipX) {
        outputCtx.scale(-1, 1);
    }

    if (cropState.flipY) {
        outputCtx.scale(1, -1);
    }

    if (cropState.rotation) {
        outputCtx.rotate((cropState.rotation * Math.PI) / 180);
    }

    if (cropState.straightenAngle) {
        outputCtx.rotate((cropState.straightenAngle * Math.PI) / 180);
    }

    outputCtx.drawImage(tempCanvas, -imageWidth / 2, -imageHeight / 2, imageWidth, imageHeight);

    fullCanvasOutput.width = outputCanvas.width;
    fullCanvasOutput.height = outputCanvas.height;
    const finalCtx = fullCanvasOutput.getContext('2d');

    if (!finalCtx) throw new Error('Failed to get final 2D context');

    finalCtx.clearRect(0, 0, fullCanvasOutput.width, fullCanvasOutput.height);
    finalCtx.drawImage(outputCanvas, 0, 0);

    // If we should return full image (preview in Edit Mode), skip crop/fit application
    if (shouldReturnFullImage) {
        return fullCanvasOutput;
    }

    // Handle Fit Mode
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

    if (hasCropDimensions && croppedCanvasOutput) {
        croppedCanvasOutput.width = renderOutputWidth;
        croppedCanvasOutput.height = renderOutputHeight;
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
