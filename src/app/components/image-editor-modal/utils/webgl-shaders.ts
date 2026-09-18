export const VERTEX_SHADER = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
uniform mat3 u_texTransform;
varying vec2 v_texCoord;

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    vec3 uv = u_texTransform * vec3(a_texCoord, 1.0);
    v_texCoord = uv.xy;
}
`;

export const FRAGMENT_SHADER_BASIC = `
precision mediump float;
uniform sampler2D u_image;
varying vec2 v_texCoord;

void main() {
    vec2 uv = v_texCoord;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        gl_FragColor = vec4(0.0);
        return;
    }
    uv = clamp(uv, 0.0, 1.0);
    gl_FragColor = texture2D(u_image, uv);
}
`;

export const FRAGMENT_SHADER_BRIGHTNESS = `
precision mediump float;

varying vec2 v_texCoord;
uniform sampler2D u_image;
uniform float u_brightness;

void main() {
  vec4 texColor = texture2D(u_image, v_texCoord);
  vec3 rgb = clamp(texColor.rgb + vec3(u_brightness), 0.0, 1.0);
  gl_FragColor = vec4(rgb, texColor.a);
}
`;

export const FRAGMENT_SHADER_CONTRAST = `
precision mediump float;

varying vec2 v_texCoord;
uniform sampler2D u_image;
uniform float u_contrast;

void main() {
  vec4 texColor = texture2D(u_image, v_texCoord);
  vec3 rgb = clamp((texColor.rgb - vec3(0.5)) * u_contrast + vec3(0.5), 0.0, 1.0);
  gl_FragColor = vec4(rgb, texColor.a);
}
`;

export const FRAGMENT_SHADER_SATURATION = `
precision mediump float;

varying vec2 v_texCoord;
uniform sampler2D u_image;
uniform float u_saturation;

const vec3 luminanceWeighting = vec3(0.2125, 0.7154, 0.0721);

void main() {
  vec4 texColor = texture2D(u_image, v_texCoord);
  float luminance = dot(texColor.rgb, luminanceWeighting);
  vec3 greyScaleColor = vec3(luminance);
  vec3 rgb = clamp(mix(greyScaleColor, texColor.rgb, u_saturation), 0.0, 1.0);
  gl_FragColor = vec4(rgb, texColor.a);
}
`;

export const FRAGMENT_SHADER_GAMMA = `
precision mediump float;

varying vec2 v_texCoord;
uniform sampler2D u_image;
uniform vec3 u_gamma;

void main() {
  vec4 texColor = texture2D(u_image, v_texCoord);
  vec3 rgb = clamp(pow(texColor.rgb, u_gamma), 0.0, 1.0);
  gl_FragColor = vec4(rgb, texColor.a);
}
`;

export const FRAGMENT_SHADER_ADJUSTMENTS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

varying vec2 v_texCoord;
uniform sampler2D u_image;

uniform float u_gamma;
uniform float u_shadows;
uniform float u_highlights;
uniform float u_whites;
uniform float u_blacks;

uniform mat4 u_colorMatrix;
uniform vec4 u_colorOffset;

const float EPSILON = 0.0000001;

float calculateLuminance(vec3 rgb) {
    vec4 p = mix(
        vec4(rgb.gb, 0.0, -1.0 / 3.0),
        vec4(rgb.bg, -1.0, 2.0 / 3.0),
        vec4(rgb.g < rgb.b)
    );

    vec4 q = mix(
        vec4(rgb.r, p.yzx),
        vec4(p.xyw, rgb.r),
        vec4(rgb.r < p.x)
    );

    float croma = q.x - min(q.w, q.y);
    float luminance = q.x - croma * 0.5;
    return luminance;
}

vec3 map(vec3 x, float in_min, float in_max, float out_min, float out_max) {
  return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

void main() {
  vec4 color = clamp(texture2D(u_image, v_texCoord), 0.0, 1.0);

  vec3 rgb = color.rgb;
  if (u_gamma != 1.0) {
    rgb = pow(rgb, vec3(1.0 / max(u_gamma, EPSILON)));
  }

  float luminance = calculateLuminance(rgb);

  float shadow = u_shadows >= 0.0
    ? clamp(
          pow(luminance, 1.0 / (u_shadows + 1.0))
          + pow(luminance, 2.0 / (u_shadows + 1.0)) * -0.76
          - luminance
    , 0.0, max(u_shadows, 1.0))
    : -clamp(
          pow(luminance, 1.0 / (-u_shadows + 1.0))
          + pow(luminance, 2.0 / (-u_shadows + 1.0)) * -0.76
          - luminance
    , 0.0, max(-u_shadows, 1.0));

  float highlight = u_highlights < 0.0
    ? clamp(
          1.0
          - pow(1.0 - luminance, 1.0 / (1.0 - u_highlights))
          - pow(1.0 - luminance, 2.0 / (1.0 - u_highlights)) * -0.8
          - luminance
     , -1.0, 0.0)
    : -clamp(
          1.0
          - pow(1.0 - luminance, 1.0 / (1.0 + u_highlights))
          - pow(1.0 - luminance, 2.0 / (1.0 + u_highlights)) * -0.8
          - luminance
     , -1.0, 0.0);

  float shadowContrast   = shadow * luminance * luminance;
  float shadowBrightness = shadow - shadowContrast;

  float offset = luminance + shadowContrast + highlight;
  rgb = clamp(offset * ((rgb + shadowBrightness) / max(luminance, EPSILON)), 0.0, 1.0);

  rgb = clamp(vec4(rgb, color.a) * u_colorMatrix + u_colorOffset, 0.0, 1.0).rgb;
  rgb = map(rgb, 0.0, 1.0, u_blacks / 2.0, 1.0 + u_whites / 2.0);
  rgb = clamp(rgb, 0.0, 1.0);

  gl_FragColor = vec4(rgb, color.a);
}
`;

