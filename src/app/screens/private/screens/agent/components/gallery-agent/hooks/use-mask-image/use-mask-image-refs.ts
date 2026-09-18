import type React from 'react';
import { useMemo, useRef } from 'react';

import type { CanvasSnapshot, PenSize, ToolMode } from '../../types';

export interface MaskImageRefs {
    maskCanvasRef: React.RefObject<HTMLCanvasElement | null>;
    maskPreviewCanvasRef: React.RefObject<HTMLCanvasElement | null>;
    penCanvasRef: React.RefObject<HTMLCanvasElement | null>;
    maskCursorRef: React.RefObject<SVGSVGElement | null>;
    maskTargetRef: React.RefObject<HTMLDivElement | null>;

    isDrawingRef: React.RefObject<boolean>;
    lastPointRef: React.RefObject<{ x: number; y: number } | null>;

    previewRafRef: React.RefObject<number | null>;
    dashOffsetRef: React.RefObject<number>;
    lastPreviewTsRef: React.RefObject<number | null>;

    outlineCanvasRef: React.RefObject<HTMLCanvasElement | null>;
    outlinePathsRef: React.RefObject<Array<Array<{ x: number; y: number }>>>;
    outlineDirtyRef: React.RefObject<boolean>;
    maskHasStrokesRef: React.RefObject<boolean>;

    cursorRafRef: React.RefObject<number | null>;

    toolModeRef: React.RefObject<ToolMode>;
    penColorRef: React.RefObject<string>;
    brushToolSizeRef: React.RefObject<PenSize>;
    penToolSizeRef: React.RefObject<PenSize>;

    undoStackRef: React.RefObject<CanvasSnapshot[]>;
    redoStackRef: React.RefObject<CanvasSnapshot[]>;
    preStrokeSnapshotRef: React.RefObject<CanvasSnapshot | null>;
}

/**
 * All mutable canvas/interaction refs shared across the mask-image sub-hooks. Returned as a
 * single memoized bag so its identity stays stable across renders — every value inside is a
 * useRef object, which is already stable, so the container just needs to not be re-created.
 */
export const useMaskImageRefs = (): MaskImageRefs => {
    const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const maskPreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const penCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const maskCursorRef = useRef<SVGSVGElement | null>(null);
    const maskTargetRef = useRef<HTMLDivElement | null>(null);

    const isDrawingRef = useRef(false);
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);

    const previewRafRef = useRef<number | null>(null);
    const dashOffsetRef = useRef(0);
    const lastPreviewTsRef = useRef<number | null>(null);

    const outlineCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const outlinePathsRef = useRef<Array<Array<{ x: number; y: number }>>>([]);
    const outlineDirtyRef = useRef(true);
    const maskHasStrokesRef = useRef(false);

    const cursorRafRef = useRef<number | null>(null);

    const toolModeRef = useRef<ToolMode>('brush');
    const penColorRef = useRef('#ff0000');
    const brushToolSizeRef = useRef<PenSize>('md');
    const penToolSizeRef = useRef<PenSize>('sm');

    const undoStackRef = useRef<CanvasSnapshot[]>([]);
    const redoStackRef = useRef<CanvasSnapshot[]>([]);
    const preStrokeSnapshotRef = useRef<CanvasSnapshot | null>(null);

    return useMemo(
        () => ({
            maskCanvasRef,
            maskPreviewCanvasRef,
            penCanvasRef,
            maskCursorRef,
            maskTargetRef,
            isDrawingRef,
            lastPointRef,
            previewRafRef,
            dashOffsetRef,
            lastPreviewTsRef,
            outlineCanvasRef,
            outlinePathsRef,
            outlineDirtyRef,
            maskHasStrokesRef,
            cursorRafRef,
            toolModeRef,
            penColorRef,
            brushToolSizeRef,
            penToolSizeRef,
            undoStackRef,
            redoStackRef,
            preStrokeSnapshotRef,
        }),
        [],
    );
};
