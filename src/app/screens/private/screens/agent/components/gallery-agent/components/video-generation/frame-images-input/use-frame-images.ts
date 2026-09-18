import { useCallback, useState } from 'react';

import { filesApi } from '@/lib/api';
import { generateTempId, getFileType, getUploadErrorMessage } from '@/lib/chat/file-upload-utils';
import type { GalleryAgentType } from '@/types/admin';
import type { FileType } from '@/types/chat';

export type FrameSlot = 'first' | 'last';

interface FrameImagesState {
    first: FileType | null;
    last: FileType | null;
}

export interface UseFrameImages {
    first: FileType | null;
    last: FileType | null;
    firstFrameId?: string;
    lastFrameId?: string;
    isUploading: boolean;
    selectFrame: (slot: FrameSlot, file: File) => void;
    removeFrame: (slot: FrameSlot) => void;
    swapFrames: () => void;
    reset: () => void;
}

const initialState: FrameImagesState = { first: null, last: null };

export const useFrameImages = (agent: GalleryAgentType): UseFrameImages => {
    const [state, setState] = useState<FrameImagesState>(initialState);

    const updateSlotIfCurrent = useCallback((slot: FrameSlot, tempId: string, updates: Partial<FileType>) => {
        setState((prev) => {
            const current = prev[slot];

            if (current?.tempId !== tempId) return prev;

            return { ...prev, [slot]: { ...current, ...updates } };
        });
    }, []);

    const uploadFrame = useCallback(
        async (slot: FrameSlot, file: File, tempId: string) => {
            try {
                const bodyFormData = new FormData();

                bodyFormData.append('files', file);
                bodyFormData.append('agent_id', agent._id);
                bodyFormData.append('origin.type', 'gallery');
                bodyFormData.append('origin.agent_id', agent._id);

                const response = await filesApi.upload(bodyFormData, {
                    onUploadProgress: (progressEvent) => {
                        const progress = Math.round((progressEvent.loaded / (progressEvent.total || 1)) * 100);

                        updateSlotIfCurrent(slot, tempId, { uploadProgress: progress });
                    },
                });

                const uploadedFile = response.data?.value?.values?.[0];

                if (!uploadedFile) {
                    updateSlotIfCurrent(slot, tempId, {
                        isUploading: false,
                        uploadError: true,
                        uploadErrorMessage: 'Upload failed. Click to retry.',
                        uploadProgress: 0,
                    });

                    return;
                }

                updateSlotIfCurrent(slot, tempId, {
                    _id: uploadedFile._id,
                    name: uploadedFile.name ?? file.name,
                    url: uploadedFile.url,
                    location: uploadedFile.location,
                    size: uploadedFile.size,
                    isUploading: false,
                    uploadProgress: 100,
                    uploadError: false,
                    uploadErrorMessage: undefined,
                });
            } catch (error) {
                updateSlotIfCurrent(slot, tempId, {
                    isUploading: false,
                    uploadError: true,
                    uploadErrorMessage: getUploadErrorMessage(error),
                    uploadProgress: 0,
                });
            }
        },
        [agent._id, updateSlotIfCurrent],
    );

    const selectFrame = useCallback(
        (slot: FrameSlot, file: File) => {
            const tempId = generateTempId();
            const optimisticFile: FileType = {
                tempId,
                name: file.name,
                type: getFileType(file.name),
                url: URL.createObjectURL(file),
                isUploading: true,
                uploadProgress: 0,
                uploadError: false,
            };

            setState((prev) => ({ ...prev, [slot]: optimisticFile }));
            uploadFrame(slot, file, tempId);
        },
        [uploadFrame],
    );

    const removeFrame = useCallback((slot: FrameSlot) => {
        setState((prev) => ({ ...prev, [slot]: null }));
    }, []);

    const swapFrames = useCallback(() => {
        setState((prev) => ({ first: prev.last, last: prev.first }));
    }, []);

    const reset = useCallback(() => {
        setState(initialState);
    }, []);

    return {
        first: state.first,
        last: state.last,
        firstFrameId: state.first?._id,
        lastFrameId: state.last?._id,
        isUploading: Boolean(state.first?.isUploading) || Boolean(state.last?.isUploading),
        selectFrame,
        removeFrame,
        swapFrames,
        reset,
    };
};