export const FRAGMENT_SHADER_TEMPERATURE = `
precision mediump float;

uniform sampler2D u_image;
uniform float u_temperature;
uniform float u_tint;

const lowp vec3 warmFilter = vec3(0.93, 0.54, 0.0);
const mediump mat3 RGBtoYIQ = mat3(0.299, 0.587, 0.114, 0.596, -0.274, -0.322, 0.212, -0.523, 0.311);
const mediump mat3 YIQtoRGB = mat3(1.0, 0.956, 0.621, 1.0, -0.272, -0.647, 1.0, -1.105, 1.702);

varying vec2 v_texCoord;

void main() {
    float temperature = u_temperature;
    float tint = u_tint;
    vec4 source = texture2D(u_image, v_texCoord);

    vec3 yiq = RGBtoYIQ * source.rgb;
    yiq.b = clamp(yiq.b + tint * 0.5226 * 0.1, -0.5226, 0.5226);
    vec3 rgb = YIQtoRGB * yiq;

    vec3 processed = mix(
        (1.0 - 2.0 * (1.0 - rgb) * (1.0 - warmFilter)),
        (2.0 * rgb * warmFilter),
        vec3(rgb.r < 0.5, rgb.g < 0.5, rgb.b < 0.5)
    );

    vec3 finalRgb = clamp(mix(rgb, processed, temperature), 0.0, 1.0);

    gl_FragColor = vec4(finalRgb, source.a);
}
`;

export const FRAGMENT_SHADER_SHARPNESS = `
precision mediump float;

varying vec2 v_texCoord;
uniform sampler2D u_image;
uniform vec2 u_pixelDimension;
uniform float u_sharpness;

void main() {
    vec4 color = clamp(texture2D(u_image, v_texCoord), 0.0, 1.0);

    float factor = mix(0.2, -1.0, float(u_sharpness > 0.0));
    vec3 sharpenedRgb = mix(0.2, 5.0, float(u_sharpness > 0.0)) * color.rgb;

    sharpenedRgb += factor * clamp(texture2D(u_image, v_texCoord + u_pixelDimension * vec2(-1.0,  0.0)), 0.0, 1.0).rgb;
    sharpenedRgb += factor * clamp(texture2D(u_image, v_texCoord + u_pixelDimension * vec2( 0.0, -1.0)), 0.0, 1.0).rgb;
    sharpenedRgb += factor * clamp(texture2D(u_image, v_texCoord + u_pixelDimension * vec2( 0.0,  1.0)), 0.0, 1.0).rgb;
    sharpenedRgb += factor * clamp(texture2D(u_image, v_texCoord + u_pixelDimension * vec2( 1.0,  0.0)), 0.0, 1.0).rgb;

    sharpenedRgb = clamp(sharpenedRgb, 0.0, 1.0);

    vec3 finalRgb = clamp(mix(color.rgb, sharpenedRgb, abs(u_sharpness)), 0.0, 1.0);

    gl_FragColor = vec4(finalRgb, color.a);
}
`;

