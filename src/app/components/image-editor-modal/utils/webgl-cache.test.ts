import { afterEach, describe, expect, it, vi } from 'vitest';

import { webglCache } from './webgl-cache';

interface FakeGlHarness {
    canvas: HTMLCanvasElement;
    loseContext: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
}

const createFakeGlCanvas = (callLog: string[], label: string): FakeGlHarness => {
    const loseContext = vi.fn(() => {
        callLog.push(`${label}:loseContext`);
    });
    const removeEventListener = vi.fn(() => {
        callLog.push(`${label}:removeEventListener`);
    });

    const gl = {
        VERTEX_SHADER: 1,
        FRAGMENT_SHADER: 2,
        ARRAY_BUFFER: 3,
        STATIC_DRAW: 4,
        COMPILE_STATUS: 5,
        LINK_STATUS: 6,
        createShader: () => ({}),
        shaderSource: () => undefined,
        compileShader: () => undefined,
        getShaderParameter: () => true,
        getShaderInfoLog: () => '',
        deleteShader: () => undefined,
        createProgram: () => ({}),
        attachShader: () => undefined,
        bindAttribLocation: () => undefined,
        linkProgram: () => undefined,
        getProgramParameter: () => true,
        getProgramInfoLog: () => '',
        deleteProgram: () => undefined,
        createBuffer: () => ({}),
        bindBuffer: () => undefined,
        bufferData: () => undefined,
        deleteBuffer: () => undefined,
        deleteTexture: () => undefined,
        deleteFramebuffer: () => undefined,
        getUniformLocation: () => ({}),
        getExtension: (name: string) => (name === 'WEBGL_lose_context' ? { loseContext } : null),
    };

    const canvas = {
        getContext: () => gl,
        addEventListener: () => undefined,
        removeEventListener,
    } as unknown as HTMLCanvasElement;

    return { canvas, loseContext, removeEventListener };
};

describe('webglCache', () => {
    afterEach(() => {
        webglCache.destroyCache(null);
    });

    it('releases the WebGL context on destroyCache, after detaching the context listeners', () => {
        const callLog: string[] = [];
        const { canvas, loseContext, removeEventListener } = createFakeGlCanvas(callLog, 'a');

        expect(webglCache.getOrCreateCache(canvas, false, false)).not.toBeNull();

        webglCache.destroyCache(canvas);

        expect(loseContext).toHaveBeenCalledTimes(1);
        expect(removeEventListener).toHaveBeenCalled();
        expect(callLog.indexOf('a:loseContext')).toBeGreaterThan(callLog.lastIndexOf('a:removeEventListener'));
    });

    it('does not release the cached context when destroyCache is called for a different canvas', () => {
        const callLog: string[] = [];
        const cached = createFakeGlCanvas(callLog, 'a');
        const other = createFakeGlCanvas(callLog, 'b');

        expect(webglCache.getOrCreateCache(cached.canvas, false, false)).not.toBeNull();

        webglCache.destroyCache(other.canvas);

        expect(cached.loseContext).not.toHaveBeenCalled();
        expect(other.loseContext).not.toHaveBeenCalled();
    });

    it('does not release any context when destroyCache is called without an owned canvas', () => {
        const callLog: string[] = [];
        const { canvas, loseContext } = createFakeGlCanvas(callLog, 'a');

        expect(webglCache.getOrCreateCache(canvas, false, false)).not.toBeNull();

        webglCache.destroyCache(null);

        expect(loseContext).not.toHaveBeenCalled();
    });

    it('does not release the outgoing context when getOrCreateCache switches canvases', () => {
        const callLog: string[] = [];
        const first = createFakeGlCanvas(callLog, 'a');
        const second = createFakeGlCanvas(callLog, 'b');

        webglCache.getOrCreateCache(first.canvas, false, false);
        webglCache.getOrCreateCache(second.canvas, false, false);

        expect(first.loseContext).not.toHaveBeenCalled();
        expect(second.loseContext).not.toHaveBeenCalled();
    });

    it('is a no-op when there is no cache to destroy', () => {
        expect(() => webglCache.destroyCache(null)).not.toThrow();
    });
});
