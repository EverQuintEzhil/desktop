import { useCallback } from 'react';

import type { CanvasSnapshot } from '../../types';

import type { MaskImageRefs } from './use-mask-image-refs';

export interface UseMaskHistoryArgs {
    refs: MaskImageRefs;
    setMaskHasStrokes: (value: boolean) => void;
    setCanUndo: (value: boolean) => void;
    setCanRedo: (value: boolean) => void;
}

export interface UseMaskHistoryResult {
    saveCanvasSnapshots: () => CanvasSnapshot | null;
    checkHasStrokes: () => boolean;
    clearPreviewCanvas: () => void;
    undo: () => void;
    redo: () => void;
    clearMask: () => void;
}

export const useMaskHistory = (args: UseMaskHistoryArgs): UseMaskHistoryResult => {
    const { refs, setMaskHasStrokes, setCanUndo, setCanRedo } = args;

    const saveCanvasSnapshots = useCallback((): CanvasSnapshot | null => {
        const maskCanvas = refs.maskCanvasRef.current;
        const penCanvas = refs.penCanvasRef.current;

        if (!maskCanvas || !penCanvas) return null;
        const maskCtx = maskCanvas.getContext('2d');
        const penCtx = penCanvas.getContext('2d');

        if (!maskCtx || !penCtx) return null;

        return {
            mask: maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height),
            pen: penCtx.getImageData(0, 0, penCanvas.width, penCanvas.height),
        };
    }, [refs]);

    const checkHasStrokes = useCallback((): boolean => {
        const canvases = [refs.maskCanvasRef.current, refs.penCanvasRef.current];

        for (const canvas of canvases) {
            if (!canvas) continue;
            const ctx = canvas.getContext('2d');

            if (!ctx) continue;
            const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

            for (let i = 3; i < data.length; i += 4) {
                if (data[i] > 10) return true;
            }
        }

        return false;
    }, [refs]);

    const clearPreviewCanvas = useCallback(() => {
        const previewCanvas = refs.maskPreviewCanvasRef.current;

        if (!previewCanvas) return;
        const pctx = previewCanvas.getContext('2d');

        if (!pctx) return;
        pctx.save();
        pctx.setTransform(1, 0, 0, 1, 0, 0);
        pctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        pctx.restore();
    }, [refs]);

    const undo = useCallback(() => {
        if (!refs.undoStackRef.current.length) return;
        const maskCanvas = refs.maskCanvasRef.current;
        const penCanvas = refs.penCanvasRef.current;

        if (!maskCanvas || !penCanvas) return;
        const maskCtx = maskCanvas.getContext('2d');
        const penCtx = penCanvas.getContext('2d');

        if (!maskCtx || !penCtx) return;

        const current = saveCanvasSnapshots();

        if (current) refs.redoStackRef.current.push(current);

        const prev = refs.undoStackRef.current.pop()!;

        maskCtx.putImageData(prev.mask, 0, 0);
        penCtx.putImageData(prev.pen, 0, 0);
        clearPreviewCanvas();

        refs.outlineDirtyRef.current = true;
        const hasStrokes = checkHasStrokes();

        setMaskHasStrokes(hasStrokes);
        setCanUndo(refs.undoStackRef.current.length > 0);
        setCanRedo(refs.redoStackRef.current.length > 0);
    }, [checkHasStrokes, clearPreviewCanvas, refs, saveCanvasSnapshots, setCanRedo, setCanUndo, setMaskHasStrokes]);

    const redo = useCallback(() => {
        if (!refs.redoStackRef.current.length) return;
        const maskCanvas = refs.maskCanvasRef.current;
        const penCanvas = refs.penCanvasRef.current;

        if (!maskCanvas || !penCanvas) return;
        const maskCtx = maskCanvas.getContext('2d');
        const penCtx = penCanvas.getContext('2d');

        if (!maskCtx || !penCtx) return;

        const current = saveCanvasSnapshots();

        if (current) refs.undoStackRef.current.push(current);

        const next = refs.redoStackRef.current.pop()!;

        maskCtx.putImageData(next.mask, 0, 0);
        penCtx.putImageData(next.pen, 0, 0);
        clearPreviewCanvas();

        refs.outlineDirtyRef.current = true;
        const hasStrokes = checkHasStrokes();

        setMaskHasStrokes(hasStrokes);
        setCanUndo(refs.undoStackRef.current.length > 0);
        setCanRedo(refs.redoStackRef.current.length > 0);
    }, [checkHasStrokes, clearPreviewCanvas, refs, saveCanvasSnapshots, setCanRedo, setCanUndo, setMaskHasStrokes]);

    const clearMask = useCallback(() => {
        const canvas = refs.maskCanvasRef.current;
        const previewCanvas = refs.maskPreviewCanvasRef.current;
        const penCanvas = refs.penCanvasRef.current;

        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        if (!ctx) return;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();

        if (previewCanvas) {
            const pctx = previewCanvas.getContext('2d');

            if (pctx) {
                pctx.save();
                pctx.setTransform(1, 0, 0, 1, 0, 0);
                pctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
                pctx.restore();
            }
        }

        if (penCanvas) {
            const penCtx = penCanvas.getContext('2d');

            if (penCtx) {
                penCtx.save();
                penCtx.setTransform(1, 0, 0, 1, 0, 0);
                penCtx.clearRect(0, 0, penCanvas.width, penCanvas.height);
                penCtx.restore();
            }
        }

        refs.dashOffsetRef.current = 0;
        refs.lastPreviewTsRef.current = null;
        refs.outlineDirtyRef.current = true;
        refs.undoStackRef.current = [];
        refs.redoStackRef.current = [];
        refs.preStrokeSnapshotRef.current = null;
        setCanUndo(false);
        setCanRedo(false);
        setMaskHasStrokes(false);
    }, [refs, setCanRedo, setCanUndo, setMaskHasStrokes]);

    return {
        saveCanvasSnapshots,
        checkHasStrokes,
        clearPreviewCanvas,
        undo,
        redo,
        clearMask,
    };
};
