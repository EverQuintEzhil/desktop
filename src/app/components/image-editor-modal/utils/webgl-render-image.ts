import type { Adjustments, DuotoneColors, LutTexture } from '../types';

import { webglCache } from './webgl-cache';
import type { MultiPassPipelineContext } from './webgl-multipass-pipeline';
import { runMultiPassPipeline } from './webgl-multipass-pipeline';

interface RenderImageOptions {
    canvas: HTMLCanvasElement;
    image: HTMLImageElement;
    outputWidth: number;
    outputHeight: number;
    preserveDrawingBuffer?: boolean;
    filterEnabled?: boolean;
    filterIntensity?: number;
    selectedLut?: LutTexture;
    selectedDuotone?: DuotoneColors;
    adjustments?: Adjustments;
    adjustmentsEnabled?: boolean;
    texTransform?: Float32Array;
}

export const renderImageWithFilters = async (options: RenderImageOptions): Promise<void> => {
    const {
        canvas,
        image,
        outputWidth,
        outputHeight,
        preserveDrawingBuffer = true,
        filterEnabled = true,
        filterIntensity = 100,
        selectedLut,
        selectedDuotone,
        adjustments,
        adjustmentsEnabled = true,
        texTransform,
    } = options;

    const IDENTITY_TEX_TRANSFORM = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);

    const initialTexTransform = texTransform?.length === 9 ? texTransform : IDENTITY_TEX_TRANSFORM;

    const needsAdjustments = adjustmentsEnabled && adjustments;
    const hasDuotone = filterEnabled && selectedDuotone;
    const hasLut = filterEnabled && selectedLut && filterIntensity > 0;
    const needsFilter = hasDuotone || hasLut;
    const needsMultiPass = needsAdjustments || needsFilter;

    //Get cached WebGL resources (context, shaders, programs, buffers)
    const cache = webglCache.getOrCreateCache(canvas, !!needsAdjustments, !!needsFilter, { preserveDrawingBuffer });

    if (!cache) {
        throw new Error('WebGL not available');
    }

    const { gl, positionBuffer, texCoordBuffer, programs } = cache;

    if (gl.isContextLost()) {
        throw new Error('WebGL context lost');
    }

    canvas.width = outputWidth;
    canvas.height = outputHeight;

    // Clear the full canvas so any area outside the viewport is transparent.
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.viewport(0, 0, outputWidth, outputHeight);

    const positionLocation = 0;
    const texCoordLocation = 1;

    // Reuse cached base image texture for interactive updates.
    const imageKey = image.currentSrc || image.src || `${image.naturalWidth}x${image.naturalHeight}`;
    const texture = webglCache.getCachedOrCreateImageTexture(canvas, image, imageKey);

    if (!texture) {
        throw new Error('Failed to create texture');
    }

    let lutTexture: WebGLTexture | null = null;

    try {
        if (hasLut && selectedLut) {
            lutTexture = gl.createTexture();

            if (!lutTexture) {
                throw new Error('Failed to create LUT texture');
            }

            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, lutTexture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
            gl.texImage2D(
                gl.TEXTURE_2D,
                0,
                gl.RGBA,
                selectedLut.width,
                selectedLut.height,
                0,
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                selectedLut.pixels,
            );
        }

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        const drawPass = (
            shaderProgram: { program: WebGLProgram; uniforms: Record<string, WebGLUniformLocation | null> },
            inputTexture: WebGLTexture,
            outputFramebuffer: WebGLFramebuffer | null,
            passTexTransform: Float32Array,
            setUniforms?: () => void,
        ) => {
            const program = shaderProgram.program;

            gl.useProgram(program);
            gl.bindFramebuffer(gl.FRAMEBUFFER, outputFramebuffer);
            gl.viewport(0, 0, outputWidth, outputHeight);
            gl.clear(gl.COLOR_BUFFER_BIT);

            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            gl.enableVertexAttribArray(positionLocation);
            gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
            gl.enableVertexAttribArray(texCoordLocation);
            gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, inputTexture);

            // Bind sampler and tex transform via cached uniforms (no per-pass getUniformLocation).
            const imageLocation = shaderProgram.uniforms.u_image;
            const texTransformLocation = shaderProgram.uniforms.u_texTransform;

            if (imageLocation) gl.uniform1i(imageLocation, 0);
            if (texTransformLocation) gl.uniformMatrix3fv(texTransformLocation, false, passTexTransform);

            if (setUniforms) {
                setUniforms();
            }

            gl.drawArrays(gl.TRIANGLES, 0, 6);
        };

        if (!needsMultiPass) {
            drawPass(programs.basic, texture, null, initialTexTransform);

            // Reset key state so callers don't inherit our framebuffer/texture unit.
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.activeTexture(gl.TEXTURE0);

            return;
        }

        const pingPong = webglCache.getCachedOrCreatePingPong(canvas, outputWidth, outputHeight);

        if (!pingPong) {
            throw new Error('Failed to create ping-pong buffers');
        }

        const { pingTexture, pingFramebuffer, pongTexture, pongFramebuffer } = pingPong;
        let isPingCurrent = true;

        const getCurrentBuffer = () =>
            isPingCurrent
                ? { texture: pingTexture, framebuffer: pingFramebuffer }
                : { texture: pongTexture, framebuffer: pongFramebuffer };
        const getNextBuffer = () =>
            isPingCurrent
                ? { texture: pongTexture, framebuffer: pongFramebuffer }
                : { texture: pingTexture, framebuffer: pingFramebuffer };
        const swapBuffers = () => {
            isPingCurrent = !isPingCurrent;
        };

        const identityForNextPasses = IDENTITY_TEX_TRANSFORM;

        const multiPassContext: MultiPassPipelineContext = {
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
            needsAdjustments: !!needsAdjustments,
            adjustments,
            needsFilter: !!needsFilter,
            hasDuotone: !!hasDuotone,
            selectedDuotone,
            hasLut: !!hasLut,
            selectedLut,
            filterIntensity,
            lutTexture,
        };

        // isPingCurrent must stay true here: runMultiPassPipeline's first draw always targets
        // pingFramebuffer, so the ping-pong swap state must start in sync with that pass.
        isPingCurrent = true;

        const finalTexture = runMultiPassPipeline(multiPassContext);

        drawPass(programs.basic, finalTexture, null, identityForNextPasses);

        // Reset key state so callers don't inherit our framebuffer/texture unit.
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.activeTexture(gl.TEXTURE0);

        // Do NOT delete cached resources (programs, buffers, shaders, context)
        // They are managed by webglCache
    } finally {
        if (lutTexture) {
            try {
                gl.deleteTexture(lutTexture);
            } catch {
                // ignore
            }
        }
        // Ensure we don't leave the caller on a different active texture unit.
        try {
            gl.activeTexture(gl.TEXTURE0);
        } catch {
            // ignore
        }
    }
};
