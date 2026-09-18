import { describe, expect, it } from 'vitest';

import { defaultAdjustments, normalizeAdjustmentValue, normalizeGamma, normalizeShadows } from './adjustment-utils';

describe('defaultAdjustments', () => {
    it('has every numeric adjustment set to a neutral zero', () => {
        expect(defaultAdjustments.brightness).toBe(0);
        expect(defaultAdjustments.contrast).toBe(0);
        expect(defaultAdjustments.vignette).toEqual({ size: 0, amount: 0 });
        expect(defaultAdjustments.grain).toEqual({ amount: 0, size: 0 });
    });
});

describe('normalizeAdjustmentValue', () => {
    it('maps 0 to 0', () => {
        expect(normalizeAdjustmentValue(0)).toBe(0);
    });

    it('maps 100 to 1', () => {
        expect(normalizeAdjustmentValue(100)).toBe(1);
    });

    it('maps -100 to -1', () => {
        expect(normalizeAdjustmentValue(-100)).toBe(-1);
    });

    it('clamps values beyond the +/-100 boundary', () => {
        expect(normalizeAdjustmentValue(500)).toBe(1);
        expect(normalizeAdjustmentValue(-500)).toBe(-1);
    });
});

describe('normalizeShadows', () => {
    it('maps 0 to 0', () => {
        expect(normalizeShadows(0)).toBe(0);
    });

    it('doubles the normalized value', () => {
        expect(normalizeShadows(50)).toBeCloseTo(1);
    });

    it('clamps at the +/-2 boundary', () => {
        expect(normalizeShadows(100)).toBe(2);
        expect(normalizeShadows(-100)).toBe(-2);
    });
});

describe('normalizeGamma', () => {
    it('maps 0 to a neutral gamma of 1', () => {
        expect(normalizeGamma(0)).toBe(1);
    });

    it('maps a positive value above 1', () => {
        expect(normalizeGamma(100)).toBe(2);
    });

    it('maps a negative value using the halved slope below 1', () => {
        expect(normalizeGamma(-100)).toBe(0.5);
    });

    it('maps a mid-range negative value', () => {
        expect(normalizeGamma(-50)).toBeCloseTo(0.75);
    });
});
