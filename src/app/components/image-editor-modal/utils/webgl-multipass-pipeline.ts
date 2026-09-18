import type { Adjustments, DuotoneColors, LutTexture } from '../types';

import { normalizeAdjustmentValue, normalizeGamma, normalizeShadows } from './adjustment-utils';
import { ColorMatrix } from './color-matrix';
import { hexToRgb } from './filter-utils';
import type { WebGLCacheEntry } from './webgl-cache-types';

type DrawPassFn = (
    shaderProgram: { program: WebGLProgram; uniforms: Record<string, WebGLUniformLocation | null> },
    inputTexture: WebGLTexture,
    outputFramebuffer: WebGLFramebuffer | null,
    passTexTransform: Float32Array,
    setUniforms?: () => void,
) => void;

export interface MultiPassPipelineContext {
    gl: WebGLRenderingContext;
    programs: WebGLCacheEntry['programs'];
    outputWidth: number;
    outputHeight: number;
    texture: WebGLTexture;
    initialTexTransform: Float32Array;
    identityTexTransform: Float32Array;
    drawPass: DrawPassFn;
    getCurrentBuffer: () => { texture: WebGLTexture; framebuffer: WebGLFramebuffer };
    getNextBuffer: () => { texture: WebGLTexture; framebuffer: WebGLFramebuffer };
    swapBuffers: () => void;
    pingFramebuffer: WebGLFramebuffer;
    needsAdjustments: boolean;
    adjustments?: Adjustments;
    needsFilter: boolean;
    hasDuotone: boolean;
    selectedDuotone?: DuotoneColors;
    hasLut: boolean;
    selectedLut?: LutTexture;
    filterIntensity: number;
    lutTexture: WebGLTexture | null;
}

/**
 * Runs the multi-pass adjustment/filter ping-pong pipeline (tonal adjustments, LUT/duotone
 * look, and the remaining global + detail passes) and returns the final rendered texture.
 * Pass ordering and ping-pong buffer swapping are behaviour-critical and must not be reordered.
 */
