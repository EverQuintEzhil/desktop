export const clamp = (value: number, min = 0, max = 255): number => {
    return Math.max(min, Math.min(max, value));
};

export const rgbToHsl = (r: number, g: number, b: number): [number, number, number] => {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;

        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        switch (max) {
            case r:
                h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
                break;
            case g:
                h = ((b - r) / d + 2) / 6;
                break;
            case b:
                h = ((r - g) / d + 4) / 6;
                break;
        }
    }

    return [h, s, l];
};

export const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
    let r, g, b;

    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;

            return p;
        };

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;

        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }

    return [r * 255, g * 255, b * 255];
};

export const applyBrightness = (imageData: ImageData, brightness: number): void => {
    const { data } = imageData;
    const adjustment = brightness * 255;

    for (let i = 0; i < data.length; i += 4) {
        data[i] = clamp(data[i] + adjustment);
        data[i + 1] = clamp(data[i + 1] + adjustment);
        data[i + 2] = clamp(data[i + 2] + adjustment);
    }
};

export const applyContrast = (imageData: ImageData, contrast: number): void => {
    const { data } = imageData;
    const factor = contrast + 1;

    for (let i = 0; i < data.length; i += 4) {
        data[i] = clamp(((data[i] / 255 - 0.5) * factor + 0.5) * 255);
        data[i + 1] = clamp(((data[i + 1] / 255 - 0.5) * factor + 0.5) * 255);
        data[i + 2] = clamp(((data[i + 2] / 255 - 0.5) * factor + 0.5) * 255);
    }
};

export const applySaturation = (imageData: ImageData, saturation: number): void => {
    const { data } = imageData;
    const factor = saturation + 1;

    for (let i = 0; i < data.length; i += 4) {
        const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
        const newS = clamp(s * factor, 0, 1);
        const [r, g, b] = hslToRgb(h, newS, l);

        data[i] = clamp(r);
        data[i + 1] = clamp(g);
        data[i + 2] = clamp(b);
    }
};

export const applyVibrance = (imageData: ImageData, vibrance: number): void => {
    const { data } = imageData;
    const factor = -vibrance * 3.0;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i] / 255;
        const g = data[i + 1] / 255;
        const b = data[i + 2] / 255;

        const mx = Math.max(r, Math.max(g, b));
        const avg = (r + g + b) / 3.0;
        const amt = (mx - avg) * factor;

        const newR = r + (mx - r) * amt;
        const newG = g + (mx - g) * amt;
        const newB = b + (mx - b) * amt;

        data[i] = clamp(newR * 255);
        data[i + 1] = clamp(newG * 255);
        data[i + 2] = clamp(newB * 255);
    }
};

export const applyGamma = (imageData: ImageData, gamma: number): void => {
    const { data } = imageData;
    const gammaCorrection = 1.0 / Math.max(gamma, 0.0001);

    for (let i = 0; i < data.length; i += 4) {
        data[i] = clamp(Math.pow(data[i] / 255, gammaCorrection) * 255);
        data[i + 1] = clamp(Math.pow(data[i + 1] / 255, gammaCorrection) * 255);
        data[i + 2] = clamp(Math.pow(data[i + 2] / 255, gammaCorrection) * 255);
    }
};

export const applyTemperature = (imageData: ImageData, temperature: number): void => {
    const { data } = imageData;

    for (let i = 0; i < data.length; i += 4) {
        if (temperature > 0) {
            data[i] = clamp(data[i] + temperature * 40);
            data[i + 2] = clamp(data[i + 2] - temperature * 40);
        } else {
            data[i] = clamp(data[i] + temperature * 40);
            data[i + 2] = clamp(data[i + 2] - temperature * 40);
        }
    }
};

export const applyTint = (imageData: ImageData, tint: number): void => {
    const { data } = imageData;

    for (let i = 0; i < data.length; i += 4) {
        if (tint > 0) {
            // Magenta shift
            data[i] = clamp(data[i] + tint * 20);
            data[i + 1] = clamp(data[i + 1] - tint * 20);
            data[i + 2] = clamp(data[i + 2] + tint * 20);
        } else {
            // Green shift
            data[i] = clamp(data[i] - tint * 20);
            data[i + 1] = clamp(data[i + 1] + tint * 20);
            data[i + 2] = clamp(data[i + 2] - tint * 20);
        }
    }
};

export const applyExposure = (imageData: ImageData, exposure: number): void => {
    const { data } = imageData;
    const factor = Math.pow(2, exposure);

    for (let i = 0; i < data.length; i += 4) {
        data[i] = clamp(data[i] * factor);
        data[i + 1] = clamp(data[i + 1] * factor);
        data[i + 2] = clamp(data[i + 2] * factor);
    }
};

export const applyTonalAdjustments = (
    imageData: ImageData,
    shadows: number,
    highlights: number,
    whites: number,
    blacks: number,
): void => {
    const { data } = imageData;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i] / 255;
        const g = data[i + 1] / 255;
        const b = data[i + 2] / 255;

        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

        const shadowMask = Math.pow(1 - luminance, 2);
        const highlightMask = Math.pow(luminance, 2);

        const shadowAdjust = shadows * shadowMask;
        const highlightAdjust = highlights * highlightMask;
        const whiteAdjust = whites * luminance;
        const blackAdjust = blacks * (1 - luminance);

        const totalAdjust = shadowAdjust + highlightAdjust + whiteAdjust + blackAdjust;

        data[i] = clamp((r + totalAdjust) * 255);
        data[i + 1] = clamp((g + totalAdjust) * 255);
        data[i + 2] = clamp((b + totalAdjust) * 255);
    }
};
