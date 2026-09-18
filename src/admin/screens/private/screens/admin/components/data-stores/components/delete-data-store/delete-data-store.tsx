import React, { useState } from 'react';

import ConfirmationModal from '@/components/ui/confirmation-modal';
import { Input } from '@/components/ui/input';
import { useDeleteDataStoreMutation } from '@/lib/api/admin/data-stores';
import type { DataStoreType } from '@/types/admin';
import { showErrorToast } from '@/utils';

interface Props {
    onClose: () => void;
    isOpen: boolean;
    onDeleteSuccess?: () => void;
    dataStore: DataStoreType;
}

const DeleteDataStore = (props: Props) => {
    const { onClose: onCloseProp, isOpen, onDeleteSuccess, dataStore } = props;

    const deleteMutation = useDeleteDataStoreMutation();
    const [userInput, setUserInput] = useState('');

    const onClose = () => {
        setUserInput('');
        onCloseProp();
    };

    const onDelete = async () => {
        try {
            await deleteMutation.mutateAsync(dataStore._id);
            onDeleteSuccess?.();
            onClose();
        } catch (error) {
            const axiosError = error as { response?: { data?: { message?: string } } };

            showErrorToast(axiosError.response?.data?.message || 'Something went wrong. Please try again.');
        } finally {
            setUserInput('');
        }
    };

    const isDisabled = deleteMutation.isPending || dataStore.provider?.trim() !== userInput.trim();

    return (
        <ConfirmationModal
            isOpen={isOpen}
            onClose={onClose}
            title="Delete Data Store"
            buttons={[
                {
                    text: 'Cancel',
                    variant: 'secondary',
                    onClick: onClose,
                },
                {
                    text: deleteMutation.isPending ? 'Deleting...' : 'Delete',
                    variant: 'destructive',
                    loading: deleteMutation.isPending,
                    disabled: isDisabled,
                    title: isDisabled ? 'Need to match provider name.' : undefined,
                    onClick: onDelete,
                },
            ]}
        >
            <div className="flex w-full flex-col gap-4">
                <span className="text-base font-normal text-foreground">
                    Are you sure you want to delete this Data Store?
                </span>
                <div className="flex w-full flex-col gap-2">
                    <span className="text-sm leading-[1.43] font-medium text-muted-foreground">
                        To delete, please type data store provider name :
                    </span>
                    <Input
                        value={userInput}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            const value = e.currentTarget.value;

                            setUserInput(value);
                        }}
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

export default DeleteDataStore;
