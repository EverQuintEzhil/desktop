export const applyBlur = (imageData: ImageData, blurAmount: number, width: number, height: number): void => {
    if (blurAmount <= 0) return;

    const radius = Math.floor(blurAmount * 0.2);

    if (radius < 1) return;

    const { data } = imageData;

    const boxBlurH = (src: Uint8ClampedArray, dst: Uint8ClampedArray, w: number, h: number, r: number) => {
        const iarr = 1 / (r + r + 1);

        for (let i = 0; i < h; i++) {
            let ti = i * w;
            let li = ti;
            let ri = ti + r;

            const fvR = src[ti * 4];
            const fvG = src[ti * 4 + 1];
            const fvB = src[ti * 4 + 2];

            const lvR = src[(ti + w - 1) * 4];
            const lvG = src[(ti + w - 1) * 4 + 1];
            const lvB = src[(ti + w - 1) * 4 + 2];

            let valR = (r + 1) * fvR;
            let valG = (r + 1) * fvG;
            let valB = (r + 1) * fvB;

            for (let j = 0; j < r; j++) {
                valR += src[(ti + j) * 4];
                valG += src[(ti + j) * 4 + 1];
                valB += src[(ti + j) * 4 + 2];
            }

            for (let j = 0; j <= r; j++) {
                valR += src[ri++ * 4] - fvR;
                valG += src[ri++ * 4 + 1] - fvG;
                valB += src[ri++ * 4 + 2] - fvB;

                dst[ti * 4] = Math.round(valR * iarr);
                dst[ti * 4 + 1] = Math.round(valG * iarr);
                dst[ti * 4 + 2] = Math.round(valB * iarr);
                dst[ti * 4 + 3] = src[ti * 4 + 3];
                ti++;
            }

            for (let j = r + 1; j < w - r; j++) {
                valR += src[ri++ * 4] - src[li++ * 4];
                valG += src[ri++ * 4 + 1] - src[li++ * 4 + 1];
                valB += src[ri++ * 4 + 2] - src[li++ * 4 + 2];

                dst[ti * 4] = Math.round(valR * iarr);
                dst[ti * 4 + 1] = Math.round(valG * iarr);
                dst[ti * 4 + 2] = Math.round(valB * iarr);
                dst[ti * 4 + 3] = src[ti * 4 + 3];
                ti++;
            }

            for (let j = w - r; j < w; j++) {
                valR += lvR - src[li++ * 4];
                valG += lvG - src[li++ * 4 + 1];
                valB += lvB - src[li++ * 4 + 2];

                dst[ti * 4] = Math.round(valR * iarr);
                dst[ti * 4 + 1] = Math.round(valG * iarr);
                dst[ti * 4 + 2] = Math.round(valB * iarr);
                dst[ti * 4 + 3] = src[ti * 4 + 3];
                ti++;
            }
        }
    };

    const boxBlurT = (src: Uint8ClampedArray, dst: Uint8ClampedArray, w: number, h: number, r: number) => {
        const iarr = 1 / (r + r + 1);

        for (let i = 0; i < w; i++) {
            let ti = i;
            let li = ti;
            let ri = ti + r * w;

            const fvR = src[ti * 4];
            const fvG = src[ti * 4 + 1];
            const fvB = src[ti * 4 + 2];

            const lvR = src[(ti + w * (h - 1)) * 4];
            const lvG = src[(ti + w * (h - 1)) * 4 + 1];
            const lvB = src[(ti + w * (h - 1)) * 4 + 2];

            let valR = (r + 1) * fvR;
            let valG = (r + 1) * fvG;
            let valB = (r + 1) * fvB;

            for (let j = 0; j < r; j++) {
                valR += src[(ti + j * w) * 4];
                valG += src[(ti + j * w) * 4 + 1];
                valB += src[(ti + j * w) * 4 + 2];
            }

            for (let j = 0; j <= r; j++) {
                valR += src[ri * 4] - fvR;
                valG += src[ri * 4 + 1] - fvG;
                valB += src[ri * 4 + 2] - fvB;

                dst[ti * 4] = Math.round(valR * iarr);
                dst[ti * 4 + 1] = Math.round(valG * iarr);
                dst[ti * 4 + 2] = Math.round(valB * iarr);
                dst[ti * 4 + 3] = src[ti * 4 + 3];

                ri += w;
                ti += w;
            }

            for (let j = r + 1; j < h - r; j++) {
                valR += src[ri * 4] - src[li * 4];
                valG += src[ri * 4 + 1] - src[li * 4 + 1];
                valB += src[ri * 4 + 2] - src[li * 4 + 2];

                dst[ti * 4] = Math.round(valR * iarr);
                dst[ti * 4 + 1] = Math.round(valG * iarr);
                dst[ti * 4 + 2] = Math.round(valB * iarr);
                dst[ti * 4 + 3] = src[ti * 4 + 3];

                li += w;
                ri += w;
                ti += w;
            }

            for (let j = h - r; j < h; j++) {
                valR += lvR - src[li * 4];
                valG += lvG - src[li * 4 + 1];
                valB += lvB - src[li * 4 + 2];

                dst[ti * 4] = Math.round(valR * iarr);
                dst[ti * 4 + 1] = Math.round(valG * iarr);
                dst[ti * 4 + 2] = Math.round(valB * iarr);
                dst[ti * 4 + 3] = src[ti * 4 + 3];

                li += w;
                ti += w;
            }
        }
    };

    const temp = new Uint8ClampedArray(data);
    const result = new Uint8ClampedArray(data);

    boxBlurH(temp, result, width, height, radius);
    boxBlurT(result, temp, width, height, radius);

    data.set(temp);
};
