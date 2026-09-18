import { useEffect, useRef, useState } from 'react';

import { filesApi } from '@/lib/api';
import type { FileType } from '@/types/admin';
import type { GeneratedItem } from '@/types/gallery';
import { showErrorToast } from '@/utils';

import type useMaskImage from '../use-mask-image';

export interface UseLightboxRemixArgs {
    isOpen: boolean;
    initialShowRemixInput: boolean;
    maskSupported: boolean;
    showRemixInput: boolean;
    setShowRemixInput: (v: boolean) => void;
    currentItem: GeneratedItem | null;
    agentId?: string;
    onRemix?: (prompt: string, image: GeneratedItem, maskUrl?: string, editedFile?: FileType) => void;
    onClose: () => void;
    setDefaultParameters?: (defaultParameters: unknown, modelId: string) => void;
    resetDefaultParameters?: () => void;
    maskImage: ReturnType<typeof useMaskImage>;
}

export interface UseLightboxRemixResult {
    isUploadingPenImage: boolean;
    handleRemix: (e: React.FormEvent, prompt: string) => Promise<void>;
}

export const useLightboxRemix = (args: UseLightboxRemixArgs): UseLightboxRemixResult => {
    const {
        isOpen,
        initialShowRemixInput,
        maskSupported,
        showRemixInput,
        setShowRemixInput,
        currentItem,
        agentId,
        onRemix,
        onClose,
        setDefaultParameters,
        resetDefaultParameters,
        maskImage,
    } = args;

    const [isUploadingPenImage, setIsUploadingPenImage] = useState(false);

    useEffect(() => {
        if (isOpen && initialShowRemixInput && maskSupported) {
            setShowRemixInput(true);
        }
    }, [isOpen, initialShowRemixInput, maskSupported, setShowRemixInput]);

    const remixDefaultsAppliedRef = useRef(false);
    const prevShowRemixInputRef = useRef(showRemixInput);
    const resetDefaultParametersRef = useRef(resetDefaultParameters);

    resetDefaultParametersRef.current = resetDefaultParameters;

    useEffect(() => {
        const wasRemixOpen = prevShowRemixInputRef.current;

        prevShowRemixInputRef.current = showRemixInput;

        if (showRemixInput) {
            if (!setDefaultParameters || !currentItem?.ai?.arguments || !currentItem?.ai?.model_id) {
                return;
            }

            const defaultParameters = { ...currentItem.ai.arguments.options };

            delete defaultParameters.prompt;
            setDefaultParameters(defaultParameters, currentItem.ai.model_id);
            remixDefaultsAppliedRef.current = true;

            return;
        }

        if (wasRemixOpen && remixDefaultsAppliedRef.current) {
            remixDefaultsAppliedRef.current = false;
            resetDefaultParametersRef.current?.();
        }
    }, [showRemixInput, currentItem?._id]);

    useEffect(() => {
        return () => {
            if (remixDefaultsAppliedRef.current) {
                remixDefaultsAppliedRef.current = false;
                resetDefaultParametersRef.current?.();
            }
        };
    }, []);

    const handleRemix = async (e: React.FormEvent, prompt: string) => {
        e.stopPropagation();
        if (!onRemix || !currentItem) return;

        if (maskSupported && maskImage.maskHasStrokes) {
            if (maskImage.toolMode === 'pen') {
                const blob = await maskImage.exportPenCompositeBlob();

                if (!blob) {
                    showErrorToast('Failed to export edited image');

                    return;
                }

                setIsUploadingPenImage(true);
                try {
                    const form = new FormData();

                    form.append('files', blob, 'edited-image.png');
                    if (agentId) {
                        form.append('origin.type', 'gallery');
                        form.append('origin.agent_id', agentId);
                    }
                    const response = await filesApi.upload(form);
                    const uploadedFile = response.data?.value?.values?.[0];

                    if (!uploadedFile) {
                        showErrorToast('Failed to upload edited image');

                        return;
                    }

                    const editedFile: FileType = {
                        name: uploadedFile.name || 'edited-image',
                        type: 'image',
                        url: uploadedFile.url,
                        _id: uploadedFile._id,
                        tempId: `temp-${uploadedFile._id}`,
                        size: uploadedFile.size,
                        isUploading: false,
                    };

                    onRemix(prompt, currentItem, undefined, editedFile);
                    setShowRemixInput(false);
                    onClose();

                    return;
                } catch {
                    showErrorToast('Failed to upload edited image');

                    return;
                } finally {
                    setIsUploadingPenImage(false);
                }
            } else {
                const maskUrl = await maskImage.exportMaskDataUrl();

                onRemix(prompt, currentItem, maskUrl);
                setShowRemixInput(false);
                onClose();

                return;
            }
        }

        onRemix(prompt, currentItem);
        setShowRemixInput(false);
        onClose();
    };

    return {
        isUploadingPenImage,
        handleRemix,
    };
};
