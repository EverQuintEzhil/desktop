import { useCallback, useEffect, useRef, useState } from 'react';

type PromptRect = { top: number; left: number; width: number };

/**
 * The files region is taller than the viewport, so centering the drop prompt within
 * the element would push it off-screen (or up over the composer when scrolled to top).
 * Measures the region's *visible* band instead so the prompt sits in the middle of
 * whatever is actually on screen, at any scroll position.
 */
export const useFilesDropPrompt = (isDraggingFiles: boolean) => {
    const filesRegionRef = useRef<HTMLDivElement>(null);
    const [filesPromptRect, setFilesPromptRect] = useState<PromptRect | null>(null);

    const measureFilesPrompt = useCallback(() => {
        const el = filesRegionRef.current;

        if (!el) return;

        const rect = el.getBoundingClientRect();
        const visibleTop = Math.max(rect.top, 0);
        const visibleBottom = Math.min(rect.bottom, window.innerHeight);

        // Region fully off-screen — keep the last position rather than compute a bogus midpoint.
        if (visibleBottom <= visibleTop) return;

        const next = {
            top: (visibleTop + visibleBottom) / 2,
            left: rect.left,
            width: rect.width,
        };

        // dragover fires continuously — skip no-op updates to avoid re-render churn.
        setFilesPromptRect((prev) =>
            prev?.top === next.top && prev?.left === next.left && prev?.width === next.width ? prev : next,
        );
    }, []);

    // Keep the prompt centered while dragging even if the page auto-scrolls or resizes.
    useEffect(() => {
        if (!isDraggingFiles) return undefined;

        measureFilesPrompt();
        window.addEventListener('scroll', measureFilesPrompt, true);
        window.addEventListener('resize', measureFilesPrompt);

        return () => {
            window.removeEventListener('scroll', measureFilesPrompt, true);
            window.removeEventListener('resize', measureFilesPrompt);
        };
    }, [isDraggingFiles, measureFilesPrompt]);

    return { filesRegionRef, filesPromptRect, measureFilesPrompt };
};
