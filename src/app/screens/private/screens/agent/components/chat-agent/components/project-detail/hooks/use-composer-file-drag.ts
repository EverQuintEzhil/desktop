import { useState } from 'react';

import type { AgentComposerContextValue } from '@/components/agent-chat/types';
import { acceptValidFiles } from '@/utils';

import { isFileDrag, toFileList } from '../utils/file-drag';

/** Top region (composer) → attaches dragged files to the message being composed. */
export const useComposerFileDrag = (
    composerFilesEnabled: boolean,
    composerAccept: string,
    filesState: AgentComposerContextValue['filesState'],
) => {
    const [isDraggingComposer, setIsDraggingComposer] = useState(false);

    const dropzoneProps = {
        onDragEnter: (event: React.DragEvent) => {
            if (!composerFilesEnabled || !isFileDrag(event)) return;
            event.preventDefault();
            if (!isDraggingComposer) setIsDraggingComposer(true);
        },
        onDragOver: (event: React.DragEvent) => {
            if (!composerFilesEnabled || !isFileDrag(event)) return;
            event.preventDefault();
            if (!isDraggingComposer) setIsDraggingComposer(true);
        },
        onDragLeave: (event: React.DragEvent) => {
            // Ignore leave events bubbling up from children — only clear on a real exit.
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
            setIsDraggingComposer(false);
        },
        onDrop: (event: React.DragEvent) => {
            if (!composerFilesEnabled || !isFileDrag(event)) return;
            event.preventDefault();
            setIsDraggingComposer(false);
            // Screen by the accept whitelist first (onChangeFile can't read `accept` off a
            // native drag event), then hand the survivors to the composer's upload pipeline.
            const valid = acceptValidFiles(event.dataTransfer.files, composerAccept);

            if (valid.length === 0) return;

            filesState.onChangeFile({
                target: { files: toFileList(valid), multiple: true },
            } as unknown as React.ChangeEvent<HTMLInputElement>);
        },
    };

    return { isDraggingComposer, dropzoneProps };
};