export const runMultiPassPipeline = (ctx: MultiPassPipelineContext): WebGLTexture => {
    const {
        gl,
        programs,
        outputWidth,
        outputHeight,
        texture,
        initialTexTransform,
        identityTexTransform: identityForNextPasses,
        drawPass,
        getCurrentBuffer,
        getNextBuffer,
        swapBuffers,
        pingFramebuffer,
        needsAdjustments,
        adjustments,
        needsFilter,
        hasDuotone,
        selectedDuotone,
        hasLut,
        selectedLut,
        filterIntensity,
        lutTexture,
    } = ctx;

    drawPass(programs.basic, texture, pingFramebuffer, initialTexTransform);

    // If both adjustments and LUT/duotone are enabled, run "tonal" adjustments first,
    // then apply the "look" (LUT/duotone), then finish with global color + detail.
    if (needsAdjustments && adjustments) {
        const sharpnessValue = normalizeAdjustmentValue(adjustments.sharpness);
        const clarityValue = normalizeAdjustmentValue(adjustments.clarity);
        const temperatureValue = normalizeAdjustmentValue(adjustments.temperature);
        const exposure = normalizeAdjustmentValue(adjustments.exposure);
        const gammaValue = normalizeGamma(adjustments.gamma);
        const shadowsValue = normalizeShadows(adjustments.shadows);
        const highlightsValue = normalizeAdjustmentValue(adjustments.highlights);
        const blacksValue = normalizeAdjustmentValue(adjustments.blacks);
        const whitesValue = normalizeAdjustmentValue(adjustments.whites);
        const brightness = normalizeAdjustmentValue(adjustments.brightness);
        const contrast = normalizeAdjustmentValue(adjustments.contrast);
        const saturation = normalizeAdjustmentValue(adjustments.saturation);
        const vibrance = normalizeAdjustmentValue(adjustments.vibrance);
        const tint = normalizeAdjustmentValue(adjustments.tint);
        const dehaze = normalizeAdjustmentValue(adjustments.dehaze.amount);
        const grainAmount = adjustments.grain.amount / 100;
        const grainSize = adjustments.grain.size / 100;
        const denoiseAmount = adjustments.denoise.amount;

        const pixelDx = 1 / Math.max(1, outputWidth);
        const pixelDy = 1 / Math.max(1, outputHeight);

        // 1. Temperature & Tint
        if ((Math.abs(temperatureValue) > 0.00001 || Math.abs(tint) > 0.00001) && programs.temperature) {
            const temperatureUniforms = programs.temperature.uniforms;
            const current = getCurrentBuffer();
            const next = getNextBuffer();

            drawPass(programs.temperature, current.texture, next.framebuffer, identityForNextPasses, () => {
                const uniforms = temperatureUniforms;

                if (uniforms.u_image) gl.uniform1i(uniforms.u_image, 0);
                if (uniforms.u_temperature) {
                    gl.uniform1f(uniforms.u_temperature, temperatureValue);
                }
                if (uniforms.u_tint) {
                    gl.uniform1f(uniforms.u_tint, tint);
                }
            });
            swapBuffers();
        }

        // 2. Tonal adjustments (exposure, gamma, shadows, highlights, whites, blacks)
        if (programs.adjustments) {
            const adjustmentsUniforms = programs.adjustments.uniforms;
            const current = getCurrentBuffer();
            const next = getNextBuffer();

            const toneMatrix = new ColorMatrix();

            toneMatrix.multiply(ColorMatrix.createExposureMatrix(exposure));

            const toneMat4 = toneMatrix.toMat4Array();
            const toneOffsets = toneMatrix.getOffsets();

            drawPass(programs.adjustments, current.texture, next.framebuffer, identityForNextPasses, () => {
                const uniforms = adjustmentsUniforms;

                if (uniforms.u_image) gl.uniform1i(uniforms.u_image, 0);
                if (uniforms.u_gamma) gl.uniform1f(uniforms.u_gamma, gammaValue);
                if (uniforms.u_shadows) gl.uniform1f(uniforms.u_shadows, shadowsValue);
                if (uniforms.u_highlights) gl.uniform1f(uniforms.u_highlights, highlightsValue);
                if (uniforms.u_whites) gl.uniform1f(uniforms.u_whites, whitesValue);
                if (uniforms.u_blacks) gl.uniform1f(uniforms.u_blacks, blacksValue);
                if (uniforms.u_colorMatrix) {
                    gl.uniformMatrix4fv(uniforms.u_colorMatrix, false, toneMat4);
                }
                if (uniforms.u_colorOffset) {
                    gl.uniform4f(
                        uniforms.u_colorOffset,
                        toneOffsets[0],
                        toneOffsets[1],
                        toneOffsets[2],
                        toneOffsets[3],
                    );
                }
            });
            swapBuffers();
        }

        // 3. LUT/Duotone (look) - apply after tonal mapping, before final global + detail.
        if (needsFilter && programs.filter) {
            const filterUniforms = programs.filter.uniforms;
            const current = getCurrentBuffer();
            const next = getNextBuffer();

            drawPass(programs.filter, current.texture, next.framebuffer, identityForNextPasses, () => {
                const uniforms = filterUniforms;

                if (uniforms.u_image) gl.uniform1i(uniforms.u_image, 0);

                if (hasDuotone && selectedDuotone) {
                    const darkRgb = hexToRgb(selectedDuotone.darkColor);
                    const lightRgb = hexToRgb(selectedDuotone.lightColor);
                    const normalizedIntensity = filterIntensity / 100;

                    if (uniforms.u_duotoneEnabled) gl.uniform1f(uniforms.u_duotoneEnabled, 1);
                    if (uniforms.u_duotoneIntensity) gl.uniform1f(uniforms.u_duotoneIntensity, normalizedIntensity);
                    if (uniforms.u_duotoneDark)
                        gl.uniform3f(uniforms.u_duotoneDark, darkRgb[0] / 255, darkRgb[1] / 255, darkRgb[2] / 255);
                    if (uniforms.u_duotoneLight)
                        gl.uniform3f(uniforms.u_duotoneLight, lightRgb[0] / 255, lightRgb[1] / 255, lightRgb[2] / 255);
                } else {
                    if (uniforms.u_duotoneEnabled) gl.uniform1f(uniforms.u_duotoneEnabled, 0);
                }

                if (hasLut && selectedLut && lutTexture) {
                    gl.activeTexture(gl.TEXTURE1);
                    gl.bindTexture(gl.TEXTURE_2D, lutTexture);
                    if (uniforms.u_lut) gl.uniform1i(uniforms.u_lut, 1);

                    const lutIntensity = filterIntensity / 100;

                    if (uniforms.u_lutEnabled) gl.uniform1f(uniforms.u_lutEnabled, 1);
                    if (uniforms.u_lutIntensity) gl.uniform1f(uniforms.u_lutIntensity, lutIntensity);
                    if (uniforms.u_lutSize) gl.uniform1f(uniforms.u_lutSize, selectedLut.lutSize);
                    if (uniforms.u_lutTilesX) gl.uniform1f(uniforms.u_lutTilesX, selectedLut.tilesX);
                    if (uniforms.u_lutTilesY) gl.uniform1f(uniforms.u_lutTilesY, selectedLut.tilesY);
                    if (uniforms.u_lutResolution) gl.uniform1f(uniforms.u_lutResolution, selectedLut.width);
                } else {
                    if (uniforms.u_lutEnabled) gl.uniform1f(uniforms.u_lutEnabled, 0);
                }
            });
            swapBuffers();
        }

        // 4. Brightness (after tonal/look; before contrast)
        if (programs.brightness && Math.abs(brightness) > 0.00001) {
            const brightnessUniforms = programs.brightness.uniforms;
            const current = getCurrentBuffer();
            const next = getNextBuffer();

            drawPass(programs.brightness, current.texture, next.framebuffer, identityForNextPasses, () => {
                const uniforms = brightnessUniforms;

                if (uniforms.u_image) gl.uniform1i(uniforms.u_image, 0);
                if (uniforms.u_brightness) {
                    gl.uniform1f(uniforms.u_brightness, brightness);
                }
            });
            swapBuffers();
        }

        // 5. Contrast (after tonal/brightness)
        if (programs.contrast && Math.abs(contrast) > 0.00001) {
            const contrastUniforms = programs.contrast.uniforms;
            const current = getCurrentBuffer();
            const next = getNextBuffer();

            drawPass(programs.contrast, current.texture, next.framebuffer, identityForNextPasses, () => {
                const uniforms = contrastUniforms;

                if (uniforms.u_image) gl.uniform1i(uniforms.u_image, 0);
                if (uniforms.u_contrast) {
                    gl.uniform1f(uniforms.u_contrast, contrast + 1);
                }
            });
            swapBuffers();
        }

        // 6. Saturation (color after global tonal/contrast)
        if (programs.saturation && Math.abs(saturation) > 0.00001) {
            const saturationUniforms = programs.saturation.uniforms;
            const current = getCurrentBuffer();
            const next = getNextBuffer();

            drawPass(programs.saturation, current.texture, next.framebuffer, identityForNextPasses, () => {
                const uniforms = saturationUniforms;

                if (uniforms.u_image) gl.uniform1i(uniforms.u_image, 0);
                if (uniforms.u_saturation) {
                    gl.uniform1f(uniforms.u_saturation, saturation + 1);
                }
            });
            swapBuffers();
        }

        // 7. Vibrance
        if (programs.vibrance && Math.abs(vibrance) > 0.00001) {
            const vibranceUniforms = programs.vibrance.uniforms;
            const current = getCurrentBuffer();
            const next = getNextBuffer();

            drawPass(programs.vibrance, current.texture, next.framebuffer, identityForNextPasses, () => {
                const uniforms = vibranceUniforms;

                if (uniforms.u_image) gl.uniform1i(uniforms.u_image, 0);
                if (uniforms.u_vibrance) {
                    gl.uniform1f(uniforms.u_vibrance, vibrance);
                }
            });
            swapBuffers();
        }

        // 8. Dehaze
        if (programs.dehaze && Math.abs(dehaze) > 0.00001) {
            const dehazeUniforms = programs.dehaze.uniforms;
            const current = getCurrentBuffer();
            const next = getNextBuffer();

            drawPass(programs.dehaze, current.texture, next.framebuffer, identityForNextPasses, () => {
                const uniforms = dehazeUniforms;

                if (uniforms.u_image) gl.uniform1i(uniforms.u_image, 0);
                if (uniforms.u_dehaze) {
                    gl.uniform1f(uniforms.u_dehaze, dehaze);
                }
            });
            swapBuffers();
        }

        // 9. Clarity (local contrast after global adjustments)
        if (Math.abs(clarityValue) > 0.00001 && programs.clarity) {
            const clarityUniforms = programs.clarity.uniforms;
            const current = getCurrentBuffer();
            const next = getNextBuffer();

            // img.ly clarity pass applies a small saturation/contrast matrix derived from clarity.
            const clarityMatrix = new ColorMatrix();

            clarityMatrix.multiply(ColorMatrix.createSaturationMatrix(-0.3 * clarityValue + 1));
            clarityMatrix.multiply(ColorMatrix.createContrastMatrix(0.1 * clarityValue + 1));
            const clarityMat4 = clarityMatrix.toMat4Array();
            const clarityOffsets = clarityMatrix.getOffsets();

            drawPass(programs.clarity, current.texture, next.framebuffer, identityForNextPasses, () => {
                const uniforms = clarityUniforms;

                if (uniforms.u_image) gl.uniform1i(uniforms.u_image, 0);
                if (uniforms.u_pixelDimension) {
                    gl.uniform2f(uniforms.u_pixelDimension, pixelDx, pixelDy);
                }
                if (uniforms.u_clarity) {
                    gl.uniform1f(uniforms.u_clarity, clarityValue);
                }
                if (uniforms.u_colorMatrix) {
                    gl.uniformMatrix4fv(uniforms.u_colorMatrix, false, clarityMat4);
                }
                if (uniforms.u_colorOffset) {
                    gl.uniform4f(
                        uniforms.u_colorOffset,
                        clarityOffsets[0],
                        clarityOffsets[1],
                        clarityOffsets[2],
                        clarityOffsets[3],
                    );
                }
            });
            swapBuffers();
        }

        // 10. Sharpness (applied near the end)
        if (Math.abs(sharpnessValue) > 0.00001 && programs.sharpness) {
            const sharpnessUniforms = programs.sharpness.uniforms;
            const current = getCurrentBuffer();
            const next = getNextBuffer();

            drawPass(programs.sharpness, current.texture, next.framebuffer, identityForNextPasses, () => {
                const uniforms = sharpnessUniforms;

                if (uniforms.u_image) gl.uniform1i(uniforms.u_image, 0);
                if (uniforms.u_pixelDimension) {
                    gl.uniform2f(uniforms.u_pixelDimension, pixelDx, pixelDy);
                }
                if (uniforms.u_sharpness) {
                    gl.uniform1f(uniforms.u_sharpness, sharpnessValue);
                }
            });
            swapBuffers();
        }

        // 11. Denoise
        // Exponent: 0 = strong blur, 50 = original image.
        // Map 0-100 slider to 50-0 exponent.
        if (denoiseAmount > 0 && programs.denoise) {
            const denoiseUniforms = programs.denoise.uniforms;
            // Map 0-100 -> 50-0
            // We clamp min exponent to 0.1 to avoid division by zero issues if any, though pow(x,0) is 1.
            const exponent = Math.max(0, 50 * (1 - denoiseAmount / 100));

            // Perform 2 iterations for stronger results
            for (let i = 0; i < 2; i++) {
                const current = getCurrentBuffer();
                const next = getNextBuffer();

                drawPass(programs.denoise, current.texture, next.framebuffer, identityForNextPasses, () => {
                    const uniforms = denoiseUniforms;

                    if (uniforms.u_image) gl.uniform1i(uniforms.u_image, 0);
                    if (uniforms.u_exponent) {
                        gl.uniform1f(uniforms.u_exponent, exponent);
                    }
                    if (uniforms.u_texSize) {
                        gl.uniform2f(uniforms.u_texSize, outputWidth, outputHeight);
                    }
                });
                swapBuffers();
            }
        }

        const blurAmount = adjustments.blur.amount;

        if (blurAmount > 0 && programs.blur) {
            const blurUniforms = programs.blur.uniforms;

            {
                const current = getCurrentBuffer();
                const next = getNextBuffer();

                drawPass(programs.blur, current.texture, next.framebuffer, identityForNextPasses, () => {
                    const uniforms = blurUniforms;

                    if (uniforms.u_image) gl.uniform1i(uniforms.u_image, 0);
                    if (uniforms.u_texSize) gl.uniform2f(uniforms.u_texSize, outputWidth, outputHeight);
                    if (uniforms.u_direction) gl.uniform2f(uniforms.u_direction, 1.0, 0.0);
                    if (uniforms.u_blurRadius) gl.uniform1f(uniforms.u_blurRadius, blurAmount);
                });
                swapBuffers();
            }

            {
                const current = getCurrentBuffer();
                const next = getNextBuffer();

                drawPass(programs.blur, current.texture, next.framebuffer, identityForNextPasses, () => {
                    const uniforms = blurUniforms;

                    if (uniforms.u_image) gl.uniform1i(uniforms.u_image, 0);
                    if (uniforms.u_texSize) gl.uniform2f(uniforms.u_texSize, outputWidth, outputHeight);
                    if (uniforms.u_direction) gl.uniform2f(uniforms.u_direction, 0.0, 1.0);
                    if (uniforms.u_blurRadius) gl.uniform1f(uniforms.u_blurRadius, blurAmount);
                });
                swapBuffers();
            }
        }

        // 12. Grain
        if (grainAmount > 0.00001 && programs.grain) {
            const grainUniforms = programs.grain.uniforms;
            const current = getCurrentBuffer();
            const next = getNextBuffer();

            drawPass(programs.grain, current.texture, next.framebuffer, identityForNextPasses, () => {
                const uniforms = grainUniforms;

                if (uniforms.u_image) gl.uniform1i(uniforms.u_image, 0);
                if (uniforms.u_amount) {
                    gl.uniform1f(uniforms.u_amount, grainAmount);
                }
                if (uniforms.u_size) {
                    gl.uniform1f(uniforms.u_size, grainSize);
                }
                if (uniforms.u_time) {
                    gl.uniform1f(uniforms.u_time, 0.0);
                }
            });
            swapBuffers();
        }

        // 13. Vignette (lens edge darkening, applied last)
        const vignetteSize = adjustments.vignette.size / 100;
        const vignetteAmount = adjustments.vignette.amount / 100;

        if (Math.abs(vignetteAmount) > 0.00001 && programs.vignette) {
            const vignetteUniforms = programs.vignette.uniforms;
            const current = getCurrentBuffer();
            const next = getNextBuffer();

            drawPass(programs.vignette, current.texture, next.framebuffer, identityForNextPasses, () => {
                const uniforms = vignetteUniforms;

                if (uniforms.u_image) gl.uniform1i(uniforms.u_image, 0);
                if (uniforms.u_size) {
                    gl.uniform1f(uniforms.u_size, vignetteSize);
                }
                if (uniforms.u_amount) {
                    gl.uniform1f(uniforms.u_amount, vignetteAmount);
                }
            });
            swapBuffers();
        }
    } else if (needsFilter && programs.filter) {
        // Filter-only flow: apply look directly after base draw.
        const filterUniforms = programs.filter.uniforms;
        const current = getCurrentBuffer();
        const next = getNextBuffer();

        drawPass(programs.filter, current.texture, next.framebuffer, identityForNextPasses, () => {
            const uniforms = filterUniforms;

            if (uniforms.u_image) gl.uniform1i(uniforms.u_image, 0);

            if (hasDuotone && selectedDuotone) {
                const darkRgb = hexToRgb(selectedDuotone.darkColor);
                const lightRgb = hexToRgb(selectedDuotone.lightColor);
                const normalizedIntensity = filterIntensity / 100;

                if (uniforms.u_duotoneEnabled) gl.uniform1f(uniforms.u_duotoneEnabled, 1);
                if (uniforms.u_duotoneIntensity) gl.uniform1f(uniforms.u_duotoneIntensity, normalizedIntensity);
                if (uniforms.u_duotoneDark)
                    gl.uniform3f(uniforms.u_duotoneDark, darkRgb[0] / 255, darkRgb[1] / 255, darkRgb[2] / 255);
                if (uniforms.u_duotoneLight)
                    gl.uniform3f(uniforms.u_duotoneLight, lightRgb[0] / 255, lightRgb[1] / 255, lightRgb[2] / 255);
            } else {
                if (uniforms.u_duotoneEnabled) gl.uniform1f(uniforms.u_duotoneEnabled, 0);
            }

            if (hasLut && selectedLut && lutTexture) {
                gl.activeTexture(gl.TEXTURE1);
                gl.bindTexture(gl.TEXTURE_2D, lutTexture);
                if (uniforms.u_lut) gl.uniform1i(uniforms.u_lut, 1);

                const lutIntensity = filterIntensity / 100;

                if (uniforms.u_lutEnabled) gl.uniform1f(uniforms.u_lutEnabled, 1);
                if (uniforms.u_lutIntensity) gl.uniform1f(uniforms.u_lutIntensity, lutIntensity);
                if (uniforms.u_lutSize) gl.uniform1f(uniforms.u_lutSize, selectedLut.lutSize);
                if (uniforms.u_lutTilesX) gl.uniform1f(uniforms.u_lutTilesX, selectedLut.tilesX);
                if (uniforms.u_lutTilesY) gl.uniform1f(uniforms.u_lutTilesY, selectedLut.tilesY);
                if (uniforms.u_lutResolution) gl.uniform1f(uniforms.u_lutResolution, selectedLut.width);
            } else {
                if (uniforms.u_lutEnabled) gl.uniform1f(uniforms.u_lutEnabled, 0);
            }
        });
        swapBuffers();
    }

    return getCurrentBuffer().texture;
};
