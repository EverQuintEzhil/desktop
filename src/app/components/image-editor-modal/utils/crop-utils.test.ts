import { describe, expect, it } from 'vitest';

import {
    applyAspectRatioToCrop,
    applyCropMove,
    applyCropResize,
    calculateCropAfterRotate90,
    constrainCropToImage,
    constrainCropToImageWithMinSize,
    cropToPercentage,
    fitCropUniformToBounds,
    getRotatedCropBox,
    getRotatedDimensions,
    parseAspectRatioPreset,
    percentageToCrop,
} from './crop-utils';

describe('getRotatedDimensions', () => {
    it('swaps width/height on a quarter-turn rotation', () => {
        expect(getRotatedDimensions({ width: 200, height: 100 }, true)).toEqual({ width: 100, height: 200 });
    });

    it('is a no-op when not a quarter-turn', () => {
        expect(getRotatedDimensions({ width: 200, height: 100 }, false)).toEqual({ width: 200, height: 100 });
    });
});

describe('getRotatedCropBox', () => {
    it('swaps crop width/height on a quarter-turn rotation', () => {
        expect(
            getRotatedCropBox(
                {
                    x: 10,
                    y: 20,
                    width: 200,
                    height: 100,
                },
                true,
            ),
        ).toEqual({
            x: 10,
            y: 20,
            width: 100,
            height: 200,
        });
    });

    it('is a no-op when not a quarter-turn', () => {
        const crop = {
            x: 10,
            y: 20,
            width: 200,
            height: 100,
        };

        expect(getRotatedCropBox(crop, false)).toEqual(crop);
    });
});

describe('parseAspectRatioPreset', () => {
    it('returns null for "free"', () => {
        expect(parseAspectRatioPreset('free')).toBeNull();
    });

    it('returns null for "original"', () => {
        expect(parseAspectRatioPreset('original')).toBeNull();
    });

    it('parses a "w:h" preset into a ratio', () => {
        expect(parseAspectRatioPreset('16:9')).toBeCloseTo(16 / 9);
    });

    it('returns null for malformed input', () => {
        expect(parseAspectRatioPreset('not-a-ratio')).toBeNull();
    });

    it('returns null for a zero or negative ratio', () => {
        expect(parseAspectRatioPreset('0:5')).toBeNull();
    });
});

describe('constrainCropToImage', () => {
    it('leaves a crop that already fits untouched', () => {
        const crop = {
            x: 10,
            y: 10,
            width: 50,
            height: 50,
        };

        expect(constrainCropToImage(crop, { width: 100, height: 100 })).toEqual(crop);
    });

    it('clamps a crop that overflows the image bounds', () => {
        const crop = {
            x: 80,
            y: 80,
            width: 50,
            height: 50,
        };

        expect(constrainCropToImage(crop, { width: 100, height: 100 })).toEqual({
            x: 50,
            y: 50,
            width: 50,
            height: 50,
        });
    });
});

describe('constrainCropToImageWithMinSize', () => {
    it('returns the crop unchanged when the image has no size', () => {
        const crop = {
            x: 1,
            y: 1,
            width: 10,
            height: 10,
        };

        expect(constrainCropToImageWithMinSize(crop, { width: 0, height: 0 })).toEqual(crop);
    });

    it('enforces the minimum size', () => {
        const crop = {
            x: 0,
            y: 0,
            width: 10,
            height: 10,
        };
        const result = constrainCropToImageWithMinSize(crop, { width: 500, height: 500 }, 50);

        expect(result.width).toBe(50);
        expect(result.height).toBe(50);
    });

    it('keeps a valid crop unchanged', () => {
        const crop = {
            x: 5,
            y: 5,
            width: 100,
            height: 100,
        };

        expect(constrainCropToImageWithMinSize(crop, { width: 500, height: 500 }, 50)).toEqual(crop);
    });
});

describe('fitCropUniformToBounds', () => {
    it('is a no-op when the crop already fits within bounds', () => {
        const crop = {
            x: 0,
            y: 0,
            width: 50,
            height: 50,
        };

        expect(fitCropUniformToBounds(crop, { width: 100, height: 100 })).toEqual(crop);
    });

    it('scales down uniformly and re-centers when the crop is larger than the bounds', () => {
        const crop = {
            x: 0,
            y: 0,
            width: 200,
            height: 100,
        };
        const result = fitCropUniformToBounds(crop, { width: 100, height: 100 });

        expect(result.width).toBeCloseTo(100);
        expect(result.height).toBeCloseTo(50);
    });
});

