import { useLayoutEffect } from 'react';

interface UseCanvasRendererParams {
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    offscreenCanvasRef: React.RefObject<HTMLCanvasElement | null>;
    scrollPosRef: React.RefObject<{ left: number; top: number }>;
    scrollAreaRef: React.RefObject<HTMLDivElement | null>;
    containerSize: { width: number; height: number };
    canvasDisplaySize: { width: number; height: number };
    zoomLevel: number;
    contentPadding: number;
    renderVersion: number;
    scrollVersion: number;
}

export const useCanvasRenderer = (params: UseCanvasRendererParams) => {
    const {
        canvasRef,
        offscreenCanvasRef,
        scrollPosRef,
        scrollAreaRef,
        containerSize,
        canvasDisplaySize,
        zoomLevel,
        contentPadding,
        renderVersion,
        scrollVersion,
    } = params;

    const devicePixelRatio = typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1;

    useLayoutEffect(() => {
        const canvas = canvasRef.current;
        const offscreenCanvas = offscreenCanvasRef.current;

        if (!canvas || !offscreenCanvas) return;

        const scrollArea = scrollAreaRef.current;

        if (scrollArea) {
            scrollPosRef.current = { left: scrollArea.scrollLeft, top: scrollArea.scrollTop };
        }

        const viewportWidthCss = Math.max(1, containerSize.width);
        const viewportHeightCss = Math.max(1, containerSize.height);

        if (!viewportWidthCss || !viewportHeightCss) return;

        const backingWidth = Math.max(1, Math.round(viewportWidthCss * devicePixelRatio));
        const backingHeight = Math.max(1, Math.round(viewportHeightCss * devicePixelRatio));

        if (canvas.width !== backingWidth) canvas.width = backingWidth;
        if (canvas.height !== backingHeight) canvas.height = backingHeight;

        const ctx = canvas.getContext('2d');

        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const scrollLeft = scrollPosRef.current.left;
        const scrollTop = scrollPosRef.current.top;

        const contentW = canvasDisplaySize.width + contentPadding * 2;
        const contentH = canvasDisplaySize.height + contentPadding * 2;
        const scrollAreaWidth = scrollArea ? scrollArea.clientWidth : viewportWidthCss;
        const scrollAreaHeight = scrollArea ? scrollArea.clientHeight : viewportHeightCss;

        const contentOffsetX = Math.max(0, (scrollAreaWidth - contentW) / 2);
        const contentOffsetY = Math.max(0, (scrollAreaHeight - contentH) / 2);

        const viewportLeft = scrollLeft - contentOffsetX;
        const viewportTop = scrollTop - contentOffsetY;
        const viewportRight = viewportLeft + viewportWidthCss;
        const viewportBottom = viewportTop + viewportHeightCss;

        const imageLeft = contentPadding;
        const imageTop = contentPadding;
        const imageRight = contentPadding + canvasDisplaySize.width;
        const imageBottom = contentPadding + canvasDisplaySize.height;

        const intersectLeft = Math.max(viewportLeft, imageLeft);
        const intersectTop = Math.max(viewportTop, imageTop);
        const intersectRight = Math.min(viewportRight, imageRight);
        const intersectBottom = Math.min(viewportBottom, imageBottom);

        const intersectWidth = Math.max(0, intersectRight - intersectLeft);
        const intersectHeight = Math.max(0, intersectBottom - intersectTop);

        if (intersectWidth <= 0 || intersectHeight <= 0) return;

        const zoom = Math.max(1e-6, zoomLevel / 100);

        const withinImageX = intersectLeft - contentPadding;
        const withinImageY = intersectTop - contentPadding;

        const srcX = withinImageX / zoom;
        const srcY = withinImageY / zoom;
        const srcW = intersectWidth / zoom;
        const srcH = intersectHeight / zoom;

        const destX = (intersectLeft - viewportLeft) * devicePixelRatio;
        const destY = (intersectTop - viewportTop) * devicePixelRatio;
        const destW = intersectWidth * devicePixelRatio;
        const destH = intersectHeight * devicePixelRatio;

        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(offscreenCanvas, srcX, srcY, srcW, srcH, destX, destY, destW, destH);
    }, [
        canvasRef,
        offscreenCanvasRef,
        scrollPosRef,
        scrollAreaRef,
        renderVersion,
        scrollVersion,
        canvasDisplaySize.width,
        canvasDisplaySize.height,
        devicePixelRatio,
        containerSize.width,
        containerSize.height,
        zoomLevel,
        contentPadding,
    ]);
};
