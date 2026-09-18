import ConfirmationModal from '@/components/ui/confirmation-modal';

export interface SchemaUploadConfirmModalProps {
    isOpen: boolean;
    hasFields: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

/** Confirms replacing (or applying) the schema before an uploaded/dropped file is applied. */
const SchemaUploadConfirmModal = ({ isOpen, hasFields, onClose, onConfirm }: SchemaUploadConfirmModalProps) => (
    <ConfirmationModal
        isOpen={isOpen}
        onClose={onClose}
        onConfirm={onConfirm}
        title={hasFields ? 'Replace Schema' : 'Apply Schema'}
        confirmButtonText={hasFields ? 'Replace' : 'Apply'}
        cancelButtonText="Cancel"
    >
        <div className="flex flex-col gap-2">
            <p className="text-sm">
                {hasFields
                    ? 'Are you sure you want to replace your current schema? This action cannot be undone and all existing properties will be lost.'
                    : 'Apply the uploaded schema to the editor?'}
            </p>
        </div>
    </ConfirmationModal>
);

export default SchemaUploadConfirmModal;
