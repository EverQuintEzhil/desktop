import type { DuotoneColors, LutTexture } from '../types';

import { clamp } from './canvas2d-color';
import { hexToRgb } from './filter-utils';

export const applyDehaze = (imageData: ImageData, dehaze: number): void => {
    if (Math.abs(dehaze) < 0.00001) return;

    const { data } = imageData;

    const gamma = 1.0 - dehaze * 0.5;
    const contrast = 1.0 + dehaze * 0.2;
    const gammaCorrection = 1.0 / Math.max(gamma, 0.0001);

    for (let i = 0; i < data.length; i += 4) {
        let r = data[i] / 255;
        let g = data[i + 1] / 255;
        let b = data[i + 2] / 255;

        // Gamma
        r = Math.pow(r, gammaCorrection);
        g = Math.pow(g, gammaCorrection);
        b = Math.pow(b, gammaCorrection);

        // Contrast
        r = (r - 0.5) * contrast + 0.5;
        g = (g - 0.5) * contrast + 0.5;
        b = (b - 0.5) * contrast + 0.5;

        data[i] = clamp(r * 255);
        data[i + 1] = clamp(g * 255);
        data[i + 2] = clamp(b * 255);
    }
};

export const applyDenoise = (imageData: ImageData, amount: number, width: number, height: number): void => {
    if (amount <= 0) return;

    const { data } = imageData;
    // Map 0-100 -> 50-0 exponent
    const exponent = Math.max(0, 50 * (1 - amount / 100));

    // Create a copy of the data to sample from
    const sourceData = new Uint8ClampedArray(data);

    // 5x5 kernel (radius 2)
    const radius = 2;

    for (let i = 0; i < data.length; i += 4) {
        const pixelIndex = i / 4;
        const x = pixelIndex % width;
        const y = Math.floor(pixelIndex / width);

        let rTotal = 0;
        let gTotal = 0;
        let bTotal = 0;
        let weightTotal = 0;

        const centerR = sourceData[i] / 255;
        const centerG = sourceData[i + 1] / 255;
        const centerB = sourceData[i + 2] / 255;

        for (let ky = -radius; ky <= radius; ky++) {
            for (let kx = -radius; kx <= radius; kx++) {
                const nx = x + kx;
                const ny = y + ky;

                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    const nIndex = (ny * width + nx) * 4;

                    const sampleR = sourceData[nIndex] / 255;
                    const sampleG = sourceData[nIndex + 1] / 255;
                    const sampleB = sourceData[nIndex + 2] / 255;

                    // Bilateral weight
                    // Shader: dot(sample.rgb - center.rgb, vec3(0.25))
                    const diffR = sampleR - centerR;
                    const diffG = sampleG - centerG;
                    const diffB = sampleB - centerB;
                    const colorDist = Math.abs(diffR * 0.25 + diffG * 0.25 + diffB * 0.25);

                    let weight = 1.0 - colorDist;

                    weight = Math.pow(weight, exponent);

                    rTotal += sampleR * weight;
                    gTotal += sampleG * weight;
                    bTotal += sampleB * weight;
                    weightTotal += weight;
                }
            }
        }

        if (weightTotal > 0) {
            data[i] = clamp((rTotal / weightTotal) * 255);
            data[i + 1] = clamp((gTotal / weightTotal) * 255);
            data[i + 2] = clamp((bTotal / weightTotal) * 255);
        }
    }
};

