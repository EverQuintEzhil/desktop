import { useCallback, useEffect, useRef, useState } from 'react';

import type { LibraryItem } from '@/components/agent-chat/hooks/use-media-library';

import type { PreviewIntent } from '../types';

interface UseLibraryPreviewParams {
    items: LibraryItem[];
    controlledPreviewId?: string | null;
    onPreviewChange?: (id: string | null, intent: PreviewIntent) => void;
    hasNextPage?: boolean;
    isShowMoreLoading: boolean;
    fetchNextPage: () => void;
}

const useLibraryPreview = (params: UseLibraryPreviewParams) => {
    const { items, controlledPreviewId, onPreviewChange, hasNextPage, isShowMoreLoading, fetchNextPage } = params;

    const [localPreviewId, setLocalPreviewId] = useState<string | null>(null);
    // Holds the open file so the preview keeps rendering while the list refetches under it.
    const [previewCache, setPreviewCache] = useState<LibraryItem | null>(null);
    // Next-at-page-boundary: remember where to advance from once the next page of files lands.
    const pendingPreviewAdvanceIdRef = useRef<string | null>(null);

    const openPreviewId = controlledPreviewId === undefined ? localPreviewId : controlledPreviewId;

    const setPreview = useCallback(
        (item: LibraryItem | null, intent: PreviewIntent) => {
            setPreviewCache(item);

            if (controlledPreviewId === undefined) {
                setLocalPreviewId(item?._id ?? null);

                return;
            }

            onPreviewChange?.(item?._id ?? null, intent);
        },
        [controlledPreviewId, onPreviewChange],
    );

    const openPreview = (item: LibraryItem) => {
        setPreview(item, 'open');
    };

    const closePreview = () => {
        setPreview(null, 'close');
    };

    // The caller is routing away from the library, so the preview goes with the unmount.
    const leavePreview = () => {
        setPreview(null, 'leave');
    };

    const activePreviewItem = openPreviewId
        ? (items.find((item) => item._id === openPreviewId) ??
          (previewCache?._id === openPreviewId ? previewCache : null))
        : null;

    const previewIndex = activePreviewItem ? items.findIndex((item) => item._id === activePreviewItem._id) : -1;

    const goToPreviewSibling = (direction: 1 | -1) => {
        if (previewIndex < 0) return;

        const nextIndex = previewIndex + direction;
        const nextItem = items[nextIndex];

        if (nextItem) {
            pendingPreviewAdvanceIdRef.current = null;
            setPreview(nextItem, 'step');

            if (direction === 1 && nextIndex >= items.length - 2 && hasNextPage && !isShowMoreLoading) {
                void fetchNextPage();
            }

            return;
        }

        if (direction === 1 && hasNextPage) {
            pendingPreviewAdvanceIdRef.current = activePreviewItem?._id ?? null;
            if (!isShowMoreLoading) void fetchNextPage();
        }
    };

    useEffect(() => {
        const pendingId = pendingPreviewAdvanceIdRef.current;

        if (!pendingId) return;

        // Closing the preview or moving off the boundary item cancels the pending advance.
        if (openPreviewId !== pendingId) {
            pendingPreviewAdvanceIdRef.current = null;

            return;
        }

        const index = items.findIndex((item) => item._id === pendingId);
        const nextItem = index >= 0 ? items[index + 1] : undefined;

        if (nextItem) {
            pendingPreviewAdvanceIdRef.current = null;
            setPreview(nextItem, 'step');
        }
    }, [items, openPreviewId, setPreview]);

    return {
        activePreviewItem,
        previewIndex,
        openPreview,
        closePreview,
        leavePreview,
        goToPreviewSibling,
    };
};

export default useLibraryPreview;
