import type { DuotoneColors, LutTexture } from '../types';

export interface ThumbnailConfig {
    width: number;
    height: number;
    quality?: number;
}

export const DEFAULT_THUMBNAIL_CONFIG: ThumbnailConfig = {
    width: 400,
    height: 300,
    quality: 0.92,
};

const clamp = (value: number, min = 0, max = 255): number => {
    return Math.max(min, Math.min(max, value));
};

const hexToRgb = (hex: string): [number, number, number] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

    return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [0, 0, 0];
};

const applyDuotone = (imageData: ImageData, duotone: DuotoneColors, intensity: number): void => {
    const { data } = imageData;
    const darkRgb = hexToRgb(duotone.darkColor);
    const lightRgb = hexToRgb(duotone.lightColor);

    const p = clamp(intensity, -1.0, 1.0);
    const EPS = 0.0000001;
    const GRAYSCALE_WEIGHTS = { r: 0.2126, g: 0.7152, b: 0.0722 };

    for (let i = 0; i < data.length; i += 4) {
        let r = data[i] / 255;
        let g = data[i + 1] / 255;
        let b = data[i + 2] / 255;

        if (p > 0.0) {
            const power = Math.max(p + 1.0, EPS);

            r = 1.0 - Math.pow(1.0 - r, power);
            g = 1.0 - Math.pow(1.0 - g, power);
            b = 1.0 - Math.pow(1.0 - b, power);
        } else {
            const power = Math.max(-p + 1.0, EPS);

            r = Math.pow(r, power);
            g = Math.pow(g, power);
            b = Math.pow(b, power);
        }

        const luma = clamp(r * GRAYSCALE_WEIGHTS.r + g * GRAYSCALE_WEIGHTS.g + b * GRAYSCALE_WEIGHTS.b, 0, 1);

        const dr = darkRgb[0] / 255;
        const dg = darkRgb[1] / 255;
        const db = darkRgb[2] / 255;

        const lr = lightRgb[0] / 255;
        const lg = lightRgb[1] / 255;
        const lb = lightRgb[2] / 255;

        const finalR = dr * (1 - luma) + lr * luma;
        const finalG = dg * (1 - luma) + lg * luma;
        const finalB = db * (1 - luma) + lb * luma;

        data[i] = clamp(finalR * 255);
        data[i + 1] = clamp(finalG * 255);
        data[i + 2] = clamp(finalB * 255);
    }
};

const applyLUT = (imageData: ImageData, lut: LutTexture, intensity: number): void => {
    const { data } = imageData;
    const { pixels, lutSize, tilesX, width: lutWidth } = lut;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i] / 255;
        const g = data[i + 1] / 255;
        const b = data[i + 2] / 255;

        const blue = Math.floor(b * (lutSize - 1));
        const green = Math.floor(g * (lutSize - 1));
        const red = Math.floor(r * (lutSize - 1));

        const tileX = blue % tilesX;
        const tileY = Math.floor(blue / tilesX);

        const pixelX = tileX * lutSize + red;
        const pixelY = tileY * lutSize + green;

        const lutIndex = (pixelY * lutWidth + pixelX) * 4;

        const lutR = pixels[lutIndex];
        const lutG = pixels[lutIndex + 1];
        const lutB = pixels[lutIndex + 2];

        data[i] = clamp(data[i] + (lutR - data[i]) * intensity);
        data[i + 1] = clamp(data[i + 1] + (lutG - data[i + 1]) * intensity);
        data[i + 2] = clamp(data[i + 2] + (lutB - data[i + 2]) * intensity);
    }
};

const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();

        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = (error) => reject(new Error(`Failed to load image: ${error}`));
        img.src = url;
    });
};

export const generateDuotoneThumbnail = async (
    imageUrl: string,
    duotone: DuotoneColors,
    config: Partial<ThumbnailConfig> = {},
): Promise<string> => {
    const { width, height, quality } = { ...DEFAULT_THUMBNAIL_CONFIG, ...config };

    try {
        const img = await loadImage(imageUrl);

        const aspectRatio = img.width / img.height;
        let thumbWidth = width;
        let thumbHeight = height;

        if (aspectRatio > width / height) {
            thumbHeight = Math.round(width / aspectRatio);
        } else {
            thumbWidth = Math.round(height * aspectRatio);
        }

        const canvas = document.createElement('canvas');

        canvas.width = thumbWidth;
        canvas.height = thumbHeight;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (!ctx) {
            throw new Error('Failed to get 2D context');
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        ctx.drawImage(img, 0, 0, thumbWidth, thumbHeight);

        const imageData = ctx.getImageData(0, 0, thumbWidth, thumbHeight);

        applyDuotone(imageData, duotone, 1.0);

        ctx.putImageData(imageData, 0, 0);

        return canvas.toDataURL('image/jpeg', quality);
    } catch (error) {
        console.error('Error generating duotone thumbnail:', error);
        throw error;
    }
};

export const generateLutThumbnail = async (
    imageUrl: string,
    lut: LutTexture,
    config: Partial<ThumbnailConfig> = {},
): Promise<string> => {
    const { width, height, quality } = { ...DEFAULT_THUMBNAIL_CONFIG, ...config };

    try {
        const img = await loadImage(imageUrl);

        const aspectRatio = img.width / img.height;
        let thumbWidth = width;
        let thumbHeight = height;

        if (aspectRatio > width / height) {
            thumbHeight = Math.round(width / aspectRatio);
        } else {
            thumbWidth = Math.round(height * aspectRatio);
        }

        const canvas = document.createElement('canvas');

        canvas.width = thumbWidth;
        canvas.height = thumbHeight;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (!ctx) {
            throw new Error('Failed to get 2D context');
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        ctx.drawImage(img, 0, 0, thumbWidth, thumbHeight);

        const imageData = ctx.getImageData(0, 0, thumbWidth, thumbHeight);

        applyLUT(imageData, lut, 1.0);

        ctx.putImageData(imageData, 0, 0);

        return canvas.toDataURL('image/jpeg', quality);
    } catch (error) {
        console.error('Error generating LUT thumbnail:', error);
        throw error;
    }
};
