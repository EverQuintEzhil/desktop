import ConfirmationModal from '@/components/ui/confirmation-modal';

export interface Props {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

const PromptCloneConfirmationModal = (props: Props) => {
    const { isOpen, onClose, onConfirm } = props;

    return (
        <ConfirmationModal
            isOpen={isOpen}
            onClose={onClose}
            onConfirm={onConfirm}
            title="Clone Confirmation"
            confirmButtonText="Confirm"
            cancelButtonText="Cancel"
        >
            <div className="mx-auto flex flex-col items-center justify-center text-center">
                <span className="text-sm">
                    Would you like to duplicate this prompt? This will create a copy that you can modify.
                </span>
            </div>
        </ConfirmationModal>
    );
};

export default PromptCloneConfirmationModal;
