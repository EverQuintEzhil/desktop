import { useAui, useAuiState } from '@assistant-ui/react';
import { useEffect, useRef, type RefObject } from 'react';

import type { MessageMetadataCustom } from '@/types/chat';

import { selectIsPausedOnApproval } from '../select-paused-on-approval';

import type { QueuedMessage } from './use-message-queue';

interface UseQueueDrainOptions {
    queue: QueuedMessage[];
    cancelQueued: (id: string) => void;
    conversationId: string | null;
    /** When true on the next run-end edge, drain even if the run was stopped (user "send now"). */
    forceNextDrainRef: RefObject<boolean>;
    backgroundReloadNonce?: number;
}

export const buildQueuedAppendMessage = (item: QueuedMessage) => ({
    role: 'user' as const,
    content: [{ type: 'text' as const, text: item.sendText }],
    attachments: item.attachments,
    metadata: { custom: { fileIds: item.fileIds } } satisfies MessageMetadataCustom,
});

export const useQueueDrain = ({
    queue,
    cancelQueued,
    conversationId,
    forceNextDrainRef,
    backgroundReloadNonce = 0,
}: UseQueueDrainOptions) => {
    const aui = useAui();
    const isRunning = useAuiState((s) => s.thread.isRunning);
    const isPausedOnApproval = useAuiState((s) => selectIsPausedOnApproval(s.thread.messages.at(-1)));
    const queueRef = useRef(queue);

    queueRef.current = queue;
    const prevIsRunningRef = useRef(isRunning);
    const prevReloadNonceRef = useRef(backgroundReloadNonce);
    const prevConversationIdRef = useRef(conversationId);

    useEffect(() => {
        const wasRunning = prevIsRunningRef.current;
        const previousReloadNonce = prevReloadNonceRef.current;
        const previousConversationId = prevConversationIdRef.current;

        prevIsRunningRef.current = isRunning;
        prevReloadNonceRef.current = backgroundReloadNonce;
        prevConversationIdRef.current = conversationId;

        // "Send now" stopped the run on purpose to push its message next; honor
        // it on this one edge, bypassing the error/pause gates below.
        const forced = forceNextDrainRef.current;

        forceNextDrainRef.current = false;

        // null → id is the same conversation being persisted after its first
        // turn. A real switch consumes the run-end edge without draining (the
        // queue is cleared separately) so a stale queued message can never be
        // posted into the newly opened conversation.
        if (previousConversationId !== null && previousConversationId !== conversationId) return;

        const runEnded = wasRunning && !isRunning;
        const backgroundReloaded = backgroundReloadNonce !== previousReloadNonce;

        if (isRunning) return;
        if (!runEnded && !backgroundReloaded) return;

        if (!forced) {
            if (isPausedOnApproval) return;

            const lastMessage = aui.thread.getState().messages.at(-1);
            const status = (lastMessage as { status?: { type?: string; reason?: string } } | undefined)?.status;

            // A run that settled in error keeps the queue paused instead of
            // burning through it; the next submit re-sends the head as a retry.
            if (status?.type === 'incomplete' && status.reason === 'error') return;
        }

        const next = queueRef.current[0];

        if (!next) return;

        cancelQueued(next.id);
        aui.thread.append(buildQueuedAppendMessage(next));
    }, [isRunning, backgroundReloadNonce, isPausedOnApproval, conversationId, aui, cancelQueued, forceNextDrainRef]);
};
