import React, { useRef, useState, useCallback, useEffect, memo, useMemo } from 'react';

import type { CropBox, ImageDimensions } from '../../utils/crop-utils';
import { applyCropMove, applyCropResize } from '../../utils/crop-utils';

import './crop-overlay.scss';

interface CropOverlayProps {
    crop: CropBox;
    imageDimensions: ImageDimensions;
    displaySize: { width: number; height: number };
    aspectRatio: number | null;
    onCropChange: (crop: CropBox) => void;
    onCropStart: () => void;
}

type HandlePosition = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const ALL_HANDLES: HandlePosition[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const CORNER_HANDLES: HandlePosition[] = ['nw', 'ne', 'se', 'sw'];

const HANDLE_LABELS: Record<HandlePosition, string> = {
    nw: 'top left corner',
    n: 'top edge',
    ne: 'top right corner',
    e: 'right edge',
    se: 'bottom right corner',
    s: 'bottom edge',
    sw: 'bottom left corner',
    w: 'left edge',
};

const ARROW_KEY_DELTAS: Record<string, { x: number; y: number }> = {
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
};

const ARROW_KEY_SHORTCUTS = 'ArrowUp ArrowDown ArrowLeft ArrowRight';
const KEYBOARD_DISPLAY_STEP = 1;
const KEYBOARD_LARGE_STEP_MULTIPLIER = 10;

export const KEYBOARD_NUDGE_IDLE_MS = 400;

// The crop is stored in image pixels but drawn at displaySize, so a fixed image-pixel step
// would move a barely visible amount when zoomed out and jump when zoomed in. One image pixel
// is the smallest meaningful crop change, so the step floors there at 100% zoom and above.
const toImageStep = (scale: number) => {
    if (!Number.isFinite(scale) || scale <= 0) {
        return KEYBOARD_DISPLAY_STEP;
    }

    return Math.max(1, Math.round(KEYBOARD_DISPLAY_STEP / scale));
};

const CropOverlay = memo((props: CropOverlayProps) => {
    const { crop, imageDimensions, displaySize, aspectRatio, onCropChange, onCropStart } = props;
    const [isDragging, setIsDragging] = useState(false);
    const [dragType, setDragType] = useState<'move' | 'resize' | null>(null);
    const [resizeHandle, setResizeHandle] = useState<HandlePosition | null>(null);
    const activePointerIdRef = useRef<number | null>(null);
    const dragStartPos = useRef({ x: 0, y: 0 });
    const dragStartCrop = useRef<CropBox>(crop);

    const rafIdRef = useRef<number | null>(null);
    const pendingClientPosRef = useRef<{ x: number; y: number } | null>(null);

    const scaleX = useMemo(() => displaySize.width / imageDimensions.width, [displaySize.width, imageDimensions.width]);
    const scaleY = useMemo(
        () => displaySize.height / imageDimensions.height,
        [displaySize.height, imageDimensions.height],
    );

    const keyboardStepX = useMemo(() => toImageStep(scaleX), [scaleX]);
    const keyboardStepY = useMemo(() => toImageStep(scaleY), [scaleY]);

    const handles = useMemo(() => (aspectRatio !== null ? CORNER_HANDLES : ALL_HANDLES), [aspectRatio]);

    const displayCrop = useMemo(
        () => ({
            x: crop.x * scaleX,
            y: crop.y * scaleY,
            width: crop.width * scaleX,
            height: crop.height * scaleY,
        }),
        [crop.x, crop.y, crop.width, crop.height, scaleX, scaleY],
    );

    const handlePointerDown = useCallback(
        (e: React.PointerEvent<HTMLDivElement>, type: 'move' | 'resize', handle?: HandlePosition) => {
            if (e.pointerType === 'mouse' && e.button !== 0) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();

            // preventDefault suppresses the compat mousedown that would normally focus this
            // element, which would leave the arrow-key affordance unreachable after any click.
            // preventScroll: the element is already under the pointer, and scrolling it into
            // view here would move the zoom container out from under the starting drag.
            e.currentTarget?.focus({ preventScroll: true });

            activePointerIdRef.current = e.pointerId;
            try {
                e.currentTarget?.setPointerCapture(e.pointerId);
            } catch {
                // no-op
            }

            setIsDragging(true);
            setDragType(type);
            if (handle) setResizeHandle(handle);

            dragStartPos.current = { x: e.clientX, y: e.clientY };
            dragStartCrop.current = crop;

            onCropStart();
        },
        [crop, onCropStart],
    );

    const handlePointerMove = useCallback(
        (e: PointerEvent) => {
            if (!isDragging || !dragType) return;
            if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) return;

            pendingClientPosRef.current = { x: e.clientX, y: e.clientY };

            if (rafIdRef.current !== null) return;

            rafIdRef.current = requestAnimationFrame(() => {
                rafIdRef.current = null;

                const pos = pendingClientPosRef.current;

                if (!pos || !isDragging || !dragType) return;

                const deltaX = (pos.x - dragStartPos.current.x) / scaleX;
                const deltaY = (pos.y - dragStartPos.current.y) / scaleY;

                if (dragType === 'move') {
                    const newCrop = applyCropMove(dragStartCrop.current, deltaX, deltaY, imageDimensions);

                    onCropChange(newCrop);

                    return;
                }

                if (dragType === 'resize' && resizeHandle) {
                    const newCrop = applyCropResize(
                        dragStartCrop.current,
                        resizeHandle,
                        deltaX,
                        deltaY,
                        aspectRatio,
                        imageDimensions,
                    );

                    onCropChange(newCrop);
                }
            });
        },
        [isDragging, dragType, resizeHandle, scaleX, scaleY, imageDimensions, aspectRatio, onCropChange],
    );

    const keyboardSnapshotTakenRef = useRef(false);
    const keyboardIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearKeyboardIdleTimer = useCallback(() => {
        if (keyboardIdleTimerRef.current !== null) {
            clearTimeout(keyboardIdleTimerRef.current);
            keyboardIdleTimerRef.current = null;
        }
    }, []);

    const endKeyboardNudge = useCallback(() => {
        clearKeyboardIdleTimer();
        keyboardSnapshotTakenRef.current = false;
    }, [clearKeyboardIdleTimer]);

    const handleKeyUp = useCallback(
        (e: React.KeyboardEvent<HTMLDivElement>) => {
            if (!ARROW_KEY_DELTAS[e.key]) return;

            clearKeyboardIdleTimer();
            keyboardIdleTimerRef.current = setTimeout(endKeyboardNudge, KEYBOARD_NUDGE_IDLE_MS);
        },
        [clearKeyboardIdleTimer, endKeyboardNudge],
    );

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLDivElement>, handle?: HandlePosition) => {
            const direction = ARROW_KEY_DELTAS[e.key];

            if (!direction) return;

            e.preventDefault();
            e.stopPropagation();

            const multiplier = e.shiftKey ? KEYBOARD_LARGE_STEP_MULTIPLIER : 1;
            const deltaX = direction.x * keyboardStepX * multiplier;
            const deltaY = direction.y * keyboardStepY * multiplier;

            // One undo snapshot per burst. Key repeat and rapid taps both keep the gate closed;
            // it only reopens after KEYBOARD_NUDGE_IDLE_MS of no arrow activity, or on blur.
            // A pointer drag records one snapshot the same way.
            clearKeyboardIdleTimer();

            if (!keyboardSnapshotTakenRef.current) {
                keyboardSnapshotTakenRef.current = true;
                onCropStart();
            }

            if (!handle) {
                onCropChange(applyCropMove(crop, deltaX, deltaY, imageDimensions));

                return;
            }

            onCropChange(applyCropResize(crop, handle, deltaX, deltaY, aspectRatio, imageDimensions));
        },
        [
            crop,
            imageDimensions,
            aspectRatio,
            onCropChange,
            onCropStart,
            keyboardStepX,
            keyboardStepY,
            clearKeyboardIdleTimer,
        ],
    );

    const endDrag = useCallback(() => {
        if (isDragging) {
            setIsDragging(false);
            setDragType(null);
            setResizeHandle(null);
            activePointerIdRef.current = null;

            if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
            }
            pendingClientPosRef.current = null;
        }
    }, [isDragging]);

    useEffect(() => {
        if (!isDragging) return;

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', endDrag);
        window.addEventListener('pointercancel', endDrag);

        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', endDrag);
            window.removeEventListener('pointercancel', endDrag);
        };
    }, [isDragging, handlePointerMove, endDrag]);

    useEffect(() => {
        return () => {
            if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
            }
            if (keyboardIdleTimerRef.current !== null) {
                clearTimeout(keyboardIdleTimerRef.current);
            }
        };
    }, []);

    return (
        <div
            className="crop-overlay-container"
            style={{
                width: `${displaySize.width}px`,
                height: `${displaySize.height}px`,
            }}
        >
            <div
                className="crop-box"
                style={{
                    transform: `translate(${displayCrop.x}px, ${displayCrop.y}px)`,
                    width: `${displayCrop.width}px`,
                    height: `${displayCrop.height}px`,
                    left: 0,
                    top: 0,
                }}
                onPointerDown={(e) => handlePointerDown(e, 'move')}
                onKeyDown={(e) => handleKeyDown(e)}
                onKeyUp={handleKeyUp}
                onBlur={endKeyboardNudge}
                role="group"
                aria-label="Crop area"
                aria-keyshortcuts={ARROW_KEY_SHORTCUTS}
                tabIndex={0}
            >
                <div className="crop-grid" />

                {handles.map((handle) => {
                    const isCorner = CORNER_HANDLES.includes(handle as HandlePosition);

                    const handleLabel = `Resize crop from the ${HANDLE_LABELS[handle]}`;

                    if (isCorner) {
                        return (
                            <div
                                className={`corner-handle-container handle-${handle}`}
                                key={handle}
                                onPointerDown={(e) => handlePointerDown(e, 'resize', handle)}
                                onKeyDown={(e) => handleKeyDown(e, handle)}
                                onKeyUp={handleKeyUp}
                                onBlur={endKeyboardNudge}
                                role="group"
                                aria-label={handleLabel}
                                aria-keyshortcuts={ARROW_KEY_SHORTCUTS}
                                tabIndex={0}
                            >
                                <div className={`corner-handle-horizontal handle handle-${handle}`} />
                                <div className={`corner-handle-vertical handle handle-${handle}`} />
                            </div>
                        );
                    }

                    return (
                        <div
                            className={`edge-handle handle handle-${handle}`}
                            key={handle}
                            onPointerDown={(e) => handlePointerDown(e, 'resize', handle)}
                            onKeyDown={(e) => handleKeyDown(e, handle)}
                            onKeyUp={handleKeyUp}
                            onBlur={endKeyboardNudge}
                            role="group"
                            aria-label={handleLabel}
                            aria-keyshortcuts={ARROW_KEY_SHORTCUTS}
                            tabIndex={0}
                        />
                    );
                })}
            </div>
        </div>
    );
});

export default CropOverlay;
