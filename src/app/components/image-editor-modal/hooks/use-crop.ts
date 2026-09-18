import { clamp } from 'lodash';
import { useState, useEffect, useCallback, useRef } from 'react';

import { useEditorContext } from '../context/editor-context';
import {
    applyAspectRatioToCrop,
    constrainCropToImageWithMinSize,
    getAspectRatioFromPreset,
    getRotatedDimensions,
    ASPECT_RATIO_PRESETS,
    type PageSizePreset,
} from '../utils/crop-utils';
import { isQuarterTurnRotationDegrees } from '../utils/tex-transform-utils';

import { useSourceImage } from './use-source-image';

const MIN_CROP_DIMENSION = 1;

interface CropRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface UseCropProps {
    imageUrl: string;
    recordSnapshot: () => void;
}

export const useCrop = ({ imageUrl, recordSnapshot }: UseCropProps) => {
    const { cropState, updateCropState } = useEditorContext();
    const { imageRef } = useSourceImage(imageUrl);
    const imageDimensions = {
        width: imageRef.current?.naturalWidth || 0,
        height: imageRef.current?.naturalHeight || 0,
    };
    const isQuarterTurnRotation = isQuarterTurnRotationDegrees(cropState.rotation);

    const viewWidth = cropState.width || 0;
    const viewHeight = cropState.height || 0;

    const viewImageDimensions = getRotatedDimensions(imageDimensions, isQuarterTurnRotation);

    const [widthDraft, setWidthDraft] = useState(String(Math.round(viewWidth)));
    const [heightDraft, setHeightDraft] = useState(String(Math.round(viewHeight)));
    const [isAspectRatioLocked, setIsAspectRatioLocked] = useState(cropState.lockedAspectRatio !== null);
    const [activePreset, setActivePreset] = useState<string | null>(null);
    const [activePagePresetId, setActivePagePresetId] = useState<string | null>(null);
    const preEditCropRef = useRef<CropRect | null>(null);
    const isWidthEscapingRef = useRef(false);
    const isHeightEscapingRef = useRef(false);

    useEffect(() => {
        setWidthDraft(String(Math.round(viewWidth)));
        setHeightDraft(String(Math.round(viewHeight)));
    }, [viewWidth, viewHeight]);

    useEffect(() => {
        setIsAspectRatioLocked(cropState.lockedAspectRatio !== null);
    }, [cropState.lockedAspectRatio]);

    const applyAspectRatio = useCallback(
        (ratio: number | null) => {
            if (!ratio) return;
            if (!viewImageDimensions.width || !viewImageDimensions.height) return;

            if (cropState.mode === 'fit') {
                // In fit mode, we just recalculate the frame based on the new ratio

                const imageW = viewImageDimensions.width;
                const imageH = viewImageDimensions.height;
                const imageRatio = imageW / imageH;

                let w, h;

                if (ratio < imageRatio) {
                    // Target is taller than image. Match width, increase height.
                    w = imageW;
                    h = w / ratio;
                } else {
                    // Target is wider than image. Match height, increase width.
                    h = imageH;
                    w = h * ratio;
                }

                const x = (imageW - w) / 2;
                const y = (imageH - h) / 2;

                updateCropState({
                    x,
                    y,
                    width: w,
                    height: h,
                });

                setWidthDraft(String(Math.round(w)));
                setHeightDraft(String(Math.round(h)));

                return;
            }

            const viewCrop = {
                x: cropState.x,
                y: cropState.y,
                width: cropState.width,
                height: cropState.height,
            };

            const next = applyAspectRatioToCrop(viewCrop, ratio, viewImageDimensions, MIN_CROP_DIMENSION);

            updateCropState({
                x: next.x,
                y: next.y,
                width: next.width,
                height: next.height,
            });

            setWidthDraft(String(Math.round(next.width)));
            setHeightDraft(String(Math.round(next.height)));
        },
        [
            cropState.x,
            cropState.y,
            cropState.width,
            cropState.height,
            cropState.rotation,
            cropState.mode,
            imageDimensions.width,
            imageDimensions.height,
            viewImageDimensions,
            updateCropState,
        ],
    );

    const applyMaxAspectRatioCrop = useCallback(
        (ratio: number) => {
            const imageW = viewImageDimensions.width || 0;
            const imageH = viewImageDimensions.height || 0;

            if (imageW <= 0 || imageH <= 0) return;
            if (!Number.isFinite(ratio) || ratio <= 0) return;

            if (cropState.mode === 'fit') {
                const imageRatio = imageW / imageH;
                let w, h;

                if (ratio < imageRatio) {
                    // Target is taller than image. Match width, increase height.
                    w = imageW;
                    h = w / ratio;
                } else {
                    // Target is wider than image. Match height, increase width.
                    h = imageH;
                    w = h * ratio;
                }

                const x = (imageW - w) / 2;
                const y = (imageH - h) / 2;

                updateCropState({
                    lockedAspectRatio: ratio,
                    x,
                    y,
                    width: w,
                    height: h,
                });

                setWidthDraft(String(Math.round(w)));
                setHeightDraft(String(Math.round(h)));

                return;
            }

            let w = imageW;
            let h = w / ratio;

            if (h > imageH) {
                h = imageH;
                w = h * ratio;
            }

            w = clamp(w, MIN_CROP_DIMENSION, imageW);
            h = clamp(h, MIN_CROP_DIMENSION, imageH);

            const next = constrainCropToImageWithMinSize(
                {
                    x: (imageW - w) * 0.5,
                    y: (imageH - h) * 0.5,
                    width: w,
                    height: h,
                },
                viewImageDimensions,
                MIN_CROP_DIMENSION,
            );

            updateCropState({
                lockedAspectRatio: ratio,
                x: next.x,
                y: next.y,
                width: next.width,
                height: next.height,
            });

            setWidthDraft(String(Math.round(next.width)));
            setHeightDraft(String(Math.round(next.height)));
        },
        [
            viewImageDimensions,
            imageDimensions.width,
            imageDimensions.height,
            cropState.rotation,
            cropState.mode,
            updateCropState,
        ],
    );

    const applyFixedSize = useCallback(
        (targetWidth: number, targetHeight: number) => {
            const imageW = viewImageDimensions.width || 0;
            const imageH = viewImageDimensions.height || 0;

            if (imageW <= 0 || imageH <= 0) return;
            if (
                !Number.isFinite(targetWidth) ||
                !Number.isFinite(targetHeight) ||
                targetWidth <= 0 ||
                targetHeight <= 0
            )
                return;

            const ratio = targetWidth / targetHeight;

            if (!Number.isFinite(ratio) || ratio <= 0) return;

            applyMaxAspectRatioCrop(ratio);
        },
        [applyMaxAspectRatioCrop, viewImageDimensions.height, viewImageDimensions.width],
    );

    const handleWidthChange = useCallback(
        (value: string) => {
            setWidthDraft(value);
            const numValue = parseFloat(value);

            if (!isNaN(numValue) && numValue > 0) {
                if (cropState.mode === 'fit') {
                    const w = numValue;
                    const h = cropState.lockedAspectRatio ? w / cropState.lockedAspectRatio : cropState.height;

                    // In fit mode, we center the frame around the image
                    const imageW = viewImageDimensions.width;
                    const imageH = viewImageDimensions.height;
                    const x = (imageW - w) / 2;
                    const y = (imageH - h) / 2;

                    updateCropState({
                        x,
                        y,
                        width: w,
                        height: h,
                    });
                    setHeightDraft(String(Math.round(h)));

                    return;
                }

                const maxWidth = viewImageDimensions.width > 0 ? viewImageDimensions.width : Number.MAX_SAFE_INTEGER;
                const clampedWidth = clamp(numValue, MIN_CROP_DIMENSION, maxWidth);

                const nextHeight = cropState.lockedAspectRatio
                    ? Math.max(MIN_CROP_DIMENSION, clampedWidth / cropState.lockedAspectRatio)
                    : viewHeight;

                const constrained = constrainCropToImageWithMinSize(
                    {
                        x: cropState.x,
                        y: cropState.y,
                        width: clampedWidth,
                        height: nextHeight,
                    },
                    viewImageDimensions,
                    MIN_CROP_DIMENSION,
                );

                updateCropState({
                    x: constrained.x,
                    y: constrained.y,
                    width: constrained.width,
                    height: constrained.height,
                });

                setHeightDraft(String(Math.round(constrained.height)));
            }
        },
        [
            viewImageDimensions,
            cropState.x,
            cropState.y,
            cropState.lockedAspectRatio,
            cropState.height,
            cropState.mode,
            updateCropState,
            isQuarterTurnRotation,
            viewHeight,
        ],
    );

    const handleWidthBlur = useCallback(() => {
        preEditCropRef.current = null;

        // Escape blurs the field to leave the edit. Its restore has already run, but this
        // closure still holds the discarded draft and the pre-restore dimensions, so without
        // the flag the validation below would write the abandoned edit back into the draft.
        if (isWidthEscapingRef.current) {
            isWidthEscapingRef.current = false;

            return;
        }

        const numValue = parseFloat(widthDraft);

        if (isNaN(numValue) || numValue <= 0) {
            setWidthDraft(String(Math.round(viewWidth)));
        }
    }, [widthDraft, viewWidth]);

    const handleHeightChange = useCallback(
        (value: string) => {
            setHeightDraft(value);
            const numValue = parseFloat(value);

            if (!isNaN(numValue) && numValue > 0) {
                if (cropState.mode === 'fit') {
                    const h = numValue;
                    const w = cropState.lockedAspectRatio ? h * cropState.lockedAspectRatio : cropState.width;

                    const imageW = viewImageDimensions.width;
                    const imageH = viewImageDimensions.height;
                    const x = (imageW - w) / 2;
                    const y = (imageH - h) / 2;

                    updateCropState({
                        x,
                        y,
                        width: w,
                        height: h,
                    });
                    setWidthDraft(String(Math.round(w)));

                    return;
                }

                const maxHeight = viewImageDimensions.height > 0 ? viewImageDimensions.height : Number.MAX_SAFE_INTEGER;
                const clampedHeight = clamp(numValue, MIN_CROP_DIMENSION, maxHeight);

                const nextWidth = cropState.lockedAspectRatio
                    ? Math.max(MIN_CROP_DIMENSION, clampedHeight * cropState.lockedAspectRatio)
                    : viewWidth;

                const constrained = constrainCropToImageWithMinSize(
                    {
                        x: cropState.x,
                        y: cropState.y,
                        width: nextWidth,
                        height: clampedHeight,
                    },
                    viewImageDimensions,
                    MIN_CROP_DIMENSION,
                );

                updateCropState({
                    x: constrained.x,
                    y: constrained.y,
                    width: constrained.width,
                    height: constrained.height,
                });

                setWidthDraft(String(Math.round(constrained.width)));
            }
        },
        [
            viewImageDimensions,
            cropState.x,
            cropState.y,
            cropState.lockedAspectRatio,
            cropState.width,
            cropState.rotation,
            cropState.mode,
            imageDimensions.width,
            imageDimensions.height,
            updateCropState,
            viewWidth,
        ],
    );

    const handleHeightBlur = useCallback(() => {
        preEditCropRef.current = null;

        if (isHeightEscapingRef.current) {
            isHeightEscapingRef.current = false;

            return;
        }

        const numValue = parseFloat(heightDraft);

        if (isNaN(numValue) || numValue <= 0) {
            setHeightDraft(String(Math.round(viewHeight)));
        }
    }, [heightDraft, viewHeight]);

    const handlePresetClick = useCallback(
        (preset: (typeof ASPECT_RATIO_PRESETS)[0]) => {
            recordSnapshot();
            setActivePreset(preset.value);
            setActivePagePresetId(null);
            const ratio = getAspectRatioFromPreset(preset.value);

            if (ratio) {
                applyMaxAspectRatioCrop(ratio);
            } else {
                updateCropState({ lockedAspectRatio: null });
            }
        },
        [applyMaxAspectRatioCrop, recordSnapshot, updateCropState],
    );

    const handlePagePresetClick = useCallback(
        (preset: PageSizePreset) => {
            recordSnapshot();
            setActivePagePresetId(preset.id);
            applyFixedSize(preset.width, preset.height);
        },
        [applyFixedSize, recordSnapshot],
    );

    const handleAspectRatioLockChange = useCallback(
        (checked: boolean) => {
            recordSnapshot();
            if (checked && viewWidth && viewHeight) {
                const currentRatio = viewWidth / viewHeight;

                updateCropState({ lockedAspectRatio: currentRatio });
                applyAspectRatio(currentRatio);
            } else {
                updateCropState({ lockedAspectRatio: null });
            }
        },
        [recordSnapshot, viewWidth, viewHeight, updateCropState, applyAspectRatio],
    );

    // The crop rect starts at `DEFAULT_CROP_STATE`'s 0×0 and is only seeded once the source image
    // decodes, so a field focused during that window would otherwise snapshot a degenerate frame
    // and restore it — a zero-area crop that no min-size guard rejects. Nothing to cancel back to
    // yet in that case, so record nothing.
    const snapshotPreEditCrop = useCallback(() => {
        if (cropState.width <= 0 || cropState.height <= 0) {
            preEditCropRef.current = null;

            return;
        }

        preEditCropRef.current = {
            x: cropState.x,
            y: cropState.y,
            width: cropState.width,
            height: cropState.height,
        };
    }, [cropState.x, cropState.y, cropState.width, cropState.height]);

    const handleWidthFocus = useCallback(() => {
        recordSnapshot();
        snapshotPreEditCrop();
    }, [recordSnapshot, snapshotPreEditCrop]);

    const handleHeightFocus = useCallback(() => {
        recordSnapshot();
        snapshotPreEditCrop();
    }, [recordSnapshot, snapshotPreEditCrop]);

    // Both fields commit live on every keystroke so the canvas previews the new frame, and a
    // locked aspect ratio makes each one move the other. Cancelling therefore writes the whole
    // pre-edit rect back rather than restoring the single field that was typed in.
    const restorePreEditCrop = useCallback(() => {
        const preEdit = preEditCropRef.current;

        preEditCropRef.current = null;

        if (!preEdit) return;

        updateCropState(preEdit);
        setWidthDraft(String(Math.round(preEdit.width)));
        setHeightDraft(String(Math.round(preEdit.height)));
    }, [updateCropState]);

    const handleWidthEscape = useCallback(() => {
        isWidthEscapingRef.current = true;
        restorePreEditCrop();
    }, [restorePreEditCrop]);

    const handleHeightEscape = useCallback(() => {
        isHeightEscapingRef.current = true;
        restorePreEditCrop();
    }, [restorePreEditCrop]);

    useEffect(() => {
        if (cropState.lockedAspectRatio == null) {
            setActivePreset('free');

            return;
        }

        const found = ASPECT_RATIO_PRESETS.find((preset) => {
            const r = getAspectRatioFromPreset(preset.value);

            return r != null && Math.abs(r - cropState.lockedAspectRatio!) < 1e-3;
        });

        setActivePreset(found?.value ?? null);
    }, [cropState.lockedAspectRatio]);

    return {
        widthDraft,
        heightDraft,
        isAspectRatioLocked,
        activePreset,
        activePagePresetId,
        handleWidthFocus,
        handleHeightFocus,
        handleWidthChange,
        handleWidthBlur,
        handleWidthEscape,
        handleHeightChange,
        handleHeightBlur,
        handleHeightEscape,
        handlePresetClick,
        handlePagePresetClick,
        handleAspectRatioLockChange,
    };
};
