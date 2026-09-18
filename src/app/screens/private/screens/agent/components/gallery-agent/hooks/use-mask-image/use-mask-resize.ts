import { useCallback, useEffect, useState } from 'react';

import { BRUSH_SIZE_RATIO } from '../../constants';

import type { MaskImageRefs } from './use-mask-image-refs';

export interface UseMaskResizeArgs {
    refs: MaskImageRefs;
    isOpen: boolean;
    showRemixInput: boolean;
    maskSupported: boolean;
    isMaskActive: boolean;
    setMaskHasStrokes: (value: boolean) => void;
    hideMaskCursor: () => void;
}

export interface UseMaskResizeResult {
    canvasDisplayWidth: number;
    resizeMaskCanvasToTarget: () => void;
}

export const useMaskResize = (args: UseMaskResizeArgs): UseMaskResizeResult => {
    const { refs, isOpen, showRemixInput, maskSupported, isMaskActive, setMaskHasStrokes, hideMaskCursor } = args;

    const [canvasDisplayWidth, setCanvasDisplayWidth] = useState(400);

    const resizeMaskCanvasToTarget = useCallback(() => {
        const canvas = refs.maskCanvasRef.current;
        const previewCanvas = refs.maskPreviewCanvasRef.current;
        const penCanvas = refs.penCanvasRef.current;
        const target = refs.maskTargetRef.current;

        if (!canvas || !target) return;

        // Size canvases to the visible rendered content of the image.
        // The img element can be larger than its content due to object-fit: contain + height: 100%.
        const imgEl = target.querySelector<HTMLImageElement>('img');
        const containerRect = target.getBoundingClientRect();

        let width: number;
        let height: number;
        let offsetLeft: number;
        let offsetTop: number;

        if (imgEl) {
            const elemRect = imgEl.getBoundingClientRect();
            const elemW = elemRect.width;
            const elemH = elemRect.height;
            const nw = imgEl.naturalWidth;
            const nh = imgEl.naturalHeight;

            let renderedW: number;
            let renderedH: number;

            if (nw > 0 && nh > 0) {
                const naturalRatio = nw / nh;
                const elemRatio = elemW / elemH;

                if (naturalRatio > elemRatio) {
                    renderedW = elemW;
                    renderedH = elemW / naturalRatio;
                } else {
                    renderedH = elemH;
                    renderedW = elemH * naturalRatio;
                }
            } else {
                renderedW = elemW;
                renderedH = elemH;
            }

            width = Math.max(1, Math.round(renderedW));
            height = Math.max(1, Math.round(renderedH));
            offsetLeft = Math.round(elemRect.left - containerRect.left + (elemW - renderedW) / 2);
            offsetTop = Math.round(elemRect.top - containerRect.top + (elemH - renderedH) / 2);
        } else {
            width = Math.max(1, Math.round(containerRect.width));
            height = Math.max(1, Math.round(containerRect.height));
            offsetLeft = 0;
            offsetTop = 0;
        }

        const dpr = window.devicePixelRatio || 1;
        const newPixelW = Math.round(width * dpr);
        const newPixelH = Math.round(height * dpr);

        const oldPixelW = canvas.width;
        const oldPixelH = canvas.height;
        let savedMaskImage: HTMLCanvasElement | null = null;
        let savedPenImage: HTMLCanvasElement | null = null;

        if (refs.maskHasStrokesRef.current && oldPixelW > 0 && oldPixelH > 0) {
            savedMaskImage = document.createElement('canvas');
            savedMaskImage.width = oldPixelW;
            savedMaskImage.height = oldPixelH;
            const sctx = savedMaskImage.getContext('2d');

            if (sctx) sctx.drawImage(canvas, 0, 0);

            if (penCanvas && penCanvas.width > 0 && penCanvas.height > 0) {
                savedPenImage = document.createElement('canvas');
                savedPenImage.width = penCanvas.width;
                savedPenImage.height = penCanvas.height;
                const pctx = savedPenImage.getContext('2d');

                if (pctx) pctx.drawImage(penCanvas, 0, 0);
            }
        }

        const positionCanvas = (c: HTMLCanvasElement, pw: number, ph: number) => {
            c.style.left = `${offsetLeft}px`;
            c.style.top = `${offsetTop}px`;
            c.style.right = 'auto';
            c.style.bottom = 'auto';
            c.style.width = `${width}px`;
            c.style.height = `${height}px`;
            c.width = pw;
            c.height = ph;
        };

        positionCanvas(canvas, newPixelW, newPixelH);

        if (previewCanvas) {
            positionCanvas(previewCanvas, newPixelW, newPixelH);
            const pctx = previewCanvas.getContext('2d');

            if (pctx) {
                pctx.setTransform(1, 0, 0, 1, 0, 0);
                pctx.lineCap = 'round';
                pctx.lineJoin = 'round';
            }
        }

        if (penCanvas) {
            positionCanvas(penCanvas, newPixelW, newPixelH);
        }

        const ctx = canvas.getContext('2d');

        if (!ctx) return;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#ffffff';

        const effectiveScale = canvas.width / width;

        ctx.lineWidth = Math.round(width * BRUSH_SIZE_RATIO.md) * effectiveScale;
        setCanvasDisplayWidth(width);

        if (savedMaskImage) {
            ctx.drawImage(savedMaskImage, 0, 0, oldPixelW, oldPixelH, 0, 0, newPixelW, newPixelH);
            refs.outlineDirtyRef.current = true;
        }

        if (savedPenImage && penCanvas) {
            const penCtx = penCanvas.getContext('2d');

            if (penCtx) {
                penCtx.drawImage(
                    savedPenImage,
                    0,
                    0,
                    savedPenImage.width,
                    savedPenImage.height,
                    0,
                    0,
                    newPixelW,
                    newPixelH,
                );
            }
        }
    }, [refs]);

    useEffect(() => {
        if (!isOpen) return;
        if (!showRemixInput) {
            setMaskHasStrokes(false);
            hideMaskCursor();

            return;
        }
        if (!maskSupported) return;

        const target = refs.maskTargetRef.current;

        if (!target) return;

        resizeMaskCanvasToTarget();

        const observer = new ResizeObserver(() => {
            resizeMaskCanvasToTarget();
        });

        observer.observe(target);

        const imgEl = target.querySelector<HTMLImageElement>('img');

        // Re-measure after CSS transitions complete (e.g. scale: 0.9 applied on remix open)
        imgEl?.addEventListener('transitionend', resizeMaskCanvasToTarget);

        if (imgEl && !imgEl.complete) {
            imgEl.addEventListener('load', resizeMaskCanvasToTarget);
        }

        return () => {
            observer.disconnect();
            imgEl?.removeEventListener('transitionend', resizeMaskCanvasToTarget);
            imgEl?.removeEventListener('load', resizeMaskCanvasToTarget);
        };
    }, [hideMaskCursor, isOpen, maskSupported, refs, resizeMaskCanvasToTarget, setMaskHasStrokes, showRemixInput]);

    useEffect(() => {
        if (!isMaskActive) return;
        resizeMaskCanvasToTarget();
    }, [isMaskActive, resizeMaskCanvasToTarget]);

    return { canvasDisplayWidth, resizeMaskCanvasToTarget };
};
