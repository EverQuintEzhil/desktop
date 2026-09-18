export interface ShaderProgram {
    program: WebGLProgram;
    uniforms: Record<string, WebGLUniformLocation | null>;
}

export interface WebGLCacheEntry {
    gl: WebGLRenderingContext;
    canvas: HTMLCanvasElement;
    vertexShader: WebGLShader;
    positionBuffer: WebGLBuffer;
    texCoordBuffer: WebGLBuffer;
    // Cached base image texture for interactive updates
    imageTexture?: WebGLTexture;
    imageKey?: string;
    // Cached ping-pong buffers for multipass rendering
    pingTexture?: WebGLTexture;
    pingFramebuffer?: WebGLFramebuffer;
    pongTexture?: WebGLTexture;
    pongFramebuffer?: WebGLFramebuffer;
    pingPongWidth?: number;
    pingPongHeight?: number;
    programs: {
        basic: ShaderProgram;
        brightness?: ShaderProgram;
        contrast?: ShaderProgram;
        saturation?: ShaderProgram;
        gamma?: ShaderProgram;
        adjustments?: ShaderProgram;
        temperature?: ShaderProgram;
        sharpness?: ShaderProgram;
        vignette?: ShaderProgram;
        clarity?: ShaderProgram;
        filter?: ShaderProgram;
        vibrance?: ShaderProgram;
        dehaze?: ShaderProgram;
        grain?: ShaderProgram;
        denoise?: ShaderProgram;
        blur?: ShaderProgram;
    };
}
