import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { safeLocalStorageGetItem, safeLocalStorageSetItem } from '@/utils/safe-storage';

import {
    SIDEBAR_DEFAULT_WIDTH,
    SIDEBAR_KEYBOARD_STEP,
    SIDEBAR_KEYBOARD_STEP_LARGE,
    SIDEBAR_MAX_WIDTH,
    SIDEBAR_MIN_WIDTH,
    SIDEBAR_WIDTH_STORAGE_KEY,
} from '../constants';

const clampWidth = (value: number): number =>
    Math.min(Math.max(Math.round(value), SIDEBAR_MIN_WIDTH), SIDEBAR_MAX_WIDTH);

const readStoredWidth = (): number => {
    const stored = Number(safeLocalStorageGetItem(SIDEBAR_WIDTH_STORAGE_KEY));

    return Number.isFinite(stored) && stored > 0 ? clampWidth(stored) : SIDEBAR_DEFAULT_WIDTH;
};

export interface ChatSidebarResizeHandleProps {
    width: number;
    isResizing: boolean;
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
    onLostPointerCapture: (event: ReactPointerEvent<HTMLDivElement>) => void;
    onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
    onDoubleClick: () => void;
}

const releaseCapture = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
    }
};

interface DragState {
    startX: number;
    startWidth: number;
    latest: number;
}

export const useChatSidebarWidth = () => {
    const asideRef = useRef<HTMLElement | null>(null);
    const [width, setWidth] = useState(readStoredWidth);
    const [isResizing, setIsResizing] = useState(false);
    const dragRef = useRef<DragState | null>(null);

    /**
     * During a drag the width goes straight to the DOM rather than through state:
     * the sidebar renders the whole conversation history, so re-rendering it on
     * every pointer move would stall the drag.
     */
    const paint = useCallback((next: number) => {
        asideRef.current?.style.setProperty('--chat-sidebar-width', `${next}px`);
    }, []);

    /**
     * The committed width rides on a render-time style so it is on the element
     * the instant it enters the DOM. Writing it from an effect leaves a gap in
     * which the stylesheet fallback is the aside's computed width; any layout
     * read in that gap hands the width transition a before-change style, which
     * played the sidebar sliding from the fallback to the stored width on mount.
     */
    const style = useMemo<CSSProperties>(() => ({ '--chat-sidebar-width': `${width}px` }) as CSSProperties, [width]);

    const commit = useCallback((next: number) => {
        const clamped = clampWidth(next);

        setWidth(clamped);
        safeLocalStorageSetItem(SIDEBAR_WIDTH_STORAGE_KEY, String(clamped));
    }, []);

    const onPointerDown = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            // A second concurrent pointer must not restart the drag from its own origin.
            if (event.button !== 0 || dragRef.current) return;

            // Stops the browser starting a text selection under the pointer. It also
            // suppresses the compatibility mousedown that would focus the splitter —
            // deliberate, so the highlight clears on mouseout instead of lingering.
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

    /** A cancelled gesture was aborted, not completed: the in-flight width is discarded. */
    const cancelDrag = useCallback(() => {
        const drag = dragRef.current;

        if (!drag) return;

        dragRef.current = null;
        setIsResizing(false);
        paint(drag.startWidth);
        commit(drag.startWidth);
    }, [commit, paint]);

    const endDrag = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            if (!dragRef.current) return;

            releaseCapture(event);
            finishDrag();
        },
        [finishDrag],
    );

    const abortDrag = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            if (!dragRef.current) return;

            releaseCapture(event);
            cancelDrag();
        },
        [cancelDrag],
    );

    /**
     * Capture can drop without a `pointerup` ever reaching the handle: the browser
     * releases it when the element is removed, which is what collapsing the sidebar
     * mid-drag does. This hook outlives the handle, so `isResizing` would stay stuck
     * on, and the body cursor with it.
     */
    useEffect(() => {
        if (!isResizing) return undefined;

        const { cursor, userSelect } = document.body.style;

        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        window.addEventListener('pointerup', finishDrag);
        window.addEventListener('pointercancel', cancelDrag);
        window.addEventListener('lostpointercapture', finishDrag);

        return () => {
            document.body.style.cursor = cursor;
            document.body.style.userSelect = userSelect;
            window.removeEventListener('pointerup', finishDrag);
            window.removeEventListener('pointercancel', cancelDrag);
            window.removeEventListener('lostpointercapture', finishDrag);
        };
    }, [isResizing, finishDrag, cancelDrag]);

    const onKeyDown = useCallback(
        (event: ReactKeyboardEvent<HTMLDivElement>) => {
            const step = event.shiftKey ? SIDEBAR_KEYBOARD_STEP_LARGE : SIDEBAR_KEYBOARD_STEP;

            if (event.key === 'ArrowLeft') commit(width - step);
            else if (event.key === 'ArrowRight') commit(width + step);
            else if (event.key === 'Home') commit(SIDEBAR_MIN_WIDTH);
            else if (event.key === 'End') commit(SIDEBAR_MAX_WIDTH);
            else if (event.key === 'Enter') commit(SIDEBAR_DEFAULT_WIDTH);
            else return;

            event.preventDefault();
        },
        [commit, width],
    );

    const onDoubleClick = useCallback(() => commit(SIDEBAR_DEFAULT_WIDTH), [commit]);

    const handleProps: ChatSidebarResizeHandleProps = {
        width,
        isResizing,
        onPointerDown,
        onPointerMove,
        onPointerUp: endDrag,
        onPointerCancel: abortDrag,
        onLostPointerCapture: endDrag,
        onKeyDown,
        onDoubleClick,
    };

    return {
        asideRef,
        isResizing,
        handleProps,
        style,
    };
};

export default useChatSidebarWidth;
