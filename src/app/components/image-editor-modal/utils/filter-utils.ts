import { BASIC_FILTERS } from '../components/filter/basic-filters';
import { LUT_FILTERS } from '../components/filter/lut-filters';
import type { LutFilterOption, LutTexture } from '../types';

export const isBasicFilter = (filterId: string): boolean => {
    return BASIC_FILTERS.some((filter) => filter.id === filterId);
};

export const isLutFilter = (filterId: string): boolean => {
    return LUT_FILTERS.some((filter) => filter.id === filterId);
};

export const hexToRgb = (hex: string): [number, number, number] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

    if (!result) {
        throw new Error(`Invalid hex color: ${hex}`);
    }

    return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)];
};

export const loadLutTexture = async (filter: LutFilterOption): Promise<LutTexture> => {
    const img = new Image();

    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.src = filter.lutUri;

    await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('lut-load-failed'));
    });

    const canvas = document.createElement('canvas');

    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (!ctx) throw new Error('no-canvas-context');

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const lutSize = filter.tilesX * filter.tilesY;

    return {
        pixels: data,
        width: canvas.width,
        height: canvas.height,
        tilesX: filter.tilesX,
        tilesY: filter.tilesY,
        lutSize,
    };
};
