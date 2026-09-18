import { CopyIcon, PencilIcon, TrashIcon } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import ConfirmationModal from '@/components/ui/confirmation-modal';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { useCloneAgentMutation } from '@/lib/api/admin/agents';
import type { AgentType } from '@/types/admin';

import AddAgent from '../../../add-agent';
import DeleteAgent from '../../../delete-agent';

interface Props {
    agent: AgentType;
    canUserEdit: boolean;
    canUserDelete: boolean;
    canUserClone: boolean;
}

const AgentActions = (props: Props) => {
    const { agent, canUserEdit, canUserDelete, canUserClone } = props;
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isCloneConfirmationModalOpen, setIsCloneConfirmationModalOpen] = useState<AgentType | null>(null);

    const cloneMutation = useCloneAgentMutation();

    const onConfirmClick = async () => {
        try {
            const clonedAgent = await cloneMutation.mutateAsync(isCloneConfirmationModalOpen!._id);

            setIsCloneConfirmationModalOpen(null);
            navigate(`/admin/agents/${clonedAgent.slug}`);
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <>
            <div className="agent-actions flex items-center gap-2">
                {canUserClone && (
                    <SimpleTooltip content="Clone" side="bottom">
                        <Button
                            variant="secondary"
                            size="icon-xs"
                            onClick={() => setIsCloneConfirmationModalOpen(agent)}
                        >
                            <CopyIcon />
                        </Button>
                    </SimpleTooltip>
                )}
                {canUserEdit && (
                    <SimpleTooltip content="Edit" side="bottom">
                        <Button variant="secondary" size="icon-xs" onClick={() => setIsOpen(true)}>
                            <PencilIcon />
                        </Button>
                    </SimpleTooltip>
                )}
                {canUserDelete && (
                    <SimpleTooltip content="Delete" side="bottom">
                        <Button variant="destructive" size="icon-xs" onClick={() => setIsDeleteModalOpen(true)}>
                            <TrashIcon />
                        </Button>
                    </SimpleTooltip>
                )}
            </div>
            {isOpen && <AddAgent isOpen={isOpen} onClose={() => setIsOpen(false)} agent={agent} />}
            {isDeleteModalOpen && (
                <DeleteAgent
                    isOpen={isDeleteModalOpen}
                    onClose={() => setIsDeleteModalOpen(false)}
                    onDeleteSuccess={() => navigate('/admin/agents')}
                    agent={agent}
                />
            )}
            {isCloneConfirmationModalOpen && (
                <ConfirmationModal
                    isOpen
                    onClose={() => setIsCloneConfirmationModalOpen(null)}
                    onConfirm={onConfirmClick}
                    title="Clone Confirmation"
                    confirmButtonText="Confirm"
                    cancelButtonText="Cancel"
                    isButtonLoading={cloneMutation.isPending}
                >
                    <div className="mx-auto flex flex-col items-center justify-center text-center">
                        <span className="text-sm">
                            Are you sure you want to clone the agent - &apos;
                            {isCloneConfirmationModalOpen.name}
                            &apos; ?
                        </span>
                    </div>
                </ConfirmationModal>
            )}
        </>
    );
};

export default AgentActions;