describe('applyAspectRatioToCrop', () => {
    it('falls back to constrain-with-min-size for a non-finite ratio', () => {
        const crop = {
            x: 0,
            y: 0,
            width: 40,
            height: 40,
        };

        expect(applyAspectRatioToCrop(crop, 0, { width: 200, height: 200 })).toEqual(
            constrainCropToImageWithMinSize(crop, { width: 200, height: 200 }, 50),
        );
    });

    it('produces a crop whose width/height matches the target ratio', () => {
        const crop = {
            x: 50,
            y: 50,
            width: 100,
            height: 100,
        };
        const result = applyAspectRatioToCrop(crop, 2, { width: 400, height: 400 });

        expect(result.width / result.height).toBeCloseTo(2);
    });
});

describe('applyCropResize', () => {
    it('grows the crop from the "se" handle without an aspect ratio', () => {
        const crop = {
            x: 10,
            y: 10,
            width: 50,
            height: 50,
        };
        const result = applyCropResize(crop, 'se', 20, 10, null, { width: 200, height: 200 });

        expect(result.x).toBe(10);
        expect(result.y).toBe(10);
        expect(result.width).toBe(70);
        expect(result.height).toBe(60);
    });

    it('clamps growth to the image bounds in crop mode', () => {
        const crop = {
            x: 150,
            y: 150,
            width: 40,
            height: 40,
        };
        const result = applyCropResize(crop, 'se', 100, 100, null, { width: 200, height: 200 });

        expect(result.x + result.width).toBeLessThanOrEqual(200);
        expect(result.y + result.height).toBeLessThanOrEqual(200);
    });

    it('returns the crop unchanged for an unhandled position with no delta', () => {
        const crop = {
            x: 10,
            y: 10,
            width: 50,
            height: 50,
        };
        const result = applyCropResize(crop, 'nonexistent', 0, 0, null, { width: 200, height: 200 });

        expect(result).toEqual(crop);
    });

    const base = {
        x: 60,
        y: 60,
        width: 80,
        height: 80,
    };
    const image = { width: 300, height: 300 };

    it.each([
        [
            'nw',
            -10,
            -10,
            {
                x: 50,
                y: 50,
                width: 90,
                height: 90,
            },
        ],
        [
            'n',
            0,
            -10,
            {
                x: 60,
                y: 50,
                width: 80,
                height: 90,
            },
        ],
        [
            'ne',
            10,
            -10,
            {
                x: 60,
                y: 50,
                width: 90,
                height: 90,
            },
        ],
        [
            'e',
            10,
            0,
            {
                x: 60,
                y: 60,
                width: 90,
                height: 80,
            },
        ],
        [
            'se',
            10,
            10,
            {
                x: 60,
                y: 60,
                width: 90,
                height: 90,
            },
        ],
        [
            's',
            0,
            10,
            {
                x: 60,
                y: 60,
                width: 80,
                height: 90,
            },
        ],
        [
            'sw',
            -10,
            10,
            {
                x: 50,
                y: 60,
                width: 90,
                height: 90,
            },
        ],
        [
            'w',
            -10,
            0,
            {
                x: 50,
                y: 60,
                width: 90,
                height: 80,
            },
        ],
    ])('moves only the edges the "%s" handle owns', (handle, dx, dy, expected) => {
        expect(applyCropResize(base, handle, dx, dy, null, image)).toEqual(expected);
    });

    // A locked ratio is only honoured on the corner handles. That matches
    // `crop-overlay`, which renders corners only while a ratio is locked.
    // `base` is square, so a 1:1 lock would also "hold" on a result the lock never
    // touched. These cases start from an oblong crop and additionally assert the
    // locked result differs from the free-form one.
    const oblong = {
        x: 20,
        y: 40,
        width: 120,
        height: 60,
    };

    it.each(['nw', 'ne', 'se', 'sw'])('keeps a locked 1:1 aspect ratio while dragging "%s"', (handle) => {
        const result = applyCropResize(oblong, handle, 25, -15, 1, image);

        expect(result.width).toBeCloseTo(result.height, 4);
        expect(result).not.toEqual(applyCropResize(oblong, handle, 25, -15, null, image));
    });

    it.each(['nw', 'ne', 'se', 'sw'])('keeps a locked 2:1 aspect ratio while dragging "%s"', (handle) => {
        const result = applyCropResize(base, handle, -30, 10, 2, image);

        expect(result.width / result.height).toBeCloseTo(2, 4);
        expect(result).not.toEqual(applyCropResize(base, handle, -30, 10, null, image));
    });

    it.each(['n', 'e', 's', 'w'])('ignores a locked ratio on the "%s" edge handle', (handle) => {
        expect(applyCropResize(base, handle, 25, -15, 1, image)).toEqual(
            applyCropResize(base, handle, 25, -15, null, image),
        );
    });

    it('drives a corner resize by whichever axis moved further', () => {
        const widthDriven = applyCropResize(base, 'se', 60, 5, 1, image);
        const heightDriven = applyCropResize(base, 'se', 5, 60, 1, image);

        expect(widthDriven.width).toBeCloseTo(140, 4);
        expect(heightDriven.height).toBeCloseTo(140, 4);
    });

    it('ignores a non-finite or non-positive aspect ratio', () => {
        expect(applyCropResize(base, 'se', 20, 10, Number.NaN, image)).toEqual(
            applyCropResize(base, 'se', 20, 10, null, image),
        );
        expect(applyCropResize(base, 'se', 20, 10, 0, image)).toEqual(applyCropResize(base, 'se', 20, 10, null, image));
    });

    it('never shrinks below the minimum size', () => {
        const result = applyCropResize(base, 'se', -500, -500, null, image, 30);

        expect(result.width).toBeGreaterThanOrEqual(30);
        expect(result.height).toBeGreaterThanOrEqual(30);
    });

    it('keeps a locked aspect ratio inside the image when dragged past the edge', () => {
        const result = applyCropResize(base, 'se', 1000, 1000, 1, image);

        expect(result.x + result.width).toBeLessThanOrEqual(300 + 1e-6);
        expect(result.y + result.height).toBeLessThanOrEqual(300 + 1e-6);
        expect(result.width).toBeCloseTo(result.height, 4);
    });

    it('lets the crop leave the image in fit mode', () => {
        const result = applyCropResize(base, 'se', 1000, 1000, null, image, 50, 'fit');

        expect(result.width).toBeGreaterThan(300);
    });

    it('returns the crop untouched in crop mode when the image has no size', () => {
        expect(applyCropResize(base, 'se', 20, 20, null, { width: 0, height: 0 })).toEqual(base);
    });
});

