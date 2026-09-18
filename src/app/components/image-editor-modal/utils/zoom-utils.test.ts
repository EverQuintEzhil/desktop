import { describe, expect, it } from 'vitest';

import {
    calculateDisplaySize,
    calculateFitZoomLevel,
    clampZoom,
    getNextZoomStep,
    getPreviousZoomStep,
    MAX_ZOOM,
    MIN_ZOOM,
} from './zoom-utils';

describe('clampZoom', () => {
    it('returns the value unchanged when within bounds', () => {
        expect(clampZoom(100)).toBe(100);
    });

    it('clamps below the minimum', () => {
        expect(clampZoom(-10)).toBe(MIN_ZOOM);
    });

    it('clamps above the maximum', () => {
        expect(clampZoom(999999)).toBe(MAX_ZOOM);
    });
});

describe('getNextZoomStep', () => {
    it('returns the next larger preset step', () => {
        expect(getNextZoomStep(100)).toBe(200);
    });

    it('returns MAX_ZOOM when already past the largest step', () => {
        expect(getNextZoomStep(5000)).toBe(MAX_ZOOM);
    });
});

describe('getPreviousZoomStep', () => {
    it('returns the previous smaller preset step', () => {
        expect(getPreviousZoomStep(100)).toBe(50);
    });

    it('returns MIN_ZOOM when already at or below the smallest step', () => {
        expect(getPreviousZoomStep(10)).toBe(MIN_ZOOM);
    });
});

describe('calculateFitZoomLevel', () => {
    it('computes the zoom percentage that fits image into container', () => {
        const zoom = calculateFitZoomLevel({ width: 1000, height: 500 }, { width: 500, height: 500 });

        expect(zoom).toBe(50);
    });

    it('falls back to 100 when dimensions are missing', () => {
        const zoom = calculateFitZoomLevel({ width: 0, height: 500 }, { width: 500, height: 500 });

        expect(zoom).toBe(100);
    });
});

describe('calculateDisplaySize', () => {
    it('scales dimensions by the zoom percentage', () => {
        expect(calculateDisplaySize({ width: 200, height: 100 }, 50)).toEqual({ width: 100, height: 50 });
    });

    it('is a no-op at 100% zoom', () => {
        expect(calculateDisplaySize({ width: 200, height: 100 }, 100)).toEqual({ width: 200, height: 100 });
    });

    it('falls back to 100x100 when dimensions are missing', () => {
        expect(calculateDisplaySize({ width: 0, height: 0 }, 100)).toEqual({ width: 100, height: 100 });
    });
});
