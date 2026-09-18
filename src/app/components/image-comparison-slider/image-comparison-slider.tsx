import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import React, { useState, useRef, useEffect, useCallback } from 'react';

import './image-comparison-slider.scss';

interface ImageComparisonSliderProps {
    originalSrc: string;
    editedSrc: string;
    alt: string;
    onLoad?: () => void;
    onError?: () => void;
}

const ImageComparisonSlider: React.FC<ImageComparisonSliderProps> = ({
    originalSrc,
    editedSrc,
    alt,
    onLoad,
    onError,
}) => {
    const [sliderPosition, setSliderPosition] = useState(50);
    const [isDragging, setIsDragging] = useState(false);
    // The images render with object-fit: contain, so the painted picture can be smaller than the
    // container. The wrapper is sized to the painted rect (natural ratio × container box) so the
    // slider line and the Original/Edited badges stay on the image instead of the letterbox bars.
    const [naturalRatio, setNaturalRatio] = useState<number | null>(null);
    const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    // Whether a drag is in flight is tracked in a ref, not in `isDragging`: the drag starts from a
    // native listener, so a press and release close together can both run before React commits the
    // state, leaving the move handler to read a stale `false` and the drag stuck on afterwards.
    // `isDragging` exists only to drive the pressed style.
    const isDraggingRef = useRef(false);

    const updatePositionFromClientX = useCallback((clientX: number) => {
        const el = wrapperRef.current ?? containerRef.current;

        if (!el) return;

        const rect = el.getBoundingClientRect();
        const x = clientX - rect.left;
        const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));

        setSliderPosition(percentage);
    }, []);

    const endDrag = useCallback((pointerId?: number) => {
        if (!isDraggingRef.current) return;

        isDraggingRef.current = false;

        const el = containerRef.current;

        // `releasePointerCapture` throws NotFoundError for a pointer it no longer holds, and a
        // pointerup releases capture implicitly before this runs.
        if (el && pointerId !== undefined && el.hasPointerCapture(pointerId)) {
            el.releasePointerCapture(pointerId);
        }

        setIsDragging(false);
    }, []);

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDraggingRef.current) return;

        updatePositionFromClientX(e.clientX);
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        endDrag(e.pointerId);
    };

    useEffect(() => {
        const el = containerRef.current;

        if (!el) return;

        // Drag starts here rather than in an onPointerDown prop: the lightbox reacts to native
        // pointerdown for its own gestures, so the event is stopped at this element — which would
        // also keep it from reaching the React root where React delegates its listeners.
        const startDrag = (e: PointerEvent) => {
            e.stopPropagation();

            // Only the primary button/contact drags: a right-click must still reach the context
            // menu, and a second touch point must not fight the finger already dragging.
            if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;

            e.preventDefault();
            // Capture retargets later pointer events to the container, so a drag that leaves the
            // image keeps tracking without document-level listeners.
            el.setPointerCapture(e.pointerId);
            isDraggingRef.current = true;
            setIsDragging(true);
            updatePositionFromClientX(e.clientX);
        };

        // Capture can be lost without a pointerup reaching us at all — the browser drops it if the
        // element is removed mid-drag. Without this the drag would never end.
        const handleLostCapture = () => endDrag();

        el.addEventListener('pointerdown', startDrag);
        el.addEventListener('lostpointercapture', handleLostCapture);

        return () => {
            el.removeEventListener('pointerdown', startDrag);
            el.removeEventListener('lostpointercapture', handleLostCapture);
        };
    }, [updatePositionFromClientX, endDrag]);

    useEffect(() => {
        const el = containerRef.current;

        if (!el) return;

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];

            if (!entry) return;

            setContainerSize({
                width: entry.contentRect.width,
                height: entry.contentRect.height,
            });
        });

        observer.observe(el);

        return () => observer.disconnect();
    }, []);

    // Sizing must not survive a navigation to a different item: keep the full-container fallback
    // until the new edited image reports its dimensions.
    useEffect(() => {
        setNaturalRatio(null);
    }, [originalSrc, editedSrc]);

    const handleImageLoad = () => {
        if (onLoad) {
            onLoad();
        }
    };

    // Only the edited image drives the wrapper size — measuring both would let whichever load
    // event lands last win when the two images disagree on aspect ratio.
    const handleEditedImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const { naturalWidth, naturalHeight } = e.currentTarget;

        if (naturalWidth > 0 && naturalHeight > 0) {
            setNaturalRatio(naturalWidth / naturalHeight);
        }

        handleImageLoad();
    };

    const handleImageError = () => {
        if (onError) {
            onError();
        }
    };

    const wrapperStyle: React.CSSProperties = {};

    if (naturalRatio && containerSize && containerSize.width > 0 && containerSize.height > 0) {
        const width = Math.min(containerSize.width, containerSize.height * naturalRatio);

        wrapperStyle.width = `${width}px`;
        wrapperStyle.height = `${width / naturalRatio}px`;
    }

    return (
        <div
            className="comparison-container flex items-center justify-center"
            ref={containerRef}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
        >
            <div className="comparison-wrapper" ref={wrapperRef} style={wrapperStyle}>
                <div className="original-image">
                    <img
                        src={originalSrc}
                        alt={`Original ${alt}`}
                        onLoad={handleImageLoad}
                        onError={handleImageError}
                    />
                    <div className="label-badge label-badge-left">
                        <span className="text-sm">Original</span>
                    </div>
                </div>
                <div
                    className="edited-image"
                    style={{ clipPath: `polygon(${sliderPosition}% 0%, 100% 0%, 100% 100%, ${sliderPosition}% 100%)` }}
                >
                    <img
                        src={editedSrc}
                        alt={`Edited ${alt}`}
                        onLoad={handleEditedImageLoad}
                        onError={handleImageError}
                    />
                    <div className="label-badge label-badge-right">
                        <span className="text-sm">Edited</span>
                    </div>
                </div>
                <div
                    className={`slider-line${isDragging ? ' slider-line-active' : ''}`}
                    style={{ left: `${sliderPosition}%` }}
                >
                    <div className="slider-handle flex items-center justify-center">
                        <ChevronLeftIcon className="size-4 text-white" />
                        <ChevronRightIcon className="size-4 text-white" />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImageComparisonSlider;
