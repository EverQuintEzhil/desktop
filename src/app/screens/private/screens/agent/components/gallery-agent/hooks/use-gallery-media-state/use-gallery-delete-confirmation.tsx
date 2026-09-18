import type React from 'react';
import { useCallback, useState } from 'react';

import ConfirmationModal from '@/components/ui/confirmation-modal';
import { appMediaApi } from '@/lib/api/app/media';
import type { GeneratedItem } from '@/types/gallery';

interface UseGalleryDeleteConfirmationArgs {
    removeItem: (id: string) => GeneratedItem[];
}

export interface UseGalleryDeleteConfirmationResult {
    isConfirmationModalOpen: GeneratedItem | null;
    isDeleteSubmitting: boolean;
    onConfirmClick: () => Promise<void>;
    closeConfirmModal: () => void;
    onDeleteItemClicked: (item: GeneratedItem) => void;
    renderConfirmationModal: (deleteMessage: string) => React.ReactNode;
}

export const useGalleryDeleteConfirmation = (
    args: UseGalleryDeleteConfirmationArgs,
): UseGalleryDeleteConfirmationResult => {
    const { removeItem } = args;

    const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState<GeneratedItem | null>(null);
    const [isDeleteSubmitting, setIsDeleteSubmitting] = useState(false);

    const closeConfirmModal = useCallback(() => {
        setIsConfirmationModalOpen(null);
    }, []);

    const onConfirmClick = useCallback(async () => {
        if (!isConfirmationModalOpen) return;

        setIsDeleteSubmitting(true);
        try {
            await appMediaApi.deleteFile(isConfirmationModalOpen._id);
            removeItem(isConfirmationModalOpen._id);
            setIsConfirmationModalOpen(null);
        } catch (error) {
            console.error(error);
        } finally {
            setIsDeleteSubmitting(false);
        }
    }, [isConfirmationModalOpen, removeItem]);

    const onDeleteItemClicked = useCallback((item: GeneratedItem) => {
        setIsConfirmationModalOpen(item);
    }, []);

    const renderConfirmationModal = (deleteMessage: string) => {
        return (
            <ConfirmationModal
                isOpen={Boolean(isConfirmationModalOpen)}
                onClose={closeConfirmModal}
                onConfirm={onConfirmClick}
                title="Delete Confirmation"
                confirmButtonText="Confirm"
                cancelButtonText="Cancel"
                isButtonLoading={isDeleteSubmitting}
            >
                <div className="mx-auto flex w-full max-w-[360px] flex-col items-center justify-center text-center">
                    <span className="text-base text-foreground">{deleteMessage}</span>
                </div>
            </ConfirmationModal>
        );
    };

    return {
        isConfirmationModalOpen,
        isDeleteSubmitting,
        onConfirmClick,
        closeConfirmModal,
        onDeleteItemClicked,
        renderConfirmationModal,
    };
};
