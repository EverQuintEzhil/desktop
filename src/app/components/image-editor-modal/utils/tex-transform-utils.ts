import { EPS } from './crop-utils';

export type Mat3 = Float32Array;

export const identityMat3 = (): Mat3 => new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);

const multiplyMat3 = (a: Mat3, b: Mat3): Mat3 => {
    const out = new Float32Array(9);

    for (let col = 0; col < 3; col += 1) {
        for (let row = 0; row < 3; row += 1) {
            out[col * 3 + row] =
                a[0 * 3 + row] * b[col * 3 + 0] + a[1 * 3 + row] * b[col * 3 + 1] + a[2 * 3 + row] * b[col * 3 + 2];
        }
    }

    return out;
};

const translationMat3 = (tx: number, ty: number): Mat3 => new Float32Array([1, 0, 0, 0, 1, 0, tx, ty, 1]);

const rotationMat3 = (radians: number): Mat3 => {
    const c = Math.cos(radians);
    const s = Math.sin(radians);

    return new Float32Array([c, s, 0, -s, c, 0, 0, 0, 1]);
};

const scaleMat3 = (sx: number, sy: number): Mat3 => new Float32Array([sx, 0, 0, 0, sy, 0, 0, 0, 1]);

// Helper: Convert degrees to radians
export const degreesToRadians = (deg: number): number => (deg * Math.PI) / 180;

// Helper: Convert radians to degrees
export const radiansToDegrees = (rad: number): number => (rad * 180) / Math.PI;

// Helper: Normalize rotation to 0-360 range
export const normalizeRotationTo360 = (deg: number): number => {
    if (!Number.isFinite(deg)) return 0;

    return ((deg % 360) + 360) % 360;
};

export const normalizeRotationDegrees = (deg: number): number => {
    if (!Number.isFinite(deg)) return 0;

    let d = deg % 360;

    if (d < -180) d += 360;
    if (d > 180) d -= 360;

    return d;
};

export const isRightAngleRotationDegrees = (deg: number): boolean => {
    const r = normalizeRotationDegrees(deg);

    return Math.abs(r % 90) < EPS;
};

export const isQuarterTurnRotationDegrees = (deg: number): boolean => {
    const r = normalizeRotationDegrees(deg);

    return Math.abs(r % 90) < EPS && Math.abs(r) === 90;
};

