import React, { useCallback } from 'react';

import { BRUSH_SIZE_RATIO, PEN_SIZE_RATIO } from '../../constants';
import type { CanvasSnapshot } from '../../types';

import type { MaskImageRefs } from './use-mask-image-refs';

export interface UseMaskPointerArgs {
    refs: MaskImageRefs;
    isMaskActive: boolean;
    maskHasStrokes: boolean;
    setMaskHasStrokes: (value: boolean) => void;
    setCanUndo: (value: boolean) => void;
    setCanRedo: (value: boolean) => void;
    saveCanvasSnapshots: () => CanvasSnapshot | null;
    drawMaskPreviewFrame: (ts?: number) => void;
    startPreviewLoop: () => void;
    stopPreviewLoop: () => void;
}

export interface UseMaskPointerResult {
    hideMaskCursor: () => void;
    setMaskCursorFromEvent: (event: React.PointerEvent) => void;
    setMaskTargetEl: (el: HTMLDivElement | null) => void;
    onMaskPointerDown: (event: React.PointerEvent) => void;
    onMaskPointerMove: (event: React.PointerEvent) => void;
    onMaskPointerUp: (event: React.PointerEvent) => void;
    onMaskPointerLeave: () => void;
}

export const useMaskPointer = (args: UseMaskPointerArgs): UseMaskPointerResult => {
    const {
        refs,
        isMaskActive,
        maskHasStrokes,
        setMaskHasStrokes,
        setCanUndo,
        setCanRedo,
        saveCanvasSnapshots,
        drawMaskPreviewFrame,
        startPreviewLoop,
        stopPreviewLoop,
    } = args;

    const hideMaskCursor = useCallback(() => {
        const cursor = refs.maskCursorRef.current;

        if (cursor) {
            cursor.style.visibility = 'hidden';
        }
    }, [refs]);

    const setMaskCursorFromEvent = useCallback(
        (event: React.PointerEvent) => {
            if (!isMaskActive) return;
            if (event.pointerType !== 'mouse') return;
            const target = refs.maskTargetRef.current;
            const cursor = refs.maskCursorRef.current;

            if (!target || !cursor) return;

            const rect = target.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;

            if (refs.cursorRafRef.current) {
                cancelAnimationFrame(refs.cursorRafRef.current);
            }

            refs.cursorRafRef.current = requestAnimationFrame(() => {
                cursor.style.left = `${x}px`;
                cursor.style.top = `${y}px`;
                cursor.style.visibility = 'visible';
            });
        },
        [isMaskActive, refs],
    );

    const getCanvasPoint = useCallback(
        (event: React.PointerEvent) => {
            const canvas = refs.maskCanvasRef.current;

            if (!canvas) return null;
            const rect = canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;

            return { x, y };
        },
        [refs],
    );

    const onMaskPointerDown = useCallback(
        (event: React.PointerEvent) => {
            if (!isMaskActive) return;
            setMaskCursorFromEvent(event);
            refs.outlineDirtyRef.current = true;
            const canvas = refs.maskCanvasRef.current;

            if (!canvas) return;
            event.preventDefault();
            event.stopPropagation();
            canvas.setPointerCapture(event.pointerId);
            refs.isDrawingRef.current = true;

            refs.preStrokeSnapshotRef.current = saveCanvasSnapshots();

            const pt = getCanvasPoint(event);
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;

            refs.lastPointRef.current = pt;

            if (pt) {
                if (refs.toolModeRef.current === 'brush') {
                    const ctx = canvas.getContext('2d');

                    if (ctx) {
                        ctx.beginPath();
                        ctx.moveTo(pt.x * scaleX, pt.y * scaleY);
                    }
                } else {
                    const penCanvas = refs.penCanvasRef.current;
                    const penCtx = penCanvas?.getContext('2d');

                    if (penCtx) {
                        penCtx.beginPath();
                        penCtx.moveTo(pt.x * scaleX, pt.y * scaleY);
                    }
                }
                if (refs.toolModeRef.current === 'brush') {
                    drawMaskPreviewFrame(performance.now());
                }
            }
        },
        [drawMaskPreviewFrame, getCanvasPoint, isMaskActive, refs, saveCanvasSnapshots, setMaskCursorFromEvent],
    );

    const onMaskPointerMove = useCallback(
        (event: React.PointerEvent) => {
            if (!isMaskActive) return;
            setMaskCursorFromEvent(event);
            if (!refs.isDrawingRef.current) return;
            if (event.buttons === 0) {
                if (refs.preStrokeSnapshotRef.current) {
                    refs.undoStackRef.current.push(refs.preStrokeSnapshotRef.current);
                    refs.redoStackRef.current = [];
                    refs.preStrokeSnapshotRef.current = null;
                    setCanUndo(true);
                    setCanRedo(false);
                }
                refs.isDrawingRef.current = false;
                refs.lastPointRef.current = null;
                stopPreviewLoop();
                startPreviewLoop();

                return;
            }
            refs.outlineDirtyRef.current = true;
            const canvas = refs.maskCanvasRef.current;

            if (!canvas) return;
            event.preventDefault();
            event.stopPropagation();
            const pt = getCanvasPoint(event);
            const last = refs.lastPointRef.current;

            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;

            if (!pt || !last) return;

            if (refs.toolModeRef.current === 'brush') {
                const ctx = canvas.getContext('2d');

                if (!ctx) return;
                ctx.beginPath();
                ctx.moveTo(last.x * scaleX, last.y * scaleY);
                ctx.lineTo(pt.x * scaleX, pt.y * scaleY);
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = rect.width * BRUSH_SIZE_RATIO[refs.brushToolSizeRef.current] * scaleX;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.stroke();
                drawMaskPreviewFrame(performance.now());
            } else {
                const penCanvas = refs.penCanvasRef.current;
                const penCtx = penCanvas?.getContext('2d');

                if (!penCtx) return;
                penCtx.beginPath();
                penCtx.moveTo(last.x * scaleX, last.y * scaleY);
                penCtx.lineTo(pt.x * scaleX, pt.y * scaleY);
                penCtx.strokeStyle = refs.penColorRef.current;
                penCtx.lineWidth = rect.width * PEN_SIZE_RATIO[refs.penToolSizeRef.current] * scaleX;
                penCtx.lineCap = 'round';
                penCtx.lineJoin = 'round';
                penCtx.stroke();
            }

            refs.lastPointRef.current = pt;
            if (!maskHasStrokes) setMaskHasStrokes(true);
        },
        [
            drawMaskPreviewFrame,
            getCanvasPoint,
            isMaskActive,
            maskHasStrokes,
            refs,
            setCanRedo,
            setCanUndo,
            setMaskCursorFromEvent,
            setMaskHasStrokes,
            startPreviewLoop,
            stopPreviewLoop,
        ],
    );

    const onMaskPointerUp = useCallback(
        (event: React.PointerEvent) => {
            const canvas = refs.maskCanvasRef.current;

            refs.outlineDirtyRef.current = true;

            if (canvas) {
                try {
                    canvas.releasePointerCapture(event.pointerId);
                } catch {
                    void 0;
                }
            }

            if (refs.isDrawingRef.current && refs.preStrokeSnapshotRef.current) {
                refs.undoStackRef.current.push(refs.preStrokeSnapshotRef.current);
                refs.redoStackRef.current = [];
                refs.preStrokeSnapshotRef.current = null;
                setCanUndo(true);
                setCanRedo(false);
            }

            refs.isDrawingRef.current = false;
            refs.lastPointRef.current = null;

            if (isMaskActive) {
                stopPreviewLoop();
                startPreviewLoop();
            }
        },
        [isMaskActive, refs, setCanRedo, setCanUndo, startPreviewLoop, stopPreviewLoop],
    );

    const onMaskPointerLeave = useCallback(() => {
        hideMaskCursor();
    }, [hideMaskCursor]);

    const setMaskTargetEl = useCallback(
        (el: HTMLDivElement | null) => {
            refs.maskTargetRef.current = el;
        },
        [refs],
    );

    return {
        hideMaskCursor,
        setMaskCursorFromEvent,
        setMaskTargetEl,
        onMaskPointerDown,
        onMaskPointerMove,
        onMaskPointerUp,
        onMaskPointerLeave,
    };
};