export const FRAGMENT_SHADER_VIGNETTE = `
precision mediump float;

uniform sampler2D u_image;
uniform float u_size;
uniform float u_amount;

varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    
    float dist = distance(v_texCoord, vec2(0.5, 0.5));
    color.rgb *= smoothstep(0.8, u_size * 0.799, dist * (u_amount + u_size));
    
    gl_FragColor = color;
}
`;

export const FRAGMENT_SHADER_CLARITY = `
precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_pixelDimension;
uniform float u_clarity;

varying vec2 v_texCoord;

uniform mat4 u_colorMatrix;
uniform vec4 u_colorOffset;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);

    vec3 colLB = texture2D(u_image, v_texCoord + vec2(-u_pixelDimension.x, -u_pixelDimension.y)).rgb;
    vec3 colLC = texture2D(u_image, v_texCoord + vec2(-u_pixelDimension.x, 0.0)).rgb;
    vec3 colLT = texture2D(u_image, v_texCoord + vec2(-u_pixelDimension.x, u_pixelDimension.y)).rgb;

    vec3 colCL = texture2D(u_image, v_texCoord + vec2(0.0, -u_pixelDimension.y)).rgb;
    vec3 colCR = texture2D(u_image, v_texCoord + vec2(0.0,  u_pixelDimension.y)).rgb;

    vec3 colRB = texture2D(u_image, v_texCoord + vec2(u_pixelDimension.x, -u_pixelDimension.y)).rgb;
    vec3 colRC = texture2D(u_image, v_texCoord + vec2(u_pixelDimension.x, 0.0)).rgb;
    vec3 colRT = texture2D(u_image, v_texCoord + vec2(u_pixelDimension.x,  u_pixelDimension.y)).rgb;

    vec3 mergedColor = color.rgb;
    mergedColor += colLB + colLC + colLT;
    mergedColor += colCL + colCR;
    mergedColor += colRB + colRC + colRT;
    mergedColor /= 9.0;

    float grayValue = clamp(color.r * 0.3 + color.g * 0.59 + color.b * 0.1, 0.111111, 0.999999);
    float frequenceFactor = min(smoothstep(1.0 - grayValue, 0.0, 0.11), smoothstep(grayValue, 0.0, 0.11));

    vec3 rgb = clamp(color.rgb + clamp((color.rgb - mergedColor) * u_clarity * 3.7 * frequenceFactor, 0.0, 10.0), 0.0, 1.0);
    rgb = rgb * pow(2.0, u_clarity * 0.27 * frequenceFactor);
    rgb = clamp(vec4(rgb, color.a) * u_colorMatrix + u_colorOffset, 0.0, 1.0).rgb;

    gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), color.a);
}
`;

export const FRAGMENT_SHADER_FILTERS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

varying vec2 v_texCoord;
uniform sampler2D u_image;
uniform sampler2D u_lut;

uniform float u_duotoneEnabled;
uniform float u_duotoneIntensity;
uniform vec3 u_duotoneDark;
uniform vec3 u_duotoneLight;

uniform float u_lutEnabled;
uniform float u_lutIntensity;
uniform float u_lutSize;
uniform float u_lutTilesX;
uniform float u_lutTilesY;
uniform float u_lutResolution;

const float EPSILON = 0.000001;

float clamp01(float x) { return clamp(x, 0.0, 1.0); }

vec3 lutColor(int texPosX, int texPosY) {
    return texture2D(u_lut, (0.5 / u_lutResolution) + vec2(float(texPosX), float(texPosY)) / u_lutResolution).rgb;
}

vec3 bilinearInterpolate(vec3 cRfGf, vec3 cRfGc, vec3 cRcGf, vec3 cRcGc, float redFract, float greenFract) {
    return mix(mix(cRfGf, cRcGf, redFract), mix(cRfGc, cRcGc, redFract), greenFract);
}

