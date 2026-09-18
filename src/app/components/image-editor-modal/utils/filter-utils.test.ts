import { describe, expect, it } from 'vitest';

import { BASIC_FILTERS } from '../components/filter/basic-filters';
import { LUT_FILTERS } from '../components/filter/lut-filters';

import { hexToRgb, isBasicFilter, isLutFilter } from './filter-utils';

describe('isBasicFilter', () => {
    it('is true for a known basic filter id', () => {
        const [first] = BASIC_FILTERS;

        expect(isBasicFilter(first.id)).toBe(true);
    });

    it('is false for an unknown id', () => {
        expect(isBasicFilter('not-a-real-filter')).toBe(false);
    });
});

describe('isLutFilter', () => {
    it('is true for a known LUT filter id', () => {
        const [first] = LUT_FILTERS;

        expect(isLutFilter(first.id)).toBe(true);
    });

    it('is false for an unknown id', () => {
        expect(isLutFilter('not-a-real-filter')).toBe(false);
    });
});

describe('hexToRgb', () => {
    it('parses a 6-digit hex color with a leading #', () => {
        expect(hexToRgb('#ff0000')).toEqual([255, 0, 0]);
    });

    it('parses a 6-digit hex color without a leading #', () => {
        expect(hexToRgb('00ff00')).toEqual([0, 255, 0]);
    });

    it('is case-insensitive', () => {
        expect(hexToRgb('#0000FF')).toEqual([0, 0, 255]);
    });

    it('throws for an invalid hex color', () => {
        expect(() => hexToRgb('not-a-color')).toThrow('Invalid hex color');
    });
});
