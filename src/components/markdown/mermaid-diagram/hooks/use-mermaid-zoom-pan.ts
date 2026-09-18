import type { RefObject } from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { DEFAULT_ZOOM, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from '../constants';
import type { MermaidViewMode } from '../types';

interface UseMermaidZoomPanResult {
    zoom: number;
    fitZoom: number;
    isFullscreen: boolean;
    isPanning: boolean;
    isPannable: boolean;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onResetZoom: () => void;
    onToggleFullscreen: () => void;
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
    onPointerEnd: (event: React.PointerEvent<HTMLDivElement>) => void;
}

export const useMermaidZoomPan = (
    svg: string,
    naturalDims: { width: number; height: number } | null,
    viewMode: MermaidViewMode,
    scrollAreaRef: RefObject<HTMLDivElement | null>,
    hasInitializedZoomRef: RefObject<boolean>,
): UseMermaidZoomPanResult => {
    const [zoom, setZoom] = useState(DEFAULT_ZOOM);
    const [fitZoom, setFitZoom] = useState(DEFAULT_ZOOM);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isPanning, setIsPanning] = useState(false);
    const [isPannable, setIsPannable] = useState(false);
    // Holds the latest fitZoom without adding it as an effect dependency
    const fitZoomRef = useRef(DEFAULT_ZOOM);
    const panStateRef = useRef<{
        startX: number;
        startY: number;
        startScrollLeft: number;
        startScrollTop: number;
    } | null>(null);
    // Pinch-to-zoom: track active pointers and pinch start state
    const activePointersRef = useRef(new Map<number, { clientX: number; clientY: number }>());
    const pinchStartRef = useRef<{ distance: number; zoom: number } | null>(null);
    // Wheel zoom: track last wheel timestamp to skip duplicate events
    const wheelLastRef = useRef(0);

    useEffect(() => {
        if (!isFullscreen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsFullscreen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isFullscreen]);

    useEffect(() => {
        fitZoomRef.current = fitZoom;
    }, [fitZoom]);

    useEffect(() => {
        if (!isFullscreen) return;

        const previousOverflow = document.body.style.overflow;

        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previousOverflow;
            setZoom(fitZoomRef.current);
        };
    }, [isFullscreen]);

    const onZoomIn = useCallback(
        () => setZoom((current) => Math.min(Number((current + ZOOM_STEP).toFixed(2)), ZOOM_MAX)),
        [],
    );
    const onZoomOut = useCallback(
        () => setZoom((current) => Math.max(Number((current - ZOOM_STEP).toFixed(2)), ZOOM_MIN)),
        [],
    );
    const onResetZoom = useCallback(() => {
        setZoom(fitZoom);
        const scrollArea = scrollAreaRef.current;

        if (scrollArea) {
            scrollArea.scrollLeft = 0;
            scrollArea.scrollTop = 0;
        }
    }, [fitZoom]);
    const onToggleFullscreen = () => setIsFullscreen((current) => !current);

    useLayoutEffect(() => {
        const scrollArea = scrollAreaRef.current;

        if (!svg || !naturalDims || !scrollArea || viewMode !== 'preview') {
            setIsPannable(false);

            return undefined;
        }

        const evaluate = () => {
            const styles = window.getComputedStyle(scrollArea);
            const paddingX = (parseFloat(styles.paddingLeft) || 0) + (parseFloat(styles.paddingRight) || 0);
            const paddingY = (parseFloat(styles.paddingTop) || 0) + (parseFloat(styles.paddingBottom) || 0);
            const viewportWidth = Math.max(scrollArea.clientWidth - paddingX, 1);
            const viewportHeight = Math.max(scrollArea.clientHeight - paddingY, 1);

            const maxHeightPx = parseFloat(styles.maxHeight);
            const fitHeightLimit = Math.max(
                Number.isFinite(maxHeightPx) && maxHeightPx > 0 ? maxHeightPx : viewportHeight,
                1,
            );

            const ratioX = viewportWidth / naturalDims.width;
            const ratioY = fitHeightLimit / naturalDims.height;
            const ratio = Math.min(ratioX, ratioY);
            const nextFit = ratio < 1 ? Math.max(ratio, ZOOM_MIN) : DEFAULT_ZOOM;

            fitZoomRef.current = nextFit;
            setFitZoom(nextFit);

            if (!hasInitializedZoomRef.current) {
                hasInitializedZoomRef.current = true;
                setZoom(nextFit);
            }

            const currentZoom = hasInitializedZoomRef.current ? zoom : nextFit;

            setIsPannable(
                naturalDims.width * currentZoom > viewportWidth + 1 ||
                    naturalDims.height * currentZoom > viewportHeight + 1,
            );
        };

        evaluate();

        const observer = new ResizeObserver(evaluate);

        observer.observe(scrollArea);

        return () => observer.disconnect();
    }, [svg, naturalDims, viewMode, isFullscreen, zoom]);

    const endPointerInteraction = useCallback((pointerId?: number) => {
        const scrollArea = scrollAreaRef.current;

        if (typeof pointerId === 'number') {
            activePointersRef.current.delete(pointerId);

            try {
                if (scrollArea?.hasPointerCapture(pointerId)) {
                    scrollArea.releasePointerCapture(pointerId);
                }
            } catch {
                console.error('Error releasing pointer capture', pointerId);
            }
        } else {
            activePointersRef.current.forEach((_value, activePointerId) => {
                try {
                    if (scrollArea?.hasPointerCapture(activePointerId)) {
                        scrollArea.releasePointerCapture(activePointerId);
                    }
                } catch {
                    console.error('Error releasing pointer capture', activePointerId);
                }
            });
            activePointersRef.current.clear();
        }

        if (activePointersRef.current.size < 2) {
            pinchStartRef.current = null;
        }

        if (activePointersRef.current.size === 0 && panStateRef.current) {
            panStateRef.current = null;
            setIsPanning(false);
        }
    }, []);

    const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        const scrollArea = scrollAreaRef.current;

        if (!scrollArea) return;
        if (event.pointerType === 'mouse' && event.button !== 0) return;

        const target = event.target as HTMLElement | null;

        if (target?.closest('.mermaid-toolbar')) return;

        activePointersRef.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });

        if (activePointersRef.current.size === 2) {
            // Two fingers down — start pinch, cancel any in-progress pan
            panStateRef.current = null;
            setIsPanning(false);

            const points = [...activePointersRef.current.values()];
            const dx = points[1].clientX - points[0].clientX;
            const dy = points[1].clientY - points[0].clientY;

            // Store current distance and zoom so each move is incremental from this baseline.
            pinchStartRef.current = { distance: Math.hypot(dx, dy), zoom };
        } else if (activePointersRef.current.size === 1 && isPannable) {
            panStateRef.current = {
                startX: event.clientX,
                startY: event.clientY,
                startScrollLeft: scrollArea.scrollLeft,
                startScrollTop: scrollArea.scrollTop,
            };
            setIsPanning(true);

            try {
                scrollArea.setPointerCapture(event.pointerId);
            } catch {
                // setPointerCapture may throw if pointer is not active; safe to ignore
            }
        }
    };

    const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        const scrollArea = scrollAreaRef.current;

        if (!scrollArea) return;

        if (event.pointerType === 'mouse' && activePointersRef.current.has(event.pointerId) && event.buttons === 0) {
            endPointerInteraction(event.pointerId);

            return;
        }

        if (activePointersRef.current.has(event.pointerId)) {
            activePointersRef.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
        }

        const pinchStart = pinchStartRef.current;

        if (pinchStart && activePointersRef.current.size >= 2) {
            const points = [...activePointersRef.current.values()];
            const dx = points[1].clientX - points[0].clientX;
            const dy = points[1].clientY - points[0].clientY;
            const currentDistance = Math.hypot(dx, dy);

            // Dampen: apply a fraction (0.6) of the raw distance ratio so small
            // finger movements don't cause large zoom jumps.
            const rawScale = currentDistance / pinchStart.distance;
            const dampedScale = 1 + (rawScale - 1) * 0.6;
            const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, pinchStart.zoom * dampedScale));

            setZoom(newZoom);

            // Re-anchor baseline to current position so next frame's delta is small.
            pinchStartRef.current = { distance: currentDistance, zoom: newZoom };

            return;
        }

        const state = panStateRef.current;

        if (!state) return;

        scrollArea.scrollLeft = state.startScrollLeft - (event.clientX - state.startX);
        scrollArea.scrollTop = state.startScrollTop - (event.clientY - state.startY);
    };

    const onPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => endPointerInteraction(event.pointerId);

    useEffect(() => {
        const handlePointerEnd = (event: PointerEvent) => endPointerInteraction(event.pointerId);
        const handleWindowBlur = () => endPointerInteraction();

        document.addEventListener('pointerup', handlePointerEnd);
        document.addEventListener('pointercancel', handlePointerEnd);
        window.addEventListener('blur', handleWindowBlur);

        return () => {
            document.removeEventListener('pointerup', handlePointerEnd);
            document.removeEventListener('pointercancel', handlePointerEnd);
            window.removeEventListener('blur', handleWindowBlur);
        };
    }, [endPointerInteraction]);

    useEffect(() => {
        const scrollArea = scrollAreaRef.current;

        if (!scrollArea) return undefined;

        const handleWheel = (event: WheelEvent) => {
            if (!event.ctrlKey && !event.metaKey) return;
            event.preventDefault();

            const now = performance.now();

            if (now - wheelLastRef.current < 16) return;
            wheelLastRef.current = now;

            const delta = Math.max(-50, Math.min(50, event.deltaY));
            const factor = Math.exp(-delta * 0.006);

            setZoom((current) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, current * factor)));
        };

        scrollArea.addEventListener('wheel', handleWheel, { passive: false });

        return () => scrollArea.removeEventListener('wheel', handleWheel);
    }, [viewMode]);

    return {
        zoom,
        fitZoom,
        isFullscreen,
        isPanning,
        isPannable,
        onZoomIn,
        onZoomOut,
        onResetZoom,
        onToggleFullscreen,
        onPointerDown,
        onPointerMove,
        onPointerEnd,
    };
};