export const applyGrain = (imageData: ImageData, amount: number, size: number): void => {
    if (amount < 0.00001) return;

    const { data, width } = imageData;

    // Map size (0-1) to a pixel scale factor relative to width
    // Matches WebGL: scale = 1000.0 / (u_size * 9.0 + 1.0)
    // grainScale = width / scale
    const factor = size * 9.0 + 1.0;
    const grainScale = Math.max(1, Math.floor((width * factor) / 1000.0));

    // Simple pseudo-random function
    const rand = (x: number, y: number) => {
        return (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
    };

    // Overlay blending helper
    const overlay = (base: number, blend: number) => {
        return base < 0.5 ? 2.0 * base * blend : 1.0 - 2.0 * (1.0 - base) * (1.0 - blend);
    };

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i] / 255;
        const g = data[i + 1] / 255;
        const b = data[i + 2] / 255;

        // 1. Noise Generation
        const pixelIndex = i / 4;
        const x = pixelIndex % width;
        const y = Math.floor(pixelIndex / width);

        const nx = Math.floor(x / grainScale);
        const ny = Math.floor(y / grainScale);

        // Noise in 0-1 range
        const noise = Math.abs(rand(nx, ny));

        // 2. Luminance Masking
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
        let mask = 1.0 - Math.pow(2.0 * luminance - 1.0, 2.0);

        mask = Math.max(0.3, Math.min(1.0, mask));

        // 3. Strength Calculation
        // amount is 0-1. Normalize to 0-1 range.
        // Max opacity 1.0 for stronger grain
        const strength = amount * 1.0 * mask;

        // 4. Overlay Blending
        const rOverlay = overlay(r, noise);
        const gOverlay = overlay(g, noise);
        const bOverlay = overlay(b, noise);

        // Mix original with overlay result
        const finalR = r + (rOverlay - r) * strength;
        const finalG = g + (gOverlay - g) * strength;
        const finalB = b + (bOverlay - b) * strength;

        data[i] = clamp(finalR * 255);
        data[i + 1] = clamp(finalG * 255);
        data[i + 2] = clamp(finalB * 255);
    }
};

export const applyVignette = (
    imageData: ImageData,
    size: number,
    amount: number,
    width: number,
    height: number,
): void => {
    if (Math.abs(amount) < 0.00001) return;

    const { data } = imageData;
    const centerX = width / 2;
    const centerY = height / 2;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const dx = (x - centerX) / centerX;
            const dy = (y - centerY) / centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            const smoothstep = (edge0: number, edge1: number, val: number) => {
                const t = clamp((val - edge0) / (edge1 - edge0), 0.0, 1.0);

                return t * t * (3.0 - 2.0 * t);
            };

            const vignetteFactor = smoothstep(0.8, size * 0.799, dist * (amount + size));

            const idx = (y * width + x) * 4;

            data[idx] = clamp(data[idx] * vignetteFactor);
            data[idx + 1] = clamp(data[idx + 1] * vignetteFactor);
            data[idx + 2] = clamp(data[idx + 2] * vignetteFactor);
        }
    }
};

export const applyLUT = (imageData: ImageData, lut: LutTexture, intensity: number): void => {
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

export const applyDuotone = (imageData: ImageData, duotone: DuotoneColors, intensity: number): void => {
    const { data } = imageData;
    const darkRgb = hexToRgb(duotone.darkColor);
    const lightRgb = hexToRgb(duotone.lightColor);

    // WebGL shader logic:
    // intensity controls the curve (gamma-like), NOT opacity
    // p = clamp(intensity, -1.0, 1.0)
    const p = clamp(intensity, -1.0, 1.0);
    const EPS = 0.0000001;

    // Rec. 709 weights from WebGL shader
    const GRAYSCALE_WEIGHTS = { r: 0.2126, g: 0.7152, b: 0.0722 };

    for (let i = 0; i < data.length; i += 4) {
        let r = data[i] / 255;
        let g = data[i + 1] / 255;
        let b = data[i + 2] / 255;

        // Apply curve transformation based on intensity
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

        // Calculate luma
        const luma = clamp(r * GRAYSCALE_WEIGHTS.r + g * GRAYSCALE_WEIGHTS.g + b * GRAYSCALE_WEIGHTS.b, 0, 1);

        // Map to duotone colors
        // mix(dSrgb, lSrgb, luma)
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
