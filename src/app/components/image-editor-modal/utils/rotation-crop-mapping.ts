import type { CropBox } from './crop-utils';
import { normalizeRotationTo360, isRightAngleRotationDegrees } from './tex-transform-utils';

export const mapCropBoxToRotatedSpaceForRotation = (
    cropBox: CropBox,
    imageW: number,
    imageH: number,
    rotationDeg: number,
): CropBox => {
    if (!isRightAngleRotationDegrees(rotationDeg)) return cropBox;

    const rotNorm = normalizeRotationTo360(rotationDeg);

    if (rotNorm === 0) return cropBox;

    if (rotNorm === 90) {
        return {
            x: cropBox.y,
            y: imageW - (cropBox.x + cropBox.width),
            width: cropBox.height,
            height: cropBox.width,
        };
    }

    if (rotNorm === 180) {
        return {
            x: imageW - (cropBox.x + cropBox.width),
            y: imageH - (cropBox.y + cropBox.height),
            width: cropBox.width,
            height: cropBox.height,
        };
    }

    return {
        x: imageH - (cropBox.y + cropBox.height),
        y: cropBox.x,
        width: cropBox.height,
        height: cropBox.width,
    };
};

export const mapCropBoxFromRotatedSpaceForRotation = (
    rotatedCropBox: CropBox,
    imageW: number,
    imageH: number,
    rotationDeg: number,
): CropBox => {
    if (!isRightAngleRotationDegrees(rotationDeg)) return rotatedCropBox;

    const rotNorm = normalizeRotationTo360(rotationDeg);

    if (rotNorm === 0) return rotatedCropBox;

    if (rotNorm === 90) {
        return {
            x: imageW - (rotatedCropBox.y + rotatedCropBox.height),
            y: rotatedCropBox.x,
            width: rotatedCropBox.height,
            height: rotatedCropBox.width,
        };
    }

    if (rotNorm === 180) {
        return {
            x: imageW - (rotatedCropBox.x + rotatedCropBox.width),
            y: imageH - (rotatedCropBox.y + rotatedCropBox.height),
            width: rotatedCropBox.width,
            height: rotatedCropBox.height,
        };
    }

    return {
        x: rotatedCropBox.y,
        y: imageH - (rotatedCropBox.x + rotatedCropBox.width),
        width: rotatedCropBox.height,
        height: rotatedCropBox.width,
    };
};
