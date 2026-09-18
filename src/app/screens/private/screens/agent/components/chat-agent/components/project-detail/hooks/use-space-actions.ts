import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { useProject } from '@/components/agent-chat/hooks/use-projects';
import type { ChatAgentType } from '@/types/admin';
import { showErrorToast, showSuccessToast } from '@/utils';

type ProjectActions = ReturnType<typeof useProject>['actions'];

/** Space-level (as opposed to per-chat) edit / delete / pin state and handlers. */
export const useSpaceActions = (agent: ChatAgentType, actions: ProjectActions) => {
    const navigate = useNavigate();
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isPinningSpace, setIsPinningSpace] = useState(false);
    const [isShareOpen, setIsShareOpen] = useState(false);

    const openEdit = () => {
        setIsEditOpen(true);
    };

    const handlePin = async (pinnedAt: string | null | undefined) => {
        if (isPinningSpace) return;

        setIsPinningSpace(true);
        const wasPinned = Boolean(pinnedAt);

        try {
            await actions.pinProject();
            showSuccessToast(wasPinned ? 'Space unpinned' : 'Space pinned');
        } catch {
            showErrorToast(wasPinned ? 'Failed to unpin space' : 'Failed to pin space');
        } finally {
            setIsPinningSpace(false);
        }
    };

    const confirmDelete = async () => {
        setIsDeleting(true);
        try {
            await actions.deleteProject();
            setIsDeleteOpen(false);
            navigate(`/agent/${agent.slug}/spaces`);
        } catch {
            showErrorToast('Failed to delete space');
        } finally {
            setIsDeleting(false);
        }
    };

    return {
        isEditOpen,
        setIsEditOpen,
        isDeleteOpen,
        setIsDeleteOpen,
        isDeleting,
        isPinningSpace,
        isShareOpen,
        setIsShareOpen,
        openEdit,
        handlePin,
        confirmDelete,
    };
};
