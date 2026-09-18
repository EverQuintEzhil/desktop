import { describe, expect, it } from 'vitest';

import {
    buildTexTransformForFullImageWithDimensions,
    degreesToRadians,
    identityMat3,
    isQuarterTurnRotationDegrees,
    isRightAngleRotationDegrees,
    normalizeRotationDegrees,
    normalizeRotationTo360,
    radiansToDegrees,
} from './tex-transform-utils';

describe('degreesToRadians / radiansToDegrees', () => {
    it('converts 180 degrees to PI radians', () => {
        expect(degreesToRadians(180)).toBeCloseTo(Math.PI);
    });

    it('round-trips radians back to the original degrees', () => {
        expect(radiansToDegrees(degreesToRadians(57))).toBeCloseTo(57);
    });
});

describe('normalizeRotationTo360', () => {
    it('leaves an in-range value unchanged', () => {
        expect(normalizeRotationTo360(90)).toBe(90);
    });

    it('wraps a value above 360', () => {
        expect(normalizeRotationTo360(450)).toBe(90);
    });

    it('wraps a negative value into the 0-360 range', () => {
        expect(normalizeRotationTo360(-90)).toBe(270);
    });

    it('treats non-finite input as 0', () => {
        expect(normalizeRotationTo360(NaN)).toBe(0);
    });
});

describe('normalizeRotationDegrees', () => {
    it('leaves an in-range value unchanged', () => {
        expect(normalizeRotationDegrees(90)).toBe(90);
    });

    it('wraps a value above 180 into the negative range', () => {
        expect(normalizeRotationDegrees(270)).toBe(-90);
    });

    it('wraps a value below -180 into the positive range', () => {
        expect(normalizeRotationDegrees(-270)).toBe(90);
    });

    it('treats non-finite input as 0', () => {
        expect(normalizeRotationDegrees(NaN)).toBe(0);
    });
});

describe('isRightAngleRotationDegrees', () => {
    it('is true for exact right angles', () => {
        expect(isRightAngleRotationDegrees(90)).toBe(true);
        expect(isRightAngleRotationDegrees(180)).toBe(true);
        expect(isRightAngleRotationDegrees(0)).toBe(true);
    });

    it('is false for a non-right-angle rotation', () => {
        expect(isRightAngleRotationDegrees(45)).toBe(false);
    });
});

describe('isQuarterTurnRotationDegrees', () => {
    it('is true for 90 and -90', () => {
        expect(isQuarterTurnRotationDegrees(90)).toBe(true);
        expect(isQuarterTurnRotationDegrees(-90)).toBe(true);
    });

    it('is false for 0 or 180 (not a quarter turn)', () => {
        expect(isQuarterTurnRotationDegrees(0)).toBe(false);
        expect(isQuarterTurnRotationDegrees(180)).toBe(false);
    });

    it('is false for a non-right-angle rotation', () => {
        expect(isQuarterTurnRotationDegrees(45)).toBe(false);
    });
});

describe('identityMat3', () => {
    it('returns a 3x3 identity matrix', () => {
        expect(Array.from(identityMat3())).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    });
});

describe('buildTexTransformForFullImageWithDimensions', () => {
    it('collapses to the identity transform when there is no rotation, straighten, or flip and output matches image size', () => {
        const transform = buildTexTransformForFullImageWithDimensions(0, 0, false, false, 400, 300, 400, 300);

        expect(Array.from(transform)).toEqual(Array.from(identityMat3()));
    });

    it('produces a non-identity transform when rotation is applied', () => {
        const transform = buildTexTransformForFullImageWithDimensions(90, 0, false, false, 400, 300, 400, 300);

        expect(Array.from(transform)).not.toEqual(Array.from(identityMat3()));
    });
});
