import { useCallback, useEffect } from 'react';

import { computeMaskOutlinePaths } from '../../utils/mask-image-helpers';

import type { MaskImageRefs } from './use-mask-image-refs';

export interface UseMaskPreviewArgs {
    refs: MaskImageRefs;
    isMaskActive: boolean;
    maskHasStrokes: boolean;
    itemKey: string | undefined;
}

export interface UseMaskPreviewResult {
    getMaskOutlinePaths: () => Array<Array<{ x: number; y: number }>>;
    drawMaskPreviewFrame: (ts?: number) => void;
    startPreviewLoop: () => void;
    stopPreviewLoop: () => void;
}

export const useMaskPreview = (args: UseMaskPreviewArgs): UseMaskPreviewResult => {
    const { refs, isMaskActive, maskHasStrokes, itemKey } = args;

    const stopPreviewLoop = useCallback(() => {
        if (refs.previewRafRef.current) {
            cancelAnimationFrame(refs.previewRafRef.current);
            refs.previewRafRef.current = null;
        }
        refs.lastPreviewTsRef.current = null;
    }, [refs]);

    const getMaskOutlinePaths = useCallback(() => {
        if (!refs.outlineDirtyRef.current) return refs.outlinePathsRef.current;

        const maskCanvas = refs.maskCanvasRef.current;

        if (!maskCanvas || !maskHasStrokes) {
            refs.outlinePathsRef.current = [];
            refs.outlineDirtyRef.current = false;

            return refs.outlinePathsRef.current;
        }

        const rect = maskCanvas.getBoundingClientRect();
        const cssW = Math.max(2, Math.round(rect.width));
        const cssH = Math.max(2, Math.round(rect.height));

        const OUTLINE_SCALE = 0.5;
        const w = Math.max(2, Math.round(cssW * OUTLINE_SCALE));
        const h = Math.max(2, Math.round(cssH * OUTLINE_SCALE));

        if (!refs.outlineCanvasRef.current) {
            refs.outlineCanvasRef.current = document.createElement('canvas');
        }
        const c = refs.outlineCanvasRef.current;

        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d', { willReadFrequently: true });

        if (!ctx) {
            refs.outlinePathsRef.current = [];
            refs.outlineDirtyRef.current = false;

            return refs.outlinePathsRef.current;
        }

        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(maskCanvas, 0, 0, w, h);

        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;

        const paths = computeMaskOutlinePaths(data, w, h);

        const scaleInv = 1 / OUTLINE_SCALE;

        refs.outlinePathsRef.current = paths.map((p) => p.map((pt) => ({ x: pt.x * scaleInv, y: pt.y * scaleInv })));
        refs.outlineDirtyRef.current = false;

        return refs.outlinePathsRef.current;
    }, [maskHasStrokes, refs]);

    const drawMaskPreviewFrame = useCallback(
        (ts?: number) => {
            const canvas = refs.maskPreviewCanvasRef.current;
            const maskCanvas = refs.maskCanvasRef.current;

            if (!canvas || !maskCanvas || !isMaskActive) return;
            const isDrawing = refs.isDrawingRef.current;

            if (!maskHasStrokes && !isDrawing) return;
            const ctx = canvas.getContext('2d');

            if (!ctx) return;

            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.restore();

            ctx.save();
            ctx.globalAlpha = 0.22;
            ctx.drawImage(maskCanvas, 0, 0, canvas.width, canvas.height);
            ctx.restore();

            if (!isDrawing) {
                const paths = getMaskOutlinePaths();

                if (paths.length) {
                    ctx.save();
                    const effectiveScale = maskCanvas.width / maskCanvas.getBoundingClientRect().width;

                    ctx.scale(effectiveScale, effectiveScale);

                    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
                    const dashPattern = isMobile ? 4 : 6;
                    const lineWidth = isMobile ? 1.5 : 2;

                    ctx.lineCap = 'butt';
                    ctx.lineJoin = 'round';
                    ctx.setLineDash([dashPattern, dashPattern]);
                    ctx.lineDashOffset = -refs.dashOffsetRef.current;
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
                    ctx.lineWidth = lineWidth;

                    for (const path of paths) {
                        if (!path || path.length < 2) continue;
                        ctx.beginPath();
                        ctx.moveTo(path[0].x, path[0].y);
                        for (let i = 1; i < path.length - 2; i++) {
                            const cx = path[i].x;
                            const cy = path[i].y;
                            const nx = path[i + 1].x;
                            const ny = path[i + 1].y;
                            const mx = (cx + nx) / 2;
                            const my = (cy + ny) / 2;

                            ctx.quadraticCurveTo(cx, cy, mx, my);
                        }
                        ctx.lineTo(path[path.length - 1].x, path[path.length - 1].y);
                        ctx.stroke();
                    }
                    ctx.restore();
                }

                const now = typeof ts === 'number' ? ts : performance.now();
                const last = refs.lastPreviewTsRef.current;

                if (typeof last === 'number') {
                    const dtMs = Math.min(64, Math.max(0, now - last));
                    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
                    const speedPxPerSec = isMobile ? 15 : 21;

                    refs.dashOffsetRef.current += (dtMs / 1000) * speedPxPerSec;
                }
                refs.lastPreviewTsRef.current = now;
                refs.previewRafRef.current = requestAnimationFrame(drawMaskPreviewFrame);
            } else {
                stopPreviewLoop();
            }
        },
        [getMaskOutlinePaths, isMaskActive, maskHasStrokes, refs, stopPreviewLoop],
    );

    const startPreviewLoop = useCallback(() => {
        if (refs.previewRafRef.current) return;

        refs.previewRafRef.current = requestAnimationFrame(drawMaskPreviewFrame);
    }, [drawMaskPreviewFrame, refs]);

    useEffect(() => {
        if (!isMaskActive || !maskHasStrokes) {
            stopPreviewLoop();

            return;
        }

        startPreviewLoop();

        return () => {
            stopPreviewLoop();
        };
    }, [drawMaskPreviewFrame, isMaskActive, maskHasStrokes, startPreviewLoop, stopPreviewLoop, itemKey]);

    return {
        getMaskOutlinePaths,
        drawMaskPreviewFrame,
        startPreviewLoop,
        stopPreviewLoop,
    };
};
