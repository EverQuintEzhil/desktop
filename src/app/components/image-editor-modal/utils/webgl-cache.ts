import { ensureAdjustmentPrograms, ensureFilterProgram } from './webgl-cache-programs';
import type { WebGLCacheEntry } from './webgl-cache-types';
import { createProgram, createShader } from './webgl-shader-factory';
import { VERTEX_SHADER, FRAGMENT_SHADER_BASIC } from './webgl-shaders';

class WebGLResourceCache {
    private cache: WebGLCacheEntry | null = null;
    private listenerCanvas: HTMLCanvasElement | null = null;
    private onContextLost?: (e: Event) => void;
    private onContextRestored?: (e: Event) => void;
    private preserveDrawingBuffer: boolean = true;

    private createCache(canvas: HTMLCanvasElement): WebGLCacheEntry | null {
        // Ensure we have context loss listeners attached to the current canvas (and detached from any previous one).
        if (this.listenerCanvas && this.onContextLost && this.onContextRestored) {
            try {
                this.listenerCanvas.removeEventListener('webglcontextlost', this.onContextLost as EventListener);
                this.listenerCanvas.removeEventListener(
                    'webglcontextrestored',
                    this.onContextRestored as EventListener,
                );
            } catch {
                // ignore
            }
        }

        this.onContextLost = (e: Event) => {
            // Prevent default so the browser will allow context restoration.
            (e as WebGLContextEvent).preventDefault();
            // Drop cached resources; renderer will recreate on next call.
            this.releaseCachedResources();
        };

        this.onContextRestored = () => {
            // Context is restored; cache will be recreated lazily on next render.
            this.cache = null;
        };

        canvas.addEventListener('webglcontextlost', this.onContextLost as EventListener, false);
        canvas.addEventListener('webglcontextrestored', this.onContextRestored as EventListener, false);
        this.listenerCanvas = canvas;

        const gl = canvas.getContext('webgl', {
            alpha: true,
            premultipliedAlpha: false,
            // NOTE: For our current pipeline (WebGL offscreen canvas is later sampled via 2D drawImage),
            // we keep this true by default. It can be disabled via getOrCreateCache(..., {preserveDrawingBuffer:false})
            // in flows that don't need persistence.
            preserveDrawingBuffer: this.preserveDrawingBuffer,
            antialias: false,
        }) as WebGLRenderingContext | null;

        if (!gl) {
            // eslint-disable-next-line no-console
            console.warn('WebGL not supported, falling back to Canvas 2D');

            return null;
        }

        const vertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);

        if (!vertexShader) {
            throw new Error('Failed to create vertex shader');
        }

        const positionBuffer = gl.createBuffer();

        if (!positionBuffer) {
            throw new Error('Failed to create position buffer');
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

        const texCoordBuffer = gl.createBuffer();

        if (!texCoordBuffer) {
            throw new Error('Failed to create texCoord buffer');
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);

        // Create basic program (always needed)
        const basicFragmentShader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_BASIC);

        if (!basicFragmentShader) {
            throw new Error('Failed to create basic fragment shader');
        }

        const basicProgram = createProgram(gl, vertexShader, basicFragmentShader);

        if (!basicProgram) {
            throw new Error('Failed to create basic program');
        }

        const cache: WebGLCacheEntry = {
            gl,
            canvas,
            vertexShader,
            positionBuffer,
            texCoordBuffer,
            programs: {
                basic: {
                    program: basicProgram,
                    uniforms: {
                        u_image: gl.getUniformLocation(basicProgram, 'u_image'),
                        u_texTransform: gl.getUniformLocation(basicProgram, 'u_texTransform'),
                    },
                },
            },
        };

