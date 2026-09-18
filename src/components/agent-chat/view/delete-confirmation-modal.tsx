import ConfirmationModal from '@/components/ui/confirmation-modal';

interface DeleteConfirmationModalProps {
    isOpen: boolean;
    isLoading?: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title?: string;
    message?: string;
}

const DeleteConfirmationModal = ({
    isOpen,
    isLoading = false,
    onClose,
    onConfirm,
    title = 'Delete Confirmation',
    message = 'Are you sure you want to delete?',
}: DeleteConfirmationModalProps) => (
    <ConfirmationModal
        isOpen={isOpen}
        onClose={onClose}
        onConfirm={onConfirm}
        title={title}
        confirmButtonText="Confirm"
        cancelButtonText="Cancel"
        isButtonLoading={isLoading}
    >
        <div className="mx-auto flex flex-col items-center justify-center text-center">
            <span className="text-sm">{message}</span>
        </div>
    </ConfirmationModal>
);

export default DeleteConfirmationModal;
