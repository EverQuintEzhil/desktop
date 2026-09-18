import { type RefObject, useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import type { ConversationAdapter } from '@/components/chat-host';
import { getDefaultToastOptions } from '@/utils/toast-theme';

interface UseShareConversationParams {
    conversationId: string | null;
    conversationsRef: RefObject<ConversationAdapter>;
}

export interface UseShareConversationResult {
    isShareModalOpen: boolean;
    openShare: () => void;
    closeShare: () => void;
    isConversationPublic: boolean;
    isShareStateLoading: boolean;
    isShareUpdating: boolean;
    handleSetVisibility: (nextIsPublic: boolean) => Promise<boolean>;
    resetOnConversationChange: () => void;
}

/** Owns the share modal's open state and the conversation's public/private visibility. */
const useShareConversation = ({
    conversationId,
    conversationsRef,
}: UseShareConversationParams): UseShareConversationResult => {
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [isShareUpdating, setIsShareUpdating] = useState(false);
    const [isShareStateLoading, setIsShareStateLoading] = useState(false);
    const [isConversationPublic, setIsConversationPublic] = useState(false);

    useEffect(() => {
        if (!isShareModalOpen || !conversationId) return;

        let cancelled = false;

        setIsShareStateLoading(true);
        conversationsRef.current
            .getConversation(conversationId)
            .then((raw) => {
                if (cancelled) return;
                const record = (raw ?? {}) as { is_public?: boolean; isPublic?: boolean };

                setIsConversationPublic(Boolean(record.is_public ?? record.isPublic));
            })
            .catch((error) => {
                console.error('Failed to load conversation sharing state', error);
            })
            .finally(() => {
                if (!cancelled) setIsShareStateLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [isShareModalOpen, conversationId, conversationsRef]);

    const handleSetVisibility = useCallback(
        async (nextIsPublic: boolean): Promise<boolean> => {
            if (!conversationId) return false;
            if (nextIsPublic === isConversationPublic) return true;

            const previous = isConversationPublic;

            setIsConversationPublic(nextIsPublic);
            setIsShareUpdating(true);
            try {
                await conversationsRef.current.updateConversation(conversationId, { isPublic: nextIsPublic });

                if (!nextIsPublic) {
                    toast('Chat set to private', {
                        ...getDefaultToastOptions(),
                        description: 'Only you have access',
                    });
                }

                return true;
            } catch (error) {
                console.error('Failed to update conversation sharing', error);
                setIsConversationPublic(previous);
                toast.error('Failed to update sharing. Please try again.');

                return false;
            } finally {
                setIsShareUpdating(false);
            }
        },
        [conversationId, isConversationPublic, conversationsRef],
    );

    const resetOnConversationChange = useCallback(() => {
        setIsShareModalOpen(false);
    }, []);

    const openShare = useCallback(() => {
        if (!conversationId) return;

        setIsShareModalOpen(true);
    }, [conversationId]);

    const closeShare = useCallback(() => {
        setIsShareModalOpen(false);
    }, []);

    return {
        isShareModalOpen,
        openShare,
        closeShare,
        isConversationPublic,
        isShareStateLoading,
        isShareUpdating,
        handleSetVisibility,
        resetOnConversationChange,
    };
};

export default useShareConversation;
