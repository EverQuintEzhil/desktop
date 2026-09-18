import { useCallback, useEffect, useRef, useState } from 'react';

export const MIN_PANE_WIDTH = 420;

export const MAX_PANE_WIDTH = 1400;

const DEFAULT_VIEWPORT_FRACTION = 0.46;

const MIN_CHAT_WIDTH = 360;

const readViewportWidth = (): number =>
    typeof window === 'undefined' ? MIN_PANE_WIDTH + MIN_CHAT_WIDTH : window.innerWidth;

export const clampPaneWidth = (width: number, viewportWidth = readViewportWidth()): number => {
    const room = Math.max(MIN_PANE_WIDTH, viewportWidth - MIN_CHAT_WIDTH);

    return Math.round(Math.min(Math.max(width, MIN_PANE_WIDTH), Math.min(MAX_PANE_WIDTH, room)));
};

export const defaultPaneWidth = (viewportWidth = readViewportWidth()): number =>
    clampPaneWidth(viewportWidth * DEFAULT_VIEWPORT_FRACTION, viewportWidth);

const readPersistedWidth = (storageKey: string): number | null => {
    try {
        const raw = window.localStorage.getItem(storageKey);
        const parsed = raw === null ? Number.NaN : Number.parseInt(raw, 10);

        return Number.isFinite(parsed) ? parsed : null;
    } catch {
        return null;
    }
};

const writePersistedWidth = (storageKey: string, width: number): void => {
    try {
        window.localStorage.setItem(storageKey, String(width));
    } catch {
        return;
    }
};

interface UsePaneResizeResult {
    width: number;
    isResizing: boolean;
    handleProps: {
        onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
        onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
        onDoubleClick: () => void;
    };
}

const KEYBOARD_STEP = 24;

export const usePaneResize = (storageKey: string): UsePaneResizeResult => {
    const [width, setWidth] = useState<number>(() => {
        const persisted = readPersistedWidth(storageKey);

        return persisted === null ? defaultPaneWidth() : clampPaneWidth(persisted);
    });
    const [isResizing, setIsResizing] = useState(false);
    const widthRef = useRef(width);

    widthRef.current = width;

    const commit = useCallback(
        (next: number) => {
            const clamped = clampPaneWidth(next);

            setWidth(clamped);
            writePersistedWidth(storageKey, clamped);
        },
        [storageKey],
    );

    useEffect(() => {
        const onResize = () => setWidth((current) => clampPaneWidth(current));

        window.addEventListener('resize', onResize);

        return () => {
            window.removeEventListener('resize', onResize);
        };
    }, []);

    const onPointerDown = useCallback(
        (event: React.PointerEvent<HTMLElement>) => {
            event.preventDefault();
            setIsResizing(true);

            const onPointerMove = (moveEvent: PointerEvent) => {
                setWidth(clampPaneWidth(window.innerWidth - moveEvent.clientX));
            };

            const onPointerUp = () => {
                window.removeEventListener('pointermove', onPointerMove);
                window.removeEventListener('pointerup', onPointerUp);
                window.removeEventListener('pointercancel', onPointerUp);
                setIsResizing(false);
                writePersistedWidth(storageKey, widthRef.current);
            };

            window.addEventListener('pointermove', onPointerMove);
            window.addEventListener('pointerup', onPointerUp);
            window.addEventListener('pointercancel', onPointerUp);
        },
        [storageKey],
    );

    const onKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLElement>) => {
            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                commit(widthRef.current + KEYBOARD_STEP);
            }

            if (event.key === 'ArrowRight') {
                event.preventDefault();
                commit(widthRef.current - KEYBOARD_STEP);
            }
        },
        [commit],
    );

    const onDoubleClick = useCallback(() => commit(defaultPaneWidth()), [commit]);

    return { width, isResizing, handleProps: { onPointerDown, onKeyDown, onDoubleClick } };
};
