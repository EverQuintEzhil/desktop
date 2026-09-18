import type { WebGLCacheEntry } from './webgl-cache-types';
import { createProgram, createShader } from './webgl-shader-factory';
import {
    FRAGMENT_SHADER_BRIGHTNESS,
    FRAGMENT_SHADER_CONTRAST,
    FRAGMENT_SHADER_SATURATION,
    FRAGMENT_SHADER_GAMMA,
    FRAGMENT_SHADER_ADJUSTMENTS,
    FRAGMENT_SHADER_TEMPERATURE,
    FRAGMENT_SHADER_SHARPNESS,
    FRAGMENT_SHADER_VIGNETTE,
    FRAGMENT_SHADER_CLARITY,
    FRAGMENT_SHADER_FILTERS,
    FRAGMENT_SHADER_VIBRANCE,
    FRAGMENT_SHADER_DEHAZE,
    FRAGMENT_SHADER_GRAIN,
    FRAGMENT_SHADER_DENOISE,
    FRAGMENT_SHADER_BLUR,
} from './webgl-shaders';

export const ensureAdjustmentPrograms = (cache: WebGLCacheEntry): void => {
    const { gl, vertexShader } = cache;

    // Create brightness program if not exists
    if (!cache.programs.brightness) {
        const shader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_BRIGHTNESS);

        if (shader) {
            const program = createProgram(gl, vertexShader, shader);

            if (program) {
                cache.programs.brightness = {
                    program,
                    uniforms: {
                        u_image: gl.getUniformLocation(program, 'u_image'),
                        u_texTransform: gl.getUniformLocation(program, 'u_texTransform'),
                        u_brightness: gl.getUniformLocation(program, 'u_brightness'),
                    },
                };
            }
        }
    }

    // Create contrast program if not exists
    if (!cache.programs.contrast) {
        const shader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_CONTRAST);

        if (shader) {
            const program = createProgram(gl, vertexShader, shader);

            if (program) {
                cache.programs.contrast = {
                    program,
                    uniforms: {
                        u_image: gl.getUniformLocation(program, 'u_image'),
                        u_texTransform: gl.getUniformLocation(program, 'u_texTransform'),
                        u_contrast: gl.getUniformLocation(program, 'u_contrast'),
                    },
                };
            }
        }
    }

    // Create saturation program if not exists
    if (!cache.programs.saturation) {
        const shader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SATURATION);

        if (shader) {
            const program = createProgram(gl, vertexShader, shader);

            if (program) {
                cache.programs.saturation = {
                    program,
                    uniforms: {
                        u_image: gl.getUniformLocation(program, 'u_image'),
                        u_texTransform: gl.getUniformLocation(program, 'u_texTransform'),
                        u_saturation: gl.getUniformLocation(program, 'u_saturation'),
                    },
                };
            }
        }
    }

    // Create gamma program if not exists
    if (!cache.programs.gamma) {
        const shader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_GAMMA);

        if (shader) {
            const program = createProgram(gl, vertexShader, shader);

            if (program) {
                cache.programs.gamma = {
                    program,
                    uniforms: {
                        u_image: gl.getUniformLocation(program, 'u_image'),
                        u_texTransform: gl.getUniformLocation(program, 'u_texTransform'),
                        u_gamma: gl.getUniformLocation(program, 'u_gamma'),
                    },
                };
            }
        }
    }

    // Create adjustments program if not exists
    if (!cache.programs.adjustments) {
        const shader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_ADJUSTMENTS);

        if (shader) {
            const program = createProgram(gl, vertexShader, shader);

            if (program) {
                cache.programs.adjustments = {
                    program,
                    uniforms: {
                        u_image: gl.getUniformLocation(program, 'u_image'),
                        u_texTransform: gl.getUniformLocation(program, 'u_texTransform'),
                        u_gamma: gl.getUniformLocation(program, 'u_gamma'),
                        u_shadows: gl.getUniformLocation(program, 'u_shadows'),
                        u_highlights: gl.getUniformLocation(program, 'u_highlights'),
                        u_whites: gl.getUniformLocation(program, 'u_whites'),
                        u_blacks: gl.getUniformLocation(program, 'u_blacks'),
                        u_colorMatrix: gl.getUniformLocation(program, 'u_colorMatrix'),
                        u_colorOffset: gl.getUniformLocation(program, 'u_colorOffset'),
                    },
                };
            }
        }
    }

    // Create temperature program if not exists
    if (!cache.programs.temperature) {
        const shader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_TEMPERATURE);

        if (shader) {
            const program = createProgram(gl, vertexShader, shader);

            if (program) {
                cache.programs.temperature = {
                    program,
                    uniforms: {
                        u_image: gl.getUniformLocation(program, 'u_image'),
                        u_texTransform: gl.getUniformLocation(program, 'u_texTransform'),
                        u_temperature: gl.getUniformLocation(program, 'u_temperature'),
                        u_tint: gl.getUniformLocation(program, 'u_tint'),
                    },
                };
            }
        }
    }

    // Create sharpness program if not exists
    if (!cache.programs.sharpness) {
        const shader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SHARPNESS);

        if (shader) {
            const program = createProgram(gl, vertexShader, shader);

            if (program) {
                cache.programs.sharpness = {
                    program,
                    uniforms: {
                        u_image: gl.getUniformLocation(program, 'u_image'),
                        u_texTransform: gl.getUniformLocation(program, 'u_texTransform'),
                        u_pixelDimension: gl.getUniformLocation(program, 'u_pixelDimension'),
                        u_sharpness: gl.getUniformLocation(program, 'u_sharpness'),
                    },
                };
            }
        }
    }

    // Create vignette program if not exists
    if (!cache.programs.vignette) {
        const shader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_VIGNETTE);

        if (shader) {
            const program = createProgram(gl, vertexShader, shader);

            if (program) {
                cache.programs.vignette = {
                    program,
                    uniforms: {
                        u_image: gl.getUniformLocation(program, 'u_image'),
                        u_texTransform: gl.getUniformLocation(program, 'u_texTransform'),
                        u_size: gl.getUniformLocation(program, 'u_size'),
                        u_amount: gl.getUniformLocation(program, 'u_amount'),
                    },
                };
            }
        }
    }

    // Create clarity program if not exists
    if (!cache.programs.clarity) {
        const shader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_CLARITY);

        if (shader) {
            const program = createProgram(gl, vertexShader, shader);

            if (program) {
                cache.programs.clarity = {
                    program,
                    uniforms: {
                        u_image: gl.getUniformLocation(program, 'u_image'),
                        u_texTransform: gl.getUniformLocation(program, 'u_texTransform'),
                        u_pixelDimension: gl.getUniformLocation(program, 'u_pixelDimension'),
                        u_clarity: gl.getUniformLocation(program, 'u_clarity'),
                        u_colorMatrix: gl.getUniformLocation(program, 'u_colorMatrix'),
                        u_colorOffset: gl.getUniformLocation(program, 'u_colorOffset'),
                    },
                };
            }
        }
    }

    // Create vibrance program
    if (!cache.programs.vibrance) {
        const shader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_VIBRANCE);

        if (shader) {
            const program = createProgram(gl, vertexShader, shader);

            if (program) {
                cache.programs.vibrance = {
                    program,
                    uniforms: {
                        u_image: gl.getUniformLocation(program, 'u_image'),
                        u_texTransform: gl.getUniformLocation(program, 'u_texTransform'),
                        u_vibrance: gl.getUniformLocation(program, 'u_vibrance'),
                    },
                };
            }
        }
    }

    // Create dehaze program
    if (!cache.programs.dehaze) {
        const shader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_DEHAZE);

        if (shader) {
            const program = createProgram(gl, vertexShader, shader);

            if (program) {
                cache.programs.dehaze = {
                    program,
                    uniforms: {
                        u_image: gl.getUniformLocation(program, 'u_image'),
                        u_texTransform: gl.getUniformLocation(program, 'u_texTransform'),
                        u_dehaze: gl.getUniformLocation(program, 'u_dehaze'),
                    },
                };
            }
        }
    }

    // Create grain program
    if (!cache.programs.grain) {
        const shader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_GRAIN);

        if (shader) {
            const program = createProgram(gl, vertexShader, shader);

            if (program) {
                cache.programs.grain = {
                    program,
                    uniforms: {
                        u_image: gl.getUniformLocation(program, 'u_image'),
                        u_texTransform: gl.getUniformLocation(program, 'u_texTransform'),
                        u_amount: gl.getUniformLocation(program, 'u_amount'),
                        u_size: gl.getUniformLocation(program, 'u_size'),
                        u_time: gl.getUniformLocation(program, 'u_time'),
                    },
                };
            }
        }
    }

    // Create denoise program
    if (!cache.programs.denoise) {
        const shader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_DENOISE);

        if (shader) {
            const program = createProgram(gl, vertexShader, shader);

            if (program) {
                cache.programs.denoise = {
                    program,
                    uniforms: {
                        u_image: gl.getUniformLocation(program, 'u_image'),
                        u_texTransform: gl.getUniformLocation(program, 'u_texTransform'),
                        u_exponent: gl.getUniformLocation(program, 'u_exponent'),
                        u_texSize: gl.getUniformLocation(program, 'u_texSize'),
                    },
                };
            }
        }
    }

    if (!cache.programs.blur) {
        const shader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_BLUR);

        if (shader) {
            const program = createProgram(gl, vertexShader, shader);

            if (program) {
                cache.programs.blur = {
                    program,
                    uniforms: {
                        u_image: gl.getUniformLocation(program, 'u_image'),
                        u_texTransform: gl.getUniformLocation(program, 'u_texTransform'),
                        u_texSize: gl.getUniformLocation(program, 'u_texSize'),
                        u_direction: gl.getUniformLocation(program, 'u_direction'),
                        u_blurRadius: gl.getUniformLocation(program, 'u_blurRadius'),
                    },
                };
            }
        }
    }
};

