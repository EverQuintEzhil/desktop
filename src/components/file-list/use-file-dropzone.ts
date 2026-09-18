import { useState } from 'react';

import { acceptValidFiles } from '@/utils';

interface DropzoneOptions {
    enabled: boolean;
    onFiles: (files: File[]) => void;
    /** Optional `accept` whitelist; dropped files failing it are rejected with a toast. */
    accept?: string;
}

/**
 * Flicker-safe file drag-and-drop. Spread `dropzoneProps` onto the drop target;
 * `isDragging` drives the highlight/overlay. Drops are ignored when disabled.
 * When `accept` is provided, dropped files are validated by extension + MIME before `onFiles`.
 */
export const useFileDropzone = ({ enabled, onFiles, accept }: DropzoneOptions) => {
    const [isDragging, setIsDragging] = useState(false);

    const dropzoneProps = {
        onDragEnter: (event: React.DragEvent) => {
            if (!enabled) return;
            event.preventDefault();
            if (!isDragging) setIsDragging(true);
        },
        onDragOver: (event: React.DragEvent) => {
            if (!enabled) return;
            event.preventDefault();
            if (!isDragging) setIsDragging(true);
        },
        onDragLeave: (event: React.DragEvent) => {
            // Ignore leave events for child elements — only clear on real exit.
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
            setIsDragging(false);
        },
        onDrop: (event: React.DragEvent) => {
            event.preventDefault();
            setIsDragging(false);
            if (!enabled) return;

            const dropped = acceptValidFiles(event.dataTransfer.files, accept);

            if (dropped.length > 0) onFiles(dropped);
        },
    };

    return { isDragging, dropzoneProps };
};
