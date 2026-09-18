import { describe, expect, it } from 'vitest';

import { ColorMatrix } from './color-matrix';

const expectMat4ArrayCloseTo = (actual: Float32Array, expected: number[]) => {
    expect(actual.length).toBe(expected.length);
    expected.forEach((value, index) => {
        expect(actual[index]).toBeCloseTo(value, 5);
    });
};

describe('ColorMatrix constructor / IDENTITY', () => {
    it('defaults to the identity matrix', () => {
        const matrix = new ColorMatrix();

        expect(matrix.a).toBe(1);
        expect(matrix.g).toBe(1);
        expect(matrix.m).toBe(1);
        expect(matrix.s).toBe(1);
        expect(matrix.b).toBe(0);
        expect(matrix.e).toBe(0);
        expect(matrix.t).toBe(0);
    });

    it('IDENTITY produces a fresh identity instance', () => {
        expectMat4ArrayCloseTo(ColorMatrix.IDENTITY.toMat4Array(), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    });
});

describe('ColorMatrix.set', () => {
    it('overwrites every scalar field', () => {
        const matrix = new ColorMatrix();

        matrix.set(2, 0, 0, 0, 1, 0, 2, 0, 0, 1, 0, 0, 2, 0, 1, 0, 0, 0, 1, 0);

        expect(matrix.a).toBe(2);
        expect(matrix.e).toBe(1);
        expect(matrix.j).toBe(1);
        expect(matrix.o).toBe(1);
        expect(matrix.t).toBe(0);
    });
});

describe('ColorMatrix.getOffsets', () => {
    it('returns the [e, j, o, t] offset column', () => {
        const matrix = ColorMatrix.createBrightnessMatrix(0.2);

        expect(matrix.getOffsets()).toEqual([0.2, 0.2, 0.2, 0]);
    });
});

describe('ColorMatrix.createBrightnessMatrix', () => {
    it('adds the brightness amount to each color offset, leaving scale untouched', () => {
        const matrix = ColorMatrix.createBrightnessMatrix(0.2);

        expect(matrix.a).toBe(1);
        expect(matrix.g).toBe(1);
        expect(matrix.m).toBe(1);
        expect(matrix.e).toBe(0.2);
        expect(matrix.j).toBe(0.2);
        expect(matrix.o).toBe(0.2);
    });

    it('is the identity matrix at amount 0', () => {
        expect(ColorMatrix.createBrightnessMatrix(0)).toEqual(ColorMatrix.IDENTITY);
    });
});

describe('ColorMatrix.createContrastMatrix', () => {
    it('is the identity matrix at amount 1', () => {
        expect(ColorMatrix.createContrastMatrix(1)).toEqual(ColorMatrix.IDENTITY);
    });

    it('scales the diagonal and offsets by (1 - amount) / 2 at amount 0.5', () => {
        const matrix = ColorMatrix.createContrastMatrix(0.5);

        expect(matrix.a).toBe(0.5);
        expect(matrix.g).toBe(0.5);
        expect(matrix.m).toBe(0.5);
        expect(matrix.e).toBe(0.25);
        expect(matrix.j).toBe(0.25);
        expect(matrix.o).toBe(0.25);
    });
});

describe('ColorMatrix.createSaturationMatrix', () => {
    it('is the identity matrix at amount 1', () => {
        expect(ColorMatrix.createSaturationMatrix(1)).toEqual(ColorMatrix.IDENTITY);
    });

    it('uses luminance weights for full desaturation at amount 0', () => {
        const matrix = ColorMatrix.createSaturationMatrix(0);

        expect(matrix.a).toBeCloseTo(0.2125);
        expect(matrix.b).toBeCloseTo(0.7154);
        expect(matrix.c).toBeCloseTo(0.0721);
        expect(matrix.f).toBeCloseTo(0.2125);
        expect(matrix.g).toBeCloseTo(0.7154);
        expect(matrix.h).toBeCloseTo(0.0721);
    });
});

describe('ColorMatrix.createExposureMatrix', () => {
    it('is the identity matrix at amount 0', () => {
        expect(ColorMatrix.createExposureMatrix(0)).toEqual(ColorMatrix.IDENTITY);
    });

    it('doubles the diagonal scale at amount 1 (2^1)', () => {
        const matrix = ColorMatrix.createExposureMatrix(1);

        expect(matrix.a).toBe(2);
        expect(matrix.g).toBe(2);
        expect(matrix.m).toBe(2);
        expect(matrix.s).toBe(1);
    });
});

describe('ColorMatrix.multiply', () => {
    it('multiplying by IDENTITY leaves the matrix unchanged', () => {
        const brightness = ColorMatrix.createBrightnessMatrix(0.3);
        const before = brightness.toMat4Array();

        brightness.multiply(ColorMatrix.IDENTITY);

        expectMat4ArrayCloseTo(brightness.toMat4Array(), Array.from(before));
        expect(brightness.getOffsets()).toEqual([0.3, 0.3, 0.3, 0]);
    });

    it('multiplying IDENTITY by another matrix yields that matrix', () => {
        const identity = ColorMatrix.IDENTITY;
        const contrast = ColorMatrix.createContrastMatrix(0.5);

        identity.multiply(contrast);

        expect(identity).toEqual(contrast);
    });
});

describe('ColorMatrix.toMat4Array', () => {
    it('lays the matrix out row-major without the offset column', () => {
        const matrix = ColorMatrix.createExposureMatrix(1);

        expectMat4ArrayCloseTo(matrix.toMat4Array(), [2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1]);
    });
});
