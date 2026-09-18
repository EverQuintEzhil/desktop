import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { safeLocalStorageGetItem, safeLocalStorageSetItem } from '@/utils/safe-storage';

const STORAGE_KEY = 'builder-chat-width';

/** Below `lg` the config panel needs the room, so the chat panel starts narrower. */
const DEFAULT_WIDTH_MD = 300;
const DEFAULT_WIDTH_LG = 420;
const LG_BREAKPOINT = 1024;

const MIN_WIDTH = 260;
const MAX_VIEWPORT_RATIO = 0.55;

const KEYBOARD_STEP = 16;
const KEYBOARD_STEP_LARGE = 64;

const defaultWidth = (): number => (window.innerWidth >= LG_BREAKPOINT ? DEFAULT_WIDTH_LG : DEFAULT_WIDTH_MD);

const maxWidth = (): number => Math.max(MIN_WIDTH, Math.round(window.innerWidth * MAX_VIEWPORT_RATIO));

const clampWidth = (value: number): number => Math.min(Math.max(Math.round(value), MIN_WIDTH), maxWidth());

/**
 * The width the user last chose, before this window's max is applied. Kept
 * separate from the shown width so a shrink-then-widen restores the choice
 * instead of leaving it clamped.
 */
const readStoredPreference = (): number => {
    const stored = Number(safeLocalStorageGetItem(STORAGE_KEY));

    return Number.isFinite(stored) && stored > 0 ? stored : defaultWidth();
};

/**
 * Reads the saved width without mounting the hook, so the loading skeleton can
 * render at the same width the builder is about to use and nothing jumps.
 */
export const readBuilderChatWidth = (): number => {
    if (typeof window === 'undefined') return DEFAULT_WIDTH_LG;

    return clampWidth(readStoredPreference());
};

export interface BuilderResizeHandleProps {
    width: number;
    minWidth: number;
    maxWidth: number;
    isResizing: boolean;
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
    onLostPointerCapture: (event: ReactPointerEvent<HTMLDivElement>) => void;
    onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
    onDoubleClick: () => void;
}

interface DragState {
    startX: number;
    startWidth: number;
    latest: number;
}

export const useBuilderChatWidth = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(readBuilderChatWidth);
    const [isResizing, setIsResizing] = useState(false);
    const [limits, setLimits] = useState(() => ({ min: MIN_WIDTH, max: maxWidth() }));
    const dragRef = useRef<DragState | null>(null);
    const preferredRef = useRef(readStoredPreference());

    /**
     * The width is written straight to the DOM rather than rendered as a style
     * prop. A drag would otherwise re-render the whole builder — chat thread
     * included — on every pointer move.
     */
    const paint = useCallback((next: number) => {
        containerRef.current?.style.setProperty('--builder-chat-width', `${next}px`);
    }, []);

    useLayoutEffect(() => paint(width), [paint, width]);

    // A narrower window can push the chosen width past the max. Re-clamp the
    // preference rather than the shown width, so widening the window again brings
    // the choice back without a reload. The saved value is never touched here.
    useEffect(() => {
        const handleWindowResize = () => {
            setLimits({ min: MIN_WIDTH, max: maxWidth() });

            // `onPointerMove` already clamps every move against the new max.
            // Writing state here would run the layout effect and overwrite `paint`.
            if (dragRef.current) return;

            setWidth(clampWidth(preferredRef.current));
        };

        window.addEventListener('resize', handleWindowResize);

        return () => window.removeEventListener('resize', handleWindowResize);
    }, []);

    const commit = useCallback((next: number) => {
        const clamped = clampWidth(next);

        preferredRef.current = clamped;
        setWidth(clamped);
        safeLocalStorageSetItem(STORAGE_KEY, String(clamped));
    }, []);

    const onPointerDown = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            if (event.button !== 0) return;

            // Stops the browser starting a text selection under the pointer.
            event.preventDefault();
            dragRef.current = { startX: event.clientX, startWidth: width, latest: width };
            event.currentTarget.setPointerCapture(event.pointerId);
            setIsResizing(true);
        },
        [width],
    );

    const onPointerMove = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            const drag = dragRef.current;

            if (!drag) return;

            const next = clampWidth(drag.startWidth + (event.clientX - drag.startX));

            drag.latest = next;
            paint(next);
        },
        [paint],
    );

    const finishDrag = useCallback(() => {
        const drag = dragRef.current;

        if (!drag) return;

        dragRef.current = null;
        setIsResizing(false);
        commit(drag.latest);
    }, [commit]);

    const endDrag = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            if (!dragRef.current) return;

            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
            }

            finishDrag();
        },
        [finishDrag],
    );

    /**
     * Capture can drop without a `pointerup` ever reaching the handle: the browser
     * releases it when the element is removed, which is what happens when the
     * preview opens mid-drag. This hook outlives the handle, so `isResizing` would
     * stay stuck on. `window` is the one node still listening at that point.
     */
    useEffect(() => {
        if (!isResizing) return;

        window.addEventListener('pointerup', finishDrag);
        window.addEventListener('pointercancel', finishDrag);
        window.addEventListener('lostpointercapture', finishDrag);

        return () => {
            window.removeEventListener('pointerup', finishDrag);
            window.removeEventListener('pointercancel', finishDrag);
            window.removeEventListener('lostpointercapture', finishDrag);
        };
    }, [isResizing, finishDrag]);

    const onKeyDown = useCallback(
        (event: ReactKeyboardEvent<HTMLDivElement>) => {
            const step = event.shiftKey ? KEYBOARD_STEP_LARGE : KEYBOARD_STEP;

            if (event.key === 'ArrowLeft') commit(width - step);
            else if (event.key === 'ArrowRight') commit(width + step);
            else if (event.key === 'Home') commit(MIN_WIDTH);
            else if (event.key === 'End') commit(maxWidth());
            else if (event.key === 'Enter') commit(defaultWidth());
            else return;

            event.preventDefault();
        },
        [commit, width],
    );

    const onDoubleClick = useCallback(() => commit(defaultWidth()), [commit]);

    const handleProps: BuilderResizeHandleProps = {
        width,
        minWidth: limits.min,
        maxWidth: limits.max,
        isResizing,
        onPointerDown,
        onPointerMove,
        onPointerUp: endDrag,
        onPointerCancel: endDrag,
        onLostPointerCapture: endDrag,
        onKeyDown,
        onDoubleClick,
    };

    return { containerRef, isResizing, handleProps };
};

export default useBuilderChatWidth;
