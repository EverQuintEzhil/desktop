import { describe, expect, it } from 'vitest';

import type { CropBox } from './crop-utils';
import { mapCropBoxFromRotatedSpaceForRotation, mapCropBoxToRotatedSpaceForRotation } from './rotation-crop-mapping';

const IMAGE_W = 400;
const IMAGE_H = 300;

const CROP: CropBox = {
    x: 20,
    y: 30,
    width: 100,
    height: 50,
};

describe('mapCropBoxToRotatedSpaceForRotation', () => {
    it('is a no-op for a non-right-angle rotation', () => {
        expect(mapCropBoxToRotatedSpaceForRotation(CROP, IMAGE_W, IMAGE_H, 45)).toEqual(CROP);
    });

    it('is a no-op for a 0 degree rotation', () => {
        expect(mapCropBoxToRotatedSpaceForRotation(CROP, IMAGE_W, IMAGE_H, 0)).toEqual(CROP);
    });

    it('maps into 90-degree rotated space', () => {
        expect(mapCropBoxToRotatedSpaceForRotation(CROP, IMAGE_W, IMAGE_H, 90)).toEqual({
            x: 30,
            y: IMAGE_W - (20 + 100),
            width: 50,
            height: 100,
        });
    });

    it('maps into 180-degree rotated space', () => {
        expect(mapCropBoxToRotatedSpaceForRotation(CROP, IMAGE_W, IMAGE_H, 180)).toEqual({
            x: IMAGE_W - (20 + 100),
            y: IMAGE_H - (30 + 50),
            width: 100,
            height: 50,
        });
    });
});

describe('mapCropBoxFromRotatedSpaceForRotation', () => {
    it('is the inverse of mapCropBoxToRotatedSpaceForRotation at 90 degrees', () => {
        const rotated = mapCropBoxToRotatedSpaceForRotation(CROP, IMAGE_W, IMAGE_H, 90);
        const roundTripped = mapCropBoxFromRotatedSpaceForRotation(rotated, IMAGE_W, IMAGE_H, 90);

        expect(roundTripped).toEqual(CROP);
    });

    it('is the inverse of mapCropBoxToRotatedSpaceForRotation at 180 degrees', () => {
        const rotated = mapCropBoxToRotatedSpaceForRotation(CROP, IMAGE_W, IMAGE_H, 180);
        const roundTripped = mapCropBoxFromRotatedSpaceForRotation(rotated, IMAGE_W, IMAGE_H, 180);

        expect(roundTripped).toEqual(CROP);
    });

    it('is the inverse of mapCropBoxToRotatedSpaceForRotation at 270 degrees', () => {
        const rotated = mapCropBoxToRotatedSpaceForRotation(CROP, IMAGE_W, IMAGE_H, 270);
        const roundTripped = mapCropBoxFromRotatedSpaceForRotation(rotated, IMAGE_W, IMAGE_H, 270);

        expect(roundTripped).toEqual(CROP);
    });

    it('is a no-op for a non-right-angle rotation', () => {
        expect(mapCropBoxFromRotatedSpaceForRotation(CROP, IMAGE_W, IMAGE_H, 45)).toEqual(CROP);
    });
});
