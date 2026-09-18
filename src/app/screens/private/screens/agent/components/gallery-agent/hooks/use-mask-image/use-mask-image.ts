import { useCallback, useEffect, useMemo, useState } from 'react';

import { BRUSH_SIZE_RATIO, PEN_CURSOR_SIZE } from '../../constants';
import type { PenSize, ToolMode, UseMaskImageArgs, UseMaskImageResult } from '../../types';

import {
    exportMaskDataUrl as exportMaskDataUrlUtil,
    exportPenCompositeBlob as exportPenCompositeBlobUtil,
} from './export-mask-image';
import { useMaskHistory } from './use-mask-history';
import { useMaskImageRefs } from './use-mask-image-refs';
import { useMaskPointer } from './use-mask-pointer';
import { useMaskPreview } from './use-mask-preview';
import { useMaskResize } from './use-mask-resize';

export type { PenSize, ToolMode, UseMaskImageArgs, UseMaskImageResult } from '../../types';

const useMaskImage = (args: UseMaskImageArgs): UseMaskImageResult => {
    const { isOpen, showRemixInput, maskSupported, currentItem, brushSize = 90 } = args;

    const [maskHasStrokes, setMaskHasStrokes] = useState(false);
    const [toolMode, setToolMode] = useState<ToolMode>('brush');
    const [penColor, setPenColor] = useState('#ff0000');
    const [brushToolSize, setBrushToolSize] = useState<PenSize>('md');
    const [penToolSize, setPenToolSize] = useState<PenSize>('sm');
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);

    const refs = useMaskImageRefs();

    const itemKey = useMemo(() => currentItem?._id, [currentItem]);
    const isMaskActive = useMemo(
        () => isOpen && showRemixInput && maskSupported,
        [isOpen, maskSupported, showRemixInput],
    );

    useEffect(() => {
        refs.maskHasStrokesRef.current = maskHasStrokes;
    }, [maskHasStrokes, refs]);

    useEffect(() => {
        refs.toolModeRef.current = toolMode;
    }, [refs, toolMode]);

    useEffect(() => {
        refs.penColorRef.current = penColor;
    }, [penColor, refs]);

    useEffect(() => {
        refs.brushToolSizeRef.current = brushToolSize;
    }, [brushToolSize, refs]);

    useEffect(() => {
        refs.penToolSizeRef.current = penToolSize;
    }, [penToolSize, refs]);

    const history = useMaskHistory({
        refs,
        setMaskHasStrokes,
        setCanUndo,
        setCanRedo,
    });

    const preview = useMaskPreview({
        refs,
        isMaskActive,
        maskHasStrokes,
        itemKey,
    });

    const pointer = useMaskPointer({
        refs,
        isMaskActive,
        maskHasStrokes,
        setMaskHasStrokes,
        setCanUndo,
        setCanRedo,
        saveCanvasSnapshots: history.saveCanvasSnapshots,
        drawMaskPreviewFrame: preview.drawMaskPreviewFrame,
        startPreviewLoop: preview.startPreviewLoop,
        stopPreviewLoop: preview.stopPreviewLoop,
    });

    const resize = useMaskResize({
        refs,
        isOpen,
        showRemixInput,
        maskSupported,
        isMaskActive,
        setMaskHasStrokes,
        hideMaskCursor: pointer.hideMaskCursor,
    });

    const activeCursorSize =
        toolMode === 'brush'
            ? Math.round(resize.canvasDisplayWidth * BRUSH_SIZE_RATIO[brushToolSize])
            : PEN_CURSOR_SIZE;

    useEffect(() => {
        setMaskHasStrokes(false);
        pointer.hideMaskCursor();
        refs.outlineDirtyRef.current = true;
        refs.undoStackRef.current = [];
        refs.redoStackRef.current = [];
        setCanUndo(false);
        setCanRedo(false);
        history.clearMask();
    }, [history.clearMask, pointer.hideMaskCursor, refs, itemKey]);

    useEffect(() => {
        return () => {
            if (refs.cursorRafRef.current) {
                cancelAnimationFrame(refs.cursorRafRef.current);
            }
            preview.stopPreviewLoop();
        };
    }, [preview.stopPreviewLoop, refs]);

    const exportMaskDataUrl = useCallback(
        () => exportMaskDataUrlUtil(refs.maskCanvasRef.current, refs.penCanvasRef.current, maskHasStrokes, currentItem),
        [currentItem, maskHasStrokes, refs],
    );

    const exportPenCompositeBlob = useCallback(
        () => exportPenCompositeBlobUtil(refs.penCanvasRef.current, refs.maskTargetRef.current),
        [refs],
    );

    return {
        brushSize,
        maskHasStrokes,
        maskCanvasRef: refs.maskCanvasRef,
        maskPreviewCanvasRef: refs.maskPreviewCanvasRef,
        penCanvasRef: refs.penCanvasRef,
        maskCursorRef: refs.maskCursorRef,
        setMaskTargetEl: pointer.setMaskTargetEl,
        activeCursorSize,
        onMaskPointerDown: pointer.onMaskPointerDown,
        onMaskPointerMove: pointer.onMaskPointerMove,
        onMaskPointerUp: pointer.onMaskPointerUp,
        onMaskPointerLeave: pointer.onMaskPointerLeave,
        clearMask: history.clearMask,
        resizeMaskCanvasToTarget: resize.resizeMaskCanvasToTarget,
        exportMaskDataUrl,
        exportPenCompositeBlob,
        toolMode,
        setToolMode,
        penColor,
        setPenColor,
        brushToolSize,
        setBrushToolSize,
        penToolSize,
        setPenToolSize,
        canUndo,
        canRedo,
        undo: history.undo,
        redo: history.redo,
    };
};

export default useMaskImage;
