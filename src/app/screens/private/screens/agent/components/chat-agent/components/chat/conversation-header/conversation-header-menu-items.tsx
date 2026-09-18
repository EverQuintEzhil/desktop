import { useQueryClient } from '@tanstack/react-query';
import { FolderMinusIcon, PencilIcon, PinIcon, PinOffIcon, XIcon } from 'lucide-react';
import { useState } from 'react';

import useConversationHistory from '@/components/agent-chat/hooks/use-conversation-history';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogBody,
    DialogClose,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import type { ChatAgentType } from '@/types/admin';
import { showErrorToast } from '@/utils';

import { getConversationMetaQueryKey, useConversationMeta } from '../../../hooks/use-conversation-meta';
import { useConversationSpaceMove } from '../../../hooks/use-conversation-space-move';
import ExportConversationMenu from '../../export-conversation-menu';
import AddToProjectMenu from '../chat-side-bar/add-to-project-menu';

import { useProjectName } from './use-project-name';

interface Props {
    agent: ChatAgentType;
    conversationId: string;
}

const ConversationHeaderMenuItems = ({ agent, conversationId }: Props) => {
    const queryClient = useQueryClient();
    const { favoriteConversation, renameConversation } = useConversationHistory(agent);
    const { favorited, projectId, title } = useConversationMeta(agent._id, conversationId);
    const spaceName = useProjectName(projectId);

    const [isRenameOpen, setIsRenameOpen] = useState(false);
    const [renameValue, setRenameValue] = useState('');
    const [isRenaming, setIsRenaming] = useState(false);

    const metaQueryKey = getConversationMetaQueryKey(agent._id, conversationId);

    const handleTogglePin = async () => {
        try {
            await favoriteConversation(conversationId);
            queryClient.invalidateQueries({ queryKey: metaQueryKey });
        } catch {
            showErrorToast(favorited ? 'Failed to unpin conversation' : 'Failed to pin conversation');
        }
    };

    const handleMoveToProject = useConversationSpaceMove(agent._id, conversationId);

    const openRenameDialog = () => {
        setRenameValue(title);
        setIsRenameOpen(true);
    };

    const handleRenameSave = async () => {
        const trimmed = renameValue.trim();

        if (!trimmed) return;

        setIsRenaming(true);
        try {
            await renameConversation(conversationId, trimmed);
            queryClient.invalidateQueries({ queryKey: metaQueryKey });
            setIsRenameOpen(false);
        } catch {
            showErrorToast('Failed to rename conversation');
        } finally {
            setIsRenaming(false);
        }
    };

    const renderSpaceItems = () => {
        if (!agent.uiConfig.spaces?.enabled) return null;

        return (
            <>
                <AddToProjectMenu
                    agentId={agent._id}
                    selectedProjectId={projectId ?? undefined}
                    label={projectId ? 'Change space' : 'Add to space'}
                    onSelect={handleMoveToProject}
                />
                {projectId ? (
                    <DropdownMenuItem className="cursor-pointer" onClick={() => handleMoveToProject(null)}>
                        <FolderMinusIcon className="size-3.5" />
                        {spaceName ? `Remove from ${spaceName}` : 'Remove from space'}
                    </DropdownMenuItem>
                ) : null}
            </>
        );
    };

    return (
        <>
            <DropdownMenuItem className="cursor-pointer" onClick={handleTogglePin}>
                {favorited ? <PinOffIcon className="size-3.5" /> : <PinIcon className="size-3.5" />}
                {favorited ? 'Unpin' : 'Pin'}
            </DropdownMenuItem>
            <DropdownMenuItem
                className="cursor-pointer"
                onSelect={(e) => {
                    e.preventDefault();
                    openRenameDialog();
                }}
            >
                <PencilIcon className="size-3.5" />
                Rename
            </DropdownMenuItem>
            {renderSpaceItems()}
            <ExportConversationMenu agentId={agent._id} conversationId={conversationId} title={title} />

            <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
                <DialogContent className="max-w-[440px]">
                    <DialogClose asChild>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="absolute top-3 right-3"
                            aria-label="Close"
                        >
                            <XIcon />
                        </Button>
                    </DialogClose>
                    <DialogHeader className="min-h-[50px] justify-center pr-8">
                        <DialogTitle>Rename conversation</DialogTitle>
                    </DialogHeader>
                    <DialogBody className="py-4">
                        <Input
                            autoFocus
                            value={renameValue}
                            disabled={isRenaming}
                            placeholder="Conversation title"
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenameSave();
                            }}
                        />
                    </DialogBody>
                    <DialogFooter className="justify-end">
                        <Button variant="secondary" size="sm" onClick={() => setIsRenameOpen(false)}>
                            Cancel
                        </Button>
                        <Button size="sm" disabled={isRenaming || !renameValue.trim()} onClick={handleRenameSave}>
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default ConversationHeaderMenuItems;
