import React, { useState } from 'react';

import ConfirmationModal from '@/components/ui/confirmation-modal';
import { Input } from '@/components/ui/input';
import { useDeleteAgentMutation } from '@/lib/api/admin/agents';
import type { AgentType } from '@/types/admin';
import { showErrorToast } from '@/utils';

interface Props {
    onClose: () => void;
    isOpen: boolean;
    agent: AgentType;
    onDeleteSuccess?: () => void;
}

const DeleteAgent = (props: Props) => {
    const { onClose: onCloseProp, isOpen, agent, onDeleteSuccess } = props;

    const [userInput, setUserInput] = useState('');

    const deleteMutation = useDeleteAgentMutation();

    const onClose = () => {
        setUserInput('');
        onCloseProp();
    };

    const onDelete = async () => {
        try {
            await deleteMutation.mutateAsync({
                id: agent._id,
                force: agent.isDeleted,
                slug: agent.slug,
            });
            onDeleteSuccess?.();
            onClose();
        } catch (error) {
            const axiosError = error as { response?: { data?: { message?: string } } };

            showErrorToast(axiosError.response?.data?.message || 'Something went wrong. Please try again.');
        }
    };

    const isDisabled = deleteMutation.isPending || agent.name?.trim() !== userInput.trim();

    return (
        <ConfirmationModal
            isOpen={isOpen}
            onClose={onClose}
            title="Delete Agent"
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
                    title: isDisabled ? 'Need to match Name.' : undefined,
                    onClick: onDelete,
                },
            ]}
        >
            <div className="flex w-full flex-col gap-4">
                <span className="text-base font-normal text-foreground">
                    Are you sure you want to delete this agent?
                    {agent.isDeleted && ' This action will permanently remove the agent and all related data.'}
                </span>
                <div className="flex w-full flex-col gap-2">
                    <span className="text-sm leading-[1.43] font-medium text-muted-foreground">
                        To delete, please type agent name :
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

export default DeleteAgent;