export const ensureFilterProgram = (cache: WebGLCacheEntry): void => {
    const { gl, vertexShader } = cache;

    // Create filter program if not exists
    if (!cache.programs.filter) {
        const shader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_FILTERS);

        if (shader) {
            const program = createProgram(gl, vertexShader, shader);

            if (program) {
                cache.programs.filter = {
                    program,
                    uniforms: {
                        u_image: gl.getUniformLocation(program, 'u_image'),
                        u_texTransform: gl.getUniformLocation(program, 'u_texTransform'),
                        u_lut: gl.getUniformLocation(program, 'u_lut'),
                        u_duotoneEnabled: gl.getUniformLocation(program, 'u_duotoneEnabled'),
                        u_duotoneIntensity: gl.getUniformLocation(program, 'u_duotoneIntensity'),
                        u_duotoneDark: gl.getUniformLocation(program, 'u_duotoneDark'),
                        u_duotoneLight: gl.getUniformLocation(program, 'u_duotoneLight'),
                        u_lutEnabled: gl.getUniformLocation(program, 'u_lutEnabled'),
                        u_lutIntensity: gl.getUniformLocation(program, 'u_lutIntensity'),
                        u_lutSize: gl.getUniformLocation(program, 'u_lutSize'),
                        u_lutTilesX: gl.getUniformLocation(program, 'u_lutTilesX'),
                        u_lutTilesY: gl.getUniformLocation(program, 'u_lutTilesY'),
                        u_lutResolution: gl.getUniformLocation(program, 'u_lutResolution'),
                    },
                };
            }
        }
    }
};
