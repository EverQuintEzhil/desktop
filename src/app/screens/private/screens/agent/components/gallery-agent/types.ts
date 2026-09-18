import type React from 'react';

import type { GeneratedItem } from '@/types/gallery';

export type ToolMode = 'brush' | 'pen';
export type PenSize = 'sm' | 'md' | 'lg';

export type CanvasSnapshot = {
    mask: ImageData;
    pen: ImageData;
};

export interface UseMaskImageArgs {
    isOpen: boolean;
    showRemixInput: boolean;
    maskSupported: boolean;
    currentItem: GeneratedItem;
    brushSize?: number;
}

export interface UseMaskImageResult {
    brushSize: number;
    maskHasStrokes: boolean;

    maskCanvasRef: React.RefObject<HTMLCanvasElement | null>;
    maskPreviewCanvasRef: React.RefObject<HTMLCanvasElement | null>;
    penCanvasRef: React.RefObject<HTMLCanvasElement | null>;
    maskCursorRef: React.RefObject<SVGSVGElement | null>;
    setMaskTargetEl: (el: HTMLDivElement | null) => void;

    activeCursorSize: number;

    onMaskPointerDown: (event: React.PointerEvent) => void;
    onMaskPointerMove: (event: React.PointerEvent) => void;
    onMaskPointerUp: (event: React.PointerEvent) => void;
    onMaskPointerLeave: () => void;

    clearMask: () => void;
    resizeMaskCanvasToTarget: () => void;
    exportMaskDataUrl: () => Promise<string | undefined>;
    exportPenCompositeBlob: () => Promise<Blob | null>;

    toolMode: ToolMode;
    setToolMode: (mode: ToolMode) => void;
    penColor: string;
    setPenColor: (color: string) => void;
    brushToolSize: PenSize;
    setBrushToolSize: (size: PenSize) => void;
    penToolSize: PenSize;
    setPenToolSize: (size: PenSize) => void;
    canUndo: boolean;
    canRedo: boolean;
    undo: () => void;
    redo: () => void;
}
