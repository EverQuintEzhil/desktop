import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { calculateDisplaySize, calculateFitZoomLevel, clampZoom, ZOOM_SENSITIVITY } from '../utils/zoom-utils';

interface UseZoomParams {
    imageDimensions: { width: number; height: number };
    containerSize: { width: number; height: number };
    zoomLevel: number;
    onZoomChange: (level: number) => void;
    onFitZoomComputed: (level: number) => void;
    scrollAreaRef: React.RefObject<HTMLDivElement | null>;
    contentPadding: number;
}

interface UseZoomReturn {
    displaySize: { width: number; height: number };
    handleWheel: (e: WheelEvent) => void;
}

export const useZoomScroll = (params: UseZoomParams): UseZoomReturn => {
    const {
        imageDimensions,
        containerSize,
        zoomLevel,
        onZoomChange,
        onFitZoomComputed,
        scrollAreaRef,
        contentPadding = 0,
    } = params;

    const [fitZoomLevel, setFitZoomLevel] = useState<number>(100);

    const pendingZoomRef = useRef<number | null>(null);
    const pendingWheelRef = useRef<{ event: WheelEvent; nextZoom: number; prevZoom: number } | null>(null);
    const rafIdRef = useRef<number | null>(null);

    const pendingZoomAnchorRef = useRef<{
        cursorXInViewport: number;
        cursorYInViewport: number;
        srcX: number;
        srcY: number;
        targetZoom: number;
    } | null>(null);

    useLayoutEffect(() => {
        const paddedContainerSize = {
            width: Math.max(1, containerSize.width - contentPadding * 2),
            height: Math.max(1, containerSize.height - contentPadding * 2),
        };

        const fitLevelRaw = calculateFitZoomLevel(imageDimensions, paddedContainerSize);
        const fitLevel = Math.round(fitLevelRaw * 100) / 100;

        setFitZoomLevel((prev) => (Math.abs(prev - fitLevel) < 0.01 ? prev : fitLevel));
    }, [imageDimensions.width, imageDimensions.height, containerSize.width, containerSize.height, contentPadding]);

    useEffect(() => {
        onFitZoomComputed(fitZoomLevel);
    }, [fitZoomLevel, onFitZoomComputed]);

    useLayoutEffect(() => {
        if (zoomLevel === 100 && Math.abs(fitZoomLevel - 100) > 0.01) {
            onZoomChange(fitZoomLevel);
        }
    }, [fitZoomLevel, zoomLevel, onZoomChange]);

    const handleWheel = useCallback(
        (e: WheelEvent) => {
            if (!e.metaKey) return;

            e.preventDefault();

            const delta = -e.deltaY * ZOOM_SENSITIVITY;
            const zoomFactor = Math.exp(delta);
            let newZoom = zoomLevel * zoomFactor;

            newZoom = clampZoom(newZoom);

            pendingZoomRef.current = newZoom;
            pendingWheelRef.current = { event: e, nextZoom: newZoom, prevZoom: zoomLevel };

            if (rafIdRef.current !== null) return;

            rafIdRef.current = requestAnimationFrame(() => {
                rafIdRef.current = null;
                const pending = pendingZoomRef.current;

                const pendingWheel = pendingWheelRef.current;

                if (pending == null) return;

                pendingZoomRef.current = null;
                pendingWheelRef.current = null;

                const scrollArea = scrollAreaRef?.current;

                if (scrollArea && pendingWheel) {
                    const { event, prevZoom, nextZoom } = pendingWheel;
                    // prevent zooming to 0
                    const prevZoomFactor = Math.max(1e-6, prevZoom / 100);

                    const prevContentWidth = imageDimensions.width * prevZoomFactor + contentPadding * 2;
                    const prevContentHeight = imageDimensions.height * prevZoomFactor + contentPadding * 2;
                    const prevOffsetX = Math.max(0, (containerSize.width - prevContentWidth) / 2);
                    const prevOffsetY = Math.max(0, (containerSize.height - prevContentHeight) / 2);

                    const rect = scrollArea.getBoundingClientRect();
                    const cursorXInViewport = event.clientX - rect.left;
                    const cursorYInViewport = event.clientY - rect.top;

                    const cursorXInContent = cursorXInViewport + scrollArea.scrollLeft - prevOffsetX;
                    const cursorYInContent = cursorYInViewport + scrollArea.scrollTop - prevOffsetY;

                    const cursorXInImage = Math.min(
                        Math.max(0, cursorXInContent - contentPadding),
                        Math.max(0, imageDimensions.width * prevZoomFactor),
                    );
                    const cursorYInImage = Math.min(
                        Math.max(0, cursorYInContent - contentPadding),
                        Math.max(0, imageDimensions.height * prevZoomFactor),
                    );

                    pendingZoomAnchorRef.current = {
                        cursorXInViewport,
                        cursorYInViewport,
                        srcX: cursorXInImage / prevZoomFactor,
                        srcY: cursorYInImage / prevZoomFactor,
                        targetZoom: nextZoom,
                    };
                }

                onZoomChange(pending);
            });
        },
        [
            containerSize.height,
            containerSize.width,
            contentPadding,
            imageDimensions.height,
            imageDimensions.width,
            onZoomChange,
            scrollAreaRef,
            zoomLevel,
        ],
    );

    useEffect(() => {
        return () => {
            if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
            }
        };
    }, []);

    const displaySize = useMemo(() => {
        return calculateDisplaySize(imageDimensions, zoomLevel);
    }, [imageDimensions, zoomLevel]);

    // keep the same point under cursor when zooming
    useLayoutEffect(() => {
        const scrollArea = scrollAreaRef?.current;
        const pending = pendingZoomAnchorRef.current;

        if (!scrollArea || !pending) return;
        if (Math.abs(pending.targetZoom - zoomLevel) > 0.01) return;

        const viewportWidthCss = Math.max(1, containerSize.width);
        const viewportHeightCss = Math.max(1, containerSize.height);
        const contentW = displaySize.width + contentPadding * 2;
        const contentH = displaySize.height + contentPadding * 2;

        const nextOffsetX = Math.max(0, (viewportWidthCss - contentW) / 2);
        const nextOffsetY = Math.max(0, (viewportHeightCss - contentH) / 2);

        const nextZoomFactor = zoomLevel / 100;
        const newScrollLeft = nextOffsetX + contentPadding + pending.srcX * nextZoomFactor - pending.cursorXInViewport;

        const newScrollTop = nextOffsetY + contentPadding + pending.srcY * nextZoomFactor - pending.cursorYInViewport;

        pendingZoomAnchorRef.current = null;
        scrollArea.scrollLeft = Math.max(0, newScrollLeft);
        scrollArea.scrollTop = Math.max(0, newScrollTop);
    }, [containerSize.height, containerSize.width, contentPadding, displaySize.height, displaySize.width, zoomLevel]);

    return {
        displaySize,
        handleWheel,
    };
};