vec3 applyLutImgly(vec3 sourceColor) {
    vec3 ranges = vec3(
        floor(u_lutResolution / u_lutTilesX - 1.0),
        floor(u_lutResolution / u_lutTilesY - 1.0),
        floor(u_lutTilesX * u_lutTilesX - 1.0)
    );

    // img.ly does not clamp the unpremultiplied color before computing LUT coordinates.
    // This keeps behavior consistent for edge cases (e.g., alpha-unpremultiply overshoot).
    vec3 tmp = sourceColor * ranges;
    ivec3 floors = ivec3(tmp);
    ivec3 ceils = ivec3(ceil(tmp));
    vec3 fracts = fract(tmp);

    ivec2 pixelsPerTile = ivec2(
        u_lutResolution / u_lutTilesX,
        u_lutResolution / u_lutTilesY
    );

    ivec2 tileFloor;
    tileFloor.y = floors.z / int(u_lutTilesX);
    tileFloor.x = (floors.z - (tileFloor.y * int(u_lutTilesX)));

    ivec2 tileCeil;
    tileCeil.y = ceils.z / int(u_lutTilesX);
    tileCeil.x = (ceils.z - (tileCeil.y * int(u_lutTilesX)));

    tileFloor *= pixelsPerTile;
    tileCeil *= pixelsPerTile;

    vec3 lutColorFB = bilinearInterpolate(
        lutColor(tileFloor.x + floors.x, tileFloor.y + floors.y),
        lutColor(tileFloor.x + floors.x, tileFloor.y + ceils.y),
        lutColor(tileFloor.x + ceils.x,  tileFloor.y + floors.y),
        lutColor(tileFloor.x + ceils.x,  tileFloor.y + ceils.y),
        fracts.x, fracts.y
    );
    vec3 lutColorCB = bilinearInterpolate(
        lutColor(tileCeil.x + floors.x, tileCeil.y + floors.y),
        lutColor(tileCeil.x + floors.x, tileCeil.y + ceils.y),
        lutColor(tileCeil.x + ceils.x,  tileCeil.y + floors.y),
        lutColor(tileCeil.x + ceils.x,  tileCeil.y + ceils.y),
        fracts.x, fracts.y
    );

    vec3 interpolation = mix(lutColorFB, lutColorCB, fracts.z);
    interpolation = clamp(floor(interpolation * 255.0 + 0.5) / 255.0, 0.0, 1.0);
    return interpolation;
}

void main() {
    vec2 uv = v_texCoord;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        gl_FragColor = vec4(0.0);
        return;
    }
    uv = clamp(uv, 0.0, 1.0);
    vec4 inputColor = clamp(texture2D(u_image, uv), 0.0, 1.0);
    vec3 color = inputColor.rgb;

    if (u_duotoneEnabled > 0.5) {
        vec3 c = clamp(color, 0.0, 1.0);
        float p = clamp(u_duotoneIntensity, -1.0, 1.0);
        const float EPS = 0.0000001;

        if (p > 0.0) {
            c = 1.0 - pow(1.0 - c, vec3(max(p + 1.0, EPS)));
        } else {
            c = pow(c, vec3(max(-p + 1.0, EPS)));
        }

        const vec3 GRAYSCALE_WEIGHTS = vec3(0.2126, 0.7152, 0.0722);
        float luma = dot(c, GRAYSCALE_WEIGHTS);
        vec3 dSrgb = clamp(u_duotoneDark, 0.0, 1.0);
        vec3 lSrgb = clamp(u_duotoneLight, 0.0, 1.0);
        color = mix(dSrgb, lSrgb, clamp01(luma));
    }

    if (u_lutEnabled > 0.5 && u_lutIntensity > 0.0) {
        vec3 lutC = applyLutImgly(color);
        color = mix(color, lutC, u_lutIntensity);
    }

    gl_FragColor = vec4(clamp(color, 0.0, 1.0), inputColor.a);
}
`;

export const FRAGMENT_SHADER_VIBRANCE = `
precision mediump float;

varying vec2 v_texCoord;
uniform sampler2D u_image;
uniform float u_vibrance;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    float average = (color.r + color.g + color.b) / 3.0;
    float mx = max(color.r, max(color.g, color.b));
    float amt = (mx - average) * (-u_vibrance * 3.0);
    color.rgb = mix(color.rgb, vec3(mx), amt);
    gl_FragColor = color;
}
`;

export const FRAGMENT_SHADER_DEHAZE = `
precision mediump float;

