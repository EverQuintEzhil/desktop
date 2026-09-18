import React, { useState } from 'react';

import ConfirmationModal from '@/components/ui/confirmation-modal';
import { Input } from '@/components/ui/input';
import { useDeleteAssetMutation } from '@/lib/api/admin/assets';
import type { AssetType } from '@/types/admin';
import { showErrorToast } from '@/utils';

interface Props {
    onClose: () => void;
    isOpen: boolean;
    asset: AssetType;
    onDeleteSuccess?: () => void;
}

const DeleteAsset = (props: Props) => {
    const { onClose, isOpen, asset, onDeleteSuccess } = props;

    const [userInput, setUserInput] = useState('');

    const deleteMutation = useDeleteAssetMutation();

    const handleClose = () => {
        setUserInput('');
        onClose();
    };

    const onDelete = async () => {
        try {
            await deleteMutation.mutateAsync(asset.key);
            onDeleteSuccess?.();
            handleClose();
        } catch (error) {
            const axiosError = error as { response?: { data?: { message?: string } } };

            showErrorToast(axiosError.response?.data?.message || 'Something went wrong. Please try again.');
        }
    };

    const isDisabled = deleteMutation.isPending || asset.key?.trim() !== userInput.trim();

    return (
        <ConfirmationModal
            isOpen={isOpen}
            onClose={handleClose}
            title="Delete Asset"
            buttons={[
                {
                    text: 'Cancel',
                    variant: 'secondary',
                    onClick: handleClose,
                },
                {
                    text: deleteMutation.isPending ? 'Deleting...' : 'Delete',
                    variant: 'destructive',
                    loading: deleteMutation.isPending,
                    disabled: isDisabled,
                    title: isDisabled ? 'Need to match key name.' : undefined,
                    onClick: onDelete,
                },
            ]}
        >
            <div className="flex w-full flex-col gap-4">
                <span className="text-base font-normal text-foreground">
                    Are you sure you want to delete this Asset?
                </span>
                <div className="flex w-full flex-col gap-2">
                    <span className="text-sm leading-[1.43] font-medium text-muted-foreground">
                        To delete, please type asset key :
                    </span>
                    <Input
                        value={userInput}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUserInput(e.currentTarget.value)}
                        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                            if (e.key === 'Enter' && !isDisabled) {
                                onDelete();
                            }
                        }}
                        autoFocus
                    />
                </div>
            </div>
        </ConfirmationModal>
    );
};

export default DeleteAsset;