describe('applyCropMove', () => {
    it('moves the crop by the given delta', () => {
        const crop = {
            x: 10,
            y: 10,
            width: 50,
            height: 50,
        };

        expect(applyCropMove(crop, 5, -5, { width: 200, height: 200 })).toEqual({
            x: 15,
            y: 5,
            width: 50,
            height: 50,
        });
    });

    it('clamps the move so the crop stays inside the image', () => {
        const crop = {
            x: 10,
            y: 10,
            width: 50,
            height: 50,
        };
        const result = applyCropMove(crop, 1000, 1000, { width: 200, height: 200 });

        expect(result.x + result.width).toBeLessThanOrEqual(200);
        expect(result.y + result.height).toBeLessThanOrEqual(200);
    });
});

describe('calculateCropAfterRotate90', () => {
    it('swaps and centers the crop within the rotated viewport keeping aspect ratio', () => {
        const result = calculateCropAfterRotate90(
            {
                x: 0,
                y: 0,
                width: 100,
                height: 50,
            },
            { width: 300, height: 200 },
            null,
        );

        expect(result.width / result.height).toBeCloseTo(2);
        expect(result.x).toBeCloseTo((200 - result.width) / 2);
        expect(result.y).toBeCloseTo((300 - result.height) / 2);
    });

    it('uses a locked aspect ratio when provided', () => {
        const result = calculateCropAfterRotate90(
            {
                x: 0,
                y: 0,
                width: 100,
                height: 50,
            },
            { width: 300, height: 200 },
            1,
        );

        expect(result.width / result.height).toBeCloseTo(1);
    });
});

describe('cropToPercentage / percentageToCrop', () => {
    it('converts a crop to percentages of the image dimensions', () => {
        const crop = {
            x: 25,
            y: 50,
            width: 50,
            height: 25,
        };

        expect(cropToPercentage(crop, { width: 100, height: 100 })).toEqual({
            x: 25,
            y: 50,
            width: 50,
            height: 25,
        });
    });

    it('round-trips through percentageToCrop back to the original crop', () => {
        const crop = {
            x: 10,
            y: 20,
            width: 30,
            height: 40,
        };
        const dims = { width: 200, height: 400 };
        const percent = cropToPercentage(crop, dims);
        const roundTripped = percentageToCrop(percent, dims);

        expect(roundTripped.x).toBeCloseTo(crop.x);
        expect(roundTripped.y).toBeCloseTo(crop.y);
        expect(roundTripped.width).toBeCloseTo(crop.width);
        expect(roundTripped.height).toBeCloseTo(crop.height);
    });
});
