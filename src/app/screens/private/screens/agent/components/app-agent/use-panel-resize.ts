import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

import { writeStored } from './panel-storage';

export const MIN_PANEL_WIDTH = 340;
export const MAX_PANEL_WIDTH = 640;

export const clampPanelWidth = (width: number): number =>
    Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, Math.round(width)));

interface Options {
    widthKey: string;
    assistantSide: 'left' | 'right';
    setPanelWidth: (width: number) => void;
}

/** Pointer drag on the docked panel's grip; the width is stored only once the pointer has moved. */
export const usePanelResize = ({ widthKey, assistantSide, setPanelWidth }: Options) => {
    const [isResizing, setIsResizing] = useState(false);
    const stopResizeRef = useRef<(() => void) | null>(null);

    // A drag that outlives the component would otherwise keep its window listeners and leave the
    // panel in its pointer-events-none resizing state.
    useEffect(() => () => stopResizeRef.current?.(), []);

    const handleResizeStart = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            event.preventDefault();
            setIsResizing(true);

            // Width measured from the pointer to the panel's docked edge.
            const widthAt = (x: number) => (assistantSide === 'left' ? x : window.innerWidth - x);

            let moved = false;

            const onMove = (move: globalThis.PointerEvent) => {
                moved = true;
                setPanelWidth(clampPanelWidth(widthAt(move.clientX)));
            };

            const stop = () => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
                window.removeEventListener('pointercancel', stop);
                stopResizeRef.current = null;
                setIsResizing(false);
            };

            const onUp = (up: globalThis.PointerEvent) => {
                stop();

                // A click on the grip is not a resize; storing it would overwrite the preference
                // with wherever the held-back edge happened to sit.
                if (moved) writeStored(widthKey, String(clampPanelWidth(widthAt(up.clientX))));
            };

            stopResizeRef.current = stop;
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
            window.addEventListener('pointercancel', stop);
        },
        [widthKey, assistantSide, setPanelWidth],
    );

    return { isResizing, handleResizeStart };
};