varying vec2 v_texCoord;
uniform sampler2D u_image;
uniform float u_dehaze;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    vec3 rgb = color.rgb;

    // Simple dehaze: boost contrast and slightly lower brightness to cut through "haze"
    // This is a simplified approximation.
    
    if (u_dehaze != 0.0) {
        // Gamma correction to darken/lighten
        float gamma = 1.0 - (u_dehaze * 0.5);
        rgb = pow(rgb, vec3(gamma));
        
        // Contrast boost
        float contrast = 1.0 + (u_dehaze * 0.2);
        rgb = (rgb - 0.5) * contrast + 0.5;
    }

    gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), color.a);
}
`;

export const FRAGMENT_SHADER_GRAIN = `
precision mediump float;

uniform sampler2D u_image;
uniform float u_amount; // 0-100
uniform float u_size; // 0-100
uniform float u_time; // Seed

varying vec2 v_texCoord;

// Pseudo-random function
float rand(vec2 co) {
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

// Overlay blending helper
float overlay(float base, float blend) {
    return base < 0.5 
        ? (2.0 * base * blend) 
        : (1.0 - 2.0 * (1.0 - base) * (1.0 - blend));
}

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    
    // 1. Noise Generation
    // Map size 0-100 to scale factor.
    // Small size = High frequency (large scale factor)
    // Large size = Low frequency (small scale factor)
    // 0 -> 1000.0 (fine)
    // 100 -> 100.0 (coarse)
    // u_size is 0-1 (passed from JS)
    float scale = 1000.0 / (u_size * 9.0 + 1.0); 
    vec2 noiseCoord = v_texCoord * scale;
    float noise = rand(noiseCoord + u_time);
    
    // 2. Luminance Masking
    // Grain is most visible in midtones, less in deep blacks/whites
    float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    // Parabolic curve peaking at 0.5: 1 - (2x - 1)^2
    float mask = 1.0 - pow(2.0 * luminance - 1.0, 2.0);
    // Clamp mask to avoid complete disappearance
    mask = clamp(mask, 0.3, 1.0);
    
    // 3. Strength Calculation
    // u_amount is 0-1. Normalize to 0-1 range for blending opacity.
    // Max opacity 1.0 for stronger grain
    float strength = u_amount * 1.0 * mask;
    
    // 4. Overlay Blending
    vec3 result;
    result.r = overlay(color.r, noise);
    result.g = overlay(color.g, noise);
    result.b = overlay(color.b, noise);
    
    // Mix original with overlay result based on strength
    vec3 finalColor = mix(color.rgb, result, strength);
    
    gl_FragColor = vec4(clamp(finalColor, 0.0, 1.0), color.a);
}
`;

export const FRAGMENT_SHADER_DENOISE = `
precision mediump float;

uniform sampler2D u_image;
uniform float u_exponent;
uniform vec2 u_texSize;

varying vec2 v_texCoord;

void main() {
    vec4 center = texture2D(u_image, v_texCoord);
    vec4 color = vec4(0.0);
    float total = 0.0;
    
    for (float x = -4.0; x <= 4.0; x += 1.0) {
        for (float y = -4.0; y <= 4.0; y += 1.0) {
            vec4 sample = texture2D(u_image, v_texCoord + vec2(x, y) / u_texSize);
            float weight = 1.0 - abs(dot(sample.rgb - center.rgb, vec3(0.25)));
            weight = pow(weight, u_exponent);
            color += sample * weight;
            total += weight;
        }
    }
    
    gl_FragColor = color / total;
}
`;

export const FRAGMENT_SHADER_BLUR = `
precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_texSize;
uniform vec2 u_direction;
uniform float u_blurRadius;

varying vec2 v_texCoord;

float gaussian(float x, float sigma) {
    return (1.0 / (2.506628 * sigma)) * exp(-(x * x) / (2.0 * sigma * sigma));
}

void main() {
    float radius = u_blurRadius;
    
    if (radius < 0.1) {
        gl_FragColor = texture2D(u_image, v_texCoord);
        return;
    }

    float sigma = max(1.0, radius * 0.5);
    
    vec4 color = vec4(0.0);
    float totalWeight = 0.0;
    
    float loopMax = min(ceil(sigma * 3.0), 20.0);
    
    for(float i = -20.0; i <= 20.0; i += 1.0) {
        if (abs(i) > loopMax) continue;
        
        float weight = gaussian(i, sigma);
        vec2 offset = vec2(i) * u_direction / u_texSize;
        color += texture2D(u_image, v_texCoord + offset) * weight;
        totalWeight += weight;
    }
    
    gl_FragColor = color / totalWeight;
}
`;
