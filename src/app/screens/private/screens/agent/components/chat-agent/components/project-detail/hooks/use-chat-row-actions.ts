import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import type { useProject } from '@/components/agent-chat/hooks/use-projects';
import { projectsKeys } from '@/components/agent-chat/hooks/use-projects';
import { appConversationApi } from '@/lib/api/app/conversation';
import { showErrorToast, showSuccessToast } from '@/utils';

type ProjectActions = ReturnType<typeof useProject>['actions'];

interface UseChatRowActionsOptions {
    agentId: string;
    projectId?: string;
    actions: ProjectActions;
    favoriteConversation: (chatId: string) => Promise<unknown>;
}

/** State and handlers backing every per-chat-row action: pin, rename, delete, remove, visibility, change space. */
export const useChatRowActions = ({ agentId, projectId, actions, favoriteConversation }: UseChatRowActionsOptions) => {
    const queryClient = useQueryClient();
    const [chatRename, setChatRename] = useState<{ id: string; title: string } | null>(null);
    const [chatRenameValue, setChatRenameValue] = useState('');
    const [chatDeleteId, setChatDeleteId] = useState<string | null>(null);
    const [chatRemoveId, setChatRemoveId] = useState<string | null>(null);
    const [changingChatSpaceId, setChangingChatSpaceId] = useState<string | null>(null);
    const [pendingVisibility, setPendingVisibility] = useState<{ id: string; isPublic: boolean } | null>(null);
    const [pendingPin, setPendingPin] = useState<{ id: string; favorited: boolean; source: 'button' | 'menu' } | null>(
        null,
    );
    const [openMenuChatId, setOpenMenuChatId] = useState<string | null>(null);
    const [isChatActioning, setIsChatActioning] = useState(false);

    const invalidateChats = () =>
        queryClient.invalidateQueries({
            queryKey: projectsKeys.conversations(agentId, projectId ?? ''),
        });

    const openChatRename = (chatId: string, title: string) => {
        setChatRenameValue(title);
        setChatRename({ id: chatId, title });
    };

    const submitChatRename = async () => {
        if (!chatRename) return;
        const title = chatRenameValue.trim();

        if (!title || title === chatRename.title) {
            setChatRename(null);

            return;
        }

        setIsChatActioning(true);
        try {
            await actions.renameChat(chatRename.id, title);
            setChatRename(null);
        } catch {
            showErrorToast('Failed to rename chat');
        } finally {
            setIsChatActioning(false);
        }
    };

    const confirmChatDelete = async () => {
        if (!chatDeleteId) return;

        setIsChatActioning(true);
        try {
            await actions.deleteChat(chatDeleteId);
            setChatDeleteId(null);
        } catch {
            showErrorToast('Failed to delete chat');
        } finally {
            setIsChatActioning(false);
        }
    };

    const confirmChatRemove = async () => {
        if (!chatRemoveId) return;

        setIsChatActioning(true);
        try {
            await actions.removeChatFromProject(chatRemoveId);
            setChatRemoveId(null);
        } catch {
            showErrorToast('Failed to remove chat from space');
        } finally {
            setIsChatActioning(false);
        }
    };

    const handleToggleChatPin = async (chatId: string, currentFavorited: boolean, source: 'button' | 'menu') => {
        if (pendingPin) return;

        setPendingPin({ id: chatId, favorited: !currentFavorited, source });
        try {
            await favoriteConversation(chatId);
            // Await the refetch before clearing pendingPin so the icon doesn't flicker to the stale state.
            await invalidateChats();
        } catch {
            showErrorToast('Failed to update pin');
        } finally {
            setPendingPin(null);
        }
    };

    // Move a chat to a different space (or remove it when the current space is toggled off).
    // Either way the chat leaves this space, so the "Your chats" list refetches without it.
    const handleChangeChatSpace = async (chatId: string, targetProjectId: string | null) => {
        if (changingChatSpaceId) return;

        setChangingChatSpaceId(chatId);
        try {
            if (targetProjectId && targetProjectId !== projectId) {
                await actions.moveChatToProject(chatId, targetProjectId);
                showSuccessToast('Moved to selected space successfully');
            } else {
                await actions.removeChatFromProject(chatId);
                showSuccessToast('Removed from space');
            }
        } catch {
            showErrorToast('Failed to change space');
        } finally {
            setChangingChatSpaceId(null);
        }
    };

    const handleToggleChatVisibility = async (chatId: string, currentIsPublic: boolean) => {
        if (pendingVisibility) return;

        const nextIsPublic = !currentIsPublic;

        setPendingVisibility({ id: chatId, isPublic: nextIsPublic });
        try {
            await appConversationApi.updateConversation(chatId, { isPublic: nextIsPublic }, { agentId });
        } catch {
            showErrorToast('Failed to update sharing');
            setPendingVisibility(null);

            return;
        }

        // The write succeeded — a later refetch failure shouldn't read as a failed update.
        showSuccessToast(nextIsPublic ? 'Chat is now public' : 'Chat is now private');
        // Await the refetch before clearing so the label doesn't flicker to the stale state.
        await invalidateChats().catch(() => {});
        setPendingVisibility(null);
    };

    return {
        chatRename,
        setChatRename,
        chatRenameValue,
        setChatRenameValue,
        chatDeleteId,
        setChatDeleteId,
        chatRemoveId,
        setChatRemoveId,
        changingChatSpaceId,
        pendingVisibility,
        pendingPin,
        openMenuChatId,
        setOpenMenuChatId,
        isChatActioning,
        openChatRename,
        submitChatRename,
        confirmChatDelete,
        confirmChatRemove,
        handleToggleChatPin,
        handleChangeChatSpace,
        handleToggleChatVisibility,
    };
};