export const buildTexTransformFromCropWithDimensions = (
    rotation: number,
    straightenAngle: number,
    flipX: boolean,
    flipY: boolean,
    x: number,
    y: number,
    width: number,
    height: number,
    imageWidth: number,
    imageHeight: number,
    outputWidth: number,
    outputHeight: number,
): Mat3 => {
    // Sanitize inputs: treat non-finite values as "no-op" defaults.
    const rotationDeg = Number.isFinite(rotation) ? rotation : 0;
    const straightenDeg = Number.isFinite(straightenAngle) ? straightenAngle : 0;

    // "Total" rotation used for some bounding / containment math.
    // Note: `rotationDeg` and `straightenDeg` are applied separately below.
    const totalRotationDeg = rotationDeg - straightenDeg;
    const totalRotationRad = degreesToRadians(totalRotationDeg);
    const rotationRad = degreesToRadians(rotationDeg);
    const straightenRad = degreesToRadians(straightenDeg);

    // Flip flags become ±1 multipliers (a negative value mirrors/reflection on that axis; it does not resize).
    const sx = flipX ? -1 : 1;
    const sy = flipY ? -1 : 1;

    // Sanitize crop rectangle (in SOURCE IMAGE PIXELS).
    // If width/height are invalid, default to full image.
    const cropX = Number.isFinite(x) && x >= 0 ? x : 0;
    const cropY = Number.isFinite(y) && y >= 0 ? y : 0;
    const cropW = Number.isFinite(width) && width > 0 ? width : imageWidth;
    const cropH = Number.isFinite(height) && height > 0 ? height : imageHeight;

    // Source image dimensions (in pixels). Use 1 to avoid division by 0.
    const w = Number.isFinite(imageWidth) && imageWidth > 0 ? imageWidth : 1;
    const h = Number.isFinite(imageHeight) && imageHeight > 0 ? imageHeight : 1;

    // Output dimensions (in pixels). If unspecified, fall back to crop size.
    const outW = Number.isFinite(outputWidth) && outputWidth! > 0 ? outputWidth! : cropW;
    const outH = Number.isFinite(outputHeight) && outputHeight! > 0 ? outputHeight! : cropH;

    // Fast path: no rotation/straighten/flips => transform is just "crop UV rect".
    if (rotationDeg === 0 && straightenDeg === 0 && sx === 1 && sy === 1) {
        // Convert crop rectangle from pixels to UV space.
        // Note: UV origin is bottom-left in typical shader math, while image pixels often have origin top-left.
        const cropUVX = cropX / w;
        const cropUVY = 1.0 - (cropY + cropH) / h;
        const cropUVWidth = cropW / w;
        const cropUVHeight = cropH / h;

        let transform = identityMat3();

        // Compose affine transform in UV:
        // u' = cropUVX + u * cropUVWidth
        // v' = cropUVY + v * cropUVHeight
        transform = multiplyMat3(transform, translationMat3(cropUVX, cropUVY));
        transform = multiplyMat3(transform, scaleMat3(cropUVWidth, cropUVHeight));

        return transform;
    }

    // General path: build a UV sampling transform that supports:
    // - `rotationDeg` (0/90/180/270)
    // - `straightenDeg` (-45°..+45°)
    // - flips
    // - cropping centered on the crop rect
    //
    // IMPORTANT: We build `transform` via right-multiplication:
    //   transform = transform * M
    // so the LAST appended matrix is applied FIRST to the input coordinate vector.
    const normalizedBaseRot = normalizeRotationDegrees(rotationDeg);
    const isBaseRightAngle = Math.abs(normalizedBaseRot % 90) < EPS;

    // Choose an angle used only for containment scaling:
    // - If base rotation is a clean right angle, the output's axis-aligned bounds are mostly affected by straighten.
    // - Otherwise use the full combined rotation magnitude.
    const coverRotationRad = isBaseRightAngle ? degreesToRadians(Math.abs(straightenDeg)) : Math.abs(totalRotationRad);

    // Axis-aligned bounding size of a rotated rectangle:
    // rotatedW = W*|cos| + H*|sin|
    // rotatedH = H*|cos| + W*|sin|
    const theta = Math.abs(coverRotationRad);
    const c = Math.abs(Math.cos(theta));
    const s = Math.abs(Math.sin(theta));

    const baseW = outW;
    const baseH = outH;

    const rotatedW = baseW * c + baseH * s;
    const rotatedH = baseH * c + baseW * s;

    // How much we'd have to zoom IN (i.e., shrink content) so a rotated rect still fits in the output.
    const requiredZoomIn = Math.max(rotatedW / Math.max(1e-6, baseW), rotatedH / Math.max(1e-6, baseH));

    // Scale <= 1 that keeps rotated content contained within the output rect.
    let safeContainScale = 1 / Math.max(1, requiredZoomIn);

    if (Math.abs(safeContainScale - 1) < 1e-6) safeContainScale = 1;

    // Crop center in UV (source image UV coordinates).
    const cropCenterXInUV = (cropX + cropW * 0.5) / w;
    const cropCenterYInImage = cropY + cropH * 0.5;
    const cropCenterYInUV = 1.0 - cropCenterYInImage / h;

    // Convert UV centers back to "pixel-like" units for translations/rotations.
    // (We later normalize back to UV by multiplying scale(1/w, 1/h).)
    const cropCenterXInPx = cropCenterXInUV * w;
    const cropCenterYInPx = cropCenterYInUV * h;
    const imageCenterXInPx = w * 0.5;
    const imageCenterYInPx = h * 0.5;

    let transform = identityMat3();

    // Start in UV space: normalize from pixels to UV (this makes subsequent px translations meaningful
    // because translations are expressed in the same units as the current space).
    transform = multiplyMat3(transform, scaleMat3(1 / w, 1 / h));

    if (straightenDeg !== 0) {
        // Apply "straighten" around the FULL IMAGE center (not crop center).
        transform = multiplyMat3(transform, translationMat3(imageCenterXInPx, imageCenterYInPx));
        transform = multiplyMat3(transform, rotationMat3(straightenRad));
        transform = multiplyMat3(transform, translationMat3(-imageCenterXInPx, -imageCenterYInPx));
    }

    // Move sampling origin to the crop center (in pixel units).
    transform = multiplyMat3(transform, translationMat3(cropCenterXInPx, cropCenterYInPx));

    // Apply flips around the crop center (since we already translated to crop center).
    // Flips are applied before rotation so rotation always appears in the same direction.
    transform = multiplyMat3(transform, scaleMat3(sx, sy));
    // Apply main rotation. Negative sign is typical for inverse mapping (output -> source sampling).
    transform = multiplyMat3(transform, rotationMat3(-rotationRad));
    // Scale from normalized [0..1] output coords into output pixel units.
    transform = multiplyMat3(transform, scaleMat3(outW, outH));
    // Shrink content so rotated bounds remain inside output (prevents corner clipping).
    transform = multiplyMat3(transform, scaleMat3(safeContainScale, safeContainScale));
    // Center output UV around (0,0) by shifting by half a unit.
    // This makes the output coordinate origin effectively at the output center.
    transform = multiplyMat3(transform, translationMat3(-0.5, -0.5));

    return transform;
};

export const buildTexTransformForFullImageWithDimensions = (
    rotation: number,
    straightenAngle: number,
    flipX: boolean,
    flipY: boolean,
    imageWidth: number,
    imageHeight: number,
    outputWidth: number,
    outputHeight: number,
): Mat3 => {
    return buildTexTransformFromCropWithDimensions(
        rotation,
        straightenAngle,
        flipX,
        flipY,
        0,
        0,
        imageWidth,
        imageHeight,
        imageWidth,
        imageHeight,
        outputWidth,
        outputHeight,
    );
};