        return cache;
    }

    private getOrCreateImageTexture(cache: WebGLCacheEntry, image: HTMLImageElement, imageKey: string): WebGLTexture {
        const { gl } = cache;

        if (cache.imageTexture && cache.imageKey === imageKey) {
            return cache.imageTexture;
        }

        if (cache.imageTexture) {
            try {
                gl.deleteTexture(cache.imageTexture);
            } catch {
                // ignore
            }
            cache.imageTexture = undefined;
            cache.imageKey = undefined;
        }

        const texture = gl.createTexture();

        if (!texture) throw new Error('Failed to create texture');

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

        cache.imageTexture = texture;
        cache.imageKey = imageKey;

        return texture;
    }

    private getOrCreatePingPong(
        cache: WebGLCacheEntry,
        width: number,
        height: number,
    ): {
        pingTexture: WebGLTexture;
        pingFramebuffer: WebGLFramebuffer;
        pongTexture: WebGLTexture;
        pongFramebuffer: WebGLFramebuffer;
    } {
        const { gl } = cache;

        const sameSize = cache.pingPongWidth === width && cache.pingPongHeight === height;
        const hasAll = !!(cache.pingTexture && cache.pingFramebuffer && cache.pongTexture && cache.pongFramebuffer);

        if (sameSize && hasAll) {
            return {
                pingTexture: cache.pingTexture!,
                pingFramebuffer: cache.pingFramebuffer!,
                pongTexture: cache.pongTexture!,
                pongFramebuffer: cache.pongFramebuffer!,
            };
        }

        // Reallocate
        if (cache.pingTexture) gl.deleteTexture(cache.pingTexture);
        if (cache.pingFramebuffer) gl.deleteFramebuffer(cache.pingFramebuffer);
        if (cache.pongTexture) gl.deleteTexture(cache.pongTexture);
        if (cache.pongFramebuffer) gl.deleteFramebuffer(cache.pongFramebuffer);

        const pingTexture = gl.createTexture();
        const pingFramebuffer = gl.createFramebuffer();
        const pongTexture = gl.createTexture();
        const pongFramebuffer = gl.createFramebuffer();

        if (!pingTexture || !pingFramebuffer || !pongTexture || !pongFramebuffer) {
            throw new Error('Failed to create ping-pong framebuffers');
        }

        gl.bindTexture(gl.TEXTURE_2D, pingTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

        gl.bindFramebuffer(gl.FRAMEBUFFER, pingFramebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, pingTexture, 0);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
            throw new Error('Ping framebuffer incomplete');
        }

        gl.bindTexture(gl.TEXTURE_2D, pongTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

        gl.bindFramebuffer(gl.FRAMEBUFFER, pongFramebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, pongTexture, 0);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
            throw new Error('Pong framebuffer incomplete');
        }

        cache.pingTexture = pingTexture;
        cache.pingFramebuffer = pingFramebuffer;
        cache.pongTexture = pongTexture;
        cache.pongFramebuffer = pongFramebuffer;
        cache.pingPongWidth = width;
        cache.pingPongHeight = height;

        return {
            pingTexture,
            pingFramebuffer,
            pongTexture,
            pongFramebuffer,
        };
    }

    getOrCreateCache(
        canvas: HTMLCanvasElement,
        needsAdjustments: boolean,
        needsFilter: boolean,
        options?: { preserveDrawingBuffer?: boolean },
    ): WebGLCacheEntry | null {
        const nextPreserve = options?.preserveDrawingBuffer ?? true;
        const preserveChanged = this.preserveDrawingBuffer !== nextPreserve;

        this.preserveDrawingBuffer = nextPreserve;

        // If we don't have a cache or the canvas changed, create new cache
        if (this.cache?.canvas !== canvas || preserveChanged) {
            this.releaseCachedResources();
            this.cache = this.createCache(canvas);

            if (!this.cache) {
                return null;
            }
        }

        // Ensure required programs are created
        if (needsAdjustments) {
            ensureAdjustmentPrograms(this.cache);
        }

        if (needsFilter) {
            ensureFilterProgram(this.cache);
        }

        return this.cache;
    }

    getCachedOrCreateImageTexture(
        canvas: HTMLCanvasElement,
        image: HTMLImageElement,
        imageKey: string,
    ): WebGLTexture | null {
        const cache = this.getOrCreateCache(canvas, false, false, {
            preserveDrawingBuffer: this.preserveDrawingBuffer,
        });

        if (!cache) return null;

        return this.getOrCreateImageTexture(cache, image, imageKey);
    }

    getCachedOrCreatePingPong(
        canvas: HTMLCanvasElement,
        width: number,
        height: number,
    ): {
        pingTexture: WebGLTexture;
        pingFramebuffer: WebGLFramebuffer;
        pongTexture: WebGLTexture;
        pongFramebuffer: WebGLFramebuffer;
    } | null {
        const cache = this.getOrCreateCache(canvas, true, true, { preserveDrawingBuffer: this.preserveDrawingBuffer });

        if (!cache) return null;

        return this.getOrCreatePingPong(cache, width, height);
    }

    private releaseCachedResources(): void {
        if (!this.cache) return;

        const { gl, vertexShader, positionBuffer, texCoordBuffer, programs } = this.cache;

        // Delete all programs
        Object.values(programs).forEach((prog) => {
            if (prog?.program) {
                gl.deleteProgram(prog.program);
            }
        });

        // Delete buffers
        gl.deleteBuffer(positionBuffer);
        gl.deleteBuffer(texCoordBuffer);

        // Delete cached textures/buffers
        if (this.cache.imageTexture) gl.deleteTexture(this.cache.imageTexture);
        if (this.cache.pingTexture) gl.deleteTexture(this.cache.pingTexture);
        if (this.cache.pingFramebuffer) gl.deleteFramebuffer(this.cache.pingFramebuffer);
        if (this.cache.pongTexture) gl.deleteTexture(this.cache.pongTexture);
        if (this.cache.pongFramebuffer) gl.deleteFramebuffer(this.cache.pongFramebuffer);

        // Delete vertex shader
        gl.deleteShader(vertexShader);

        this.cache = null;

        // Detach context listeners from the last known canvas.
        if (this.listenerCanvas && this.onContextLost && this.onContextRestored) {
            try {
                this.listenerCanvas.removeEventListener('webglcontextlost', this.onContextLost as EventListener);
                this.listenerCanvas.removeEventListener(
                    'webglcontextrestored',
                    this.onContextRestored as EventListener,
                );
            } catch {
                // ignore
            }
        }
        this.listenerCanvas = null;
    }

    // `canvas` is the canvas the caller owns and is discarding; pass null when the caller owns
    // none. This cache holds a single slot that any canvas in the editor may occupy, so a caller
    // may only lose the context of the canvas it owns — see the ownership invariant below.
    destroyCache(canvas: HTMLCanvasElement | null): void {
        const cachedCanvas = this.cache?.canvas ?? null;
        const gl = this.cache?.gl;

        this.releaseCachedResources();

        // Three invariants govern this call:
        // - Ownership: only the canvas currently cached may have its context lost. A foreign or
        //   null canvas gets resource release only, because losing a context another live
        //   component still renders through permanently breaks that component.
        // - Irreversibility: getContext() keeps handing back the lost context until
        //   restoreContext(), so this belongs only on a discard path and never on the
        //   canvas-switch rebuild in getOrCreateCache.
        // - Ordering: loseContext() dispatches webglcontextlost synchronously, which is safe only
        //   because releaseCachedResources has already detached the listeners and nulled the
        //   cache — otherwise onContextLost would call preventDefault() and ask the browser to
        //   keep the context alive.
        if (canvas && canvas === cachedCanvas) {
            gl?.getExtension('WEBGL_lose_context')?.loseContext();
        }
    }
}

// Export singleton instance
export const webglCache = new WebGLResourceCache();
