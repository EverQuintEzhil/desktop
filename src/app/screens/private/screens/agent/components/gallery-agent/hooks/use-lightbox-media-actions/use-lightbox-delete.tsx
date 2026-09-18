import { useState } from 'react';

import ConfirmationModal from '@/components/ui/confirmation-modal';
import type { GeneratedItem } from '@/types/gallery';

export interface UseLightboxDeleteArgs {
    onDeleteItemAsyncClicked?: (item: GeneratedItem) => Promise<GeneratedItem[]>;
    onAfterDelete?: (remainingItems?: GeneratedItem[]) => void;
}

export interface UseLightboxDeleteResult {
    deleteModalItem: GeneratedItem | null;
    isDeleteSubmitting: boolean;
    onDeleteClicked: (item: GeneratedItem) => void;
    onConfirmDelete: () => Promise<void>;
    closeConfirmModal: () => void;
    renderConfirmationModal: (deleteMessage?: string) => React.ReactNode;
}

export const useLightboxDelete = (args: UseLightboxDeleteArgs): UseLightboxDeleteResult => {
    const { onDeleteItemAsyncClicked, onAfterDelete } = args;

    const [deleteModalItem, setDeleteModalItem] = useState<GeneratedItem | null>(null);
    const [isDeleteSubmitting, setIsDeleteSubmitting] = useState(false);

    const onDeleteClicked = (item: GeneratedItem) => {
        if (onDeleteItemAsyncClicked) {
            setDeleteModalItem(item);
        }
    };

    const onConfirmDelete = async () => {
        if (!deleteModalItem || !onDeleteItemAsyncClicked) return;

        setIsDeleteSubmitting(true);
        try {
            const remaining = await onDeleteItemAsyncClicked(deleteModalItem);

            setDeleteModalItem(null);
            onAfterDelete?.(remaining);
        } catch (err) {
            console.error(err);
        } finally {
            setIsDeleteSubmitting(false);
        }
    };

    const closeConfirmModal = () => setDeleteModalItem(null);

    const renderConfirmationModal = (deleteMessage = 'Are you sure you want to delete?') => {
        return (
            <ConfirmationModal
                isOpen={Boolean(deleteModalItem)}
                onClose={closeConfirmModal}
                onConfirm={onConfirmDelete}
                title="Delete Confirmation"
                confirmButtonText="Confirm"
                cancelButtonText="Cancel"
                isButtonLoading={isDeleteSubmitting}
            >
                <div className="mx-auto flex flex-col items-center justify-center text-center">
                    <span className="text-sm">{deleteMessage}</span>
                </div>
            </ConfirmationModal>
        );
    };

    return {
        deleteModalItem,
        isDeleteSubmitting,
        onDeleteClicked,
        onConfirmDelete,
        closeConfirmModal,
        renderConfirmationModal,
    };
};
