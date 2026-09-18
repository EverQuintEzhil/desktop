import { clamp } from './canvas2d-color';

export const applyConvolution = (imageData: ImageData, kernel: number[], width: number, height: number): ImageData => {
    const src = imageData.data;
    const output = new ImageData(width, height);
    const dst = output.data;

    const kernelSize = Math.sqrt(kernel.length);
    const half = Math.floor(kernelSize / 2);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let r = 0,
                g = 0,
                b = 0;

            for (let ky = 0; ky < kernelSize; ky++) {
                for (let kx = 0; kx < kernelSize; kx++) {
                    const px = clamp(x + kx - half, 0, width - 1);
                    const py = clamp(y + ky - half, 0, height - 1);
                    const idx = (py * width + px) * 4;
                    const weight = kernel[ky * kernelSize + kx];

                    r += src[idx] * weight;
                    g += src[idx + 1] * weight;
                    b += src[idx + 2] * weight;
                }
            }

            const outIdx = (y * width + x) * 4;

            dst[outIdx] = clamp(r);
            dst[outIdx + 1] = clamp(g);
            dst[outIdx + 2] = clamp(b);
            dst[outIdx + 3] = src[outIdx + 3];
        }
    }

    return output;
};

export const applySharpness = (imageData: ImageData, sharpness: number, width: number, height: number): void => {
    if (Math.abs(sharpness) < 0.00001) return;

    const amount = sharpness;
    const kernel = [0, -amount, 0, -amount, 1 + 4 * amount, -amount, 0, -amount, 0];

    const sharpened = applyConvolution(imageData, kernel, width, height);

    imageData.data.set(sharpened.data);
};

export const applyClarity = (imageData: ImageData, clarity: number, width: number, height: number): void => {
    if (Math.abs(clarity) < 0.00001) return;

    // WebGL uses a box blur (average of 9 pixels)
    const boxKernel = [1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9];

    const blurred = applyConvolution(imageData, boxKernel, width, height);
    const { data } = imageData;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i] / 255;
        const g = data[i + 1] / 255;
        const b = data[i + 2] / 255;

        const blurredR = blurred.data[i] / 255;
        const blurredG = blurred.data[i + 1] / 255;
        const blurredB = blurred.data[i + 2] / 255;

        // Calculate gray value (luminance)
        const grayValue = clamp(r * 0.3 + g * 0.59 + b * 0.1, 0.111111, 0.999999);

        // Calculate frequency factor (masking)
        // smoothstep(edge0, edge1, x) = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0)
        // smoothstep(1.0 - grayValue, 0.0, 0.11)
        // smoothstep(grayValue, 0.0, 0.11)

        const smoothstep = (edge0: number, edge1: number, x: number) => {
            const t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);

            return t * t * (3.0 - 2.0 * t);
        };

        const f1 = smoothstep(1.0 - grayValue, 0.0, 0.11);
        const f2 = smoothstep(grayValue, 0.0, 0.11);
        const frequenceFactor = Math.min(f1, f2);

        // Apply clarity formula from WebGL shader
        // color + clamp((color - mergedColor) * u_clarity * 3.7 * frequenceFactor, 0.0, 10.0)
        const factor = clarity * 3.7 * frequenceFactor;

        let newR = r + clamp((r - blurredR) * factor, 0.0, 10.0);
        let newG = g + clamp((g - blurredG) * factor, 0.0, 10.0);
        let newB = b + clamp((b - blurredB) * factor, 0.0, 10.0);

        // Exposure compensation
        // color * pow(2.0, u_clarity * 0.27 * frequenceFactor)
        const exposureComp = Math.pow(2.0, clarity * 0.27 * frequenceFactor);

        newR *= exposureComp;
        newG *= exposureComp;
        newB *= exposureComp;

        data[i] = clamp(newR * 255);
        data[i + 1] = clamp(newG * 255);
        data[i + 2] = clamp(newB * 255);
    }
};
