import type { useAui } from '@assistant-ui/react';
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';

import { buildQuoteMarkdown } from '@/components/chat';
import type { TextAreaRef } from '@/components/text-area';
import type { MessageMetadataCustom } from '@/types/chat';

import type { HomeSubmitPayload } from '../../../types';
import { useMessageQueue, type QueuedMessage } from '../../message-queue/use-message-queue';
import { buildQueuedAppendMessage, useQueueDrain } from '../../message-queue/use-queue-drain';
import { selectIsPausedOnApproval } from '../../select-paused-on-approval';

interface UseChatQueueParams {
    aui: ReturnType<typeof useAui>;
    conversationId: string | null;
    pendingQuote: string | null;
    clearPendingQuote: () => void;
    clearDraft: () => void;
    onDraftChange: (text: string) => void;
    composerTextAreaRef: RefObject<TextAreaRef | null>;
    onStopGeneration?: () => void;
    isPendingGeneration?: boolean;
    backgroundReloadNonce?: number;
}

export interface UseChatQueueResult {
    queue: QueuedMessage[];
    editingQueuedId: string | null;
    cancelQueued: (id: string) => void;
    handleSubmit: (payload: HomeSubmitPayload) => void;
    submitWidgetMessage: (text: string) => void;
    handleEditQueued: (item: QueuedMessage) => void;
    handleCancelEditQueued: () => void;
    handleSendNowQueued: (item: QueuedMessage) => void;
}

/**
 * Owns the queued-messages panel state and the submit routing that decides whether a
 * message runs immediately, waits behind a running turn, or waits behind messages
 * already queued (a turn paused on a pending approval is abandoned instead of waited on).
 */
const useChatQueue = ({
    aui,
    conversationId,
    pendingQuote,
    clearPendingQuote,
    clearDraft,
    onDraftChange,
    composerTextAreaRef,
    onStopGeneration,
    isPendingGeneration = false,
    backgroundReloadNonce = 0,
}: UseChatQueueParams): UseChatQueueResult => {
    const { queue, enqueue, cancelQueued, promoteQueued, updateQueued, clearQueue } = useMessageQueue();
    const [editingQueuedId, setEditingQueuedId] = useState<string | null>(null);
    const queueRef = useRef(queue);
    const forceNextDrainRef = useRef(false);

    queueRef.current = queue;
    useQueueDrain({
        queue,
        cancelQueued,
        conversationId,
        forceNextDrainRef,
        backgroundReloadNonce,
    });

    // If the message being edited leaves the queue (drained/removed), drop the
    // editing banner; the composer keeps its text so it can still be sent.
    useEffect(() => {
        if (editingQueuedId && !queue.some((message) => message.id === editingQueuedId)) {
            setEditingQueuedId(null);
        }
    }, [queue, editingQueuedId]);

    const prevQueueConversationIdRef = useRef(conversationId);

    // null → id is the same conversation being persisted after its first turn;
    // only a real switch drops the queue.
    useEffect(() => {
        const previous = prevQueueConversationIdRef.current;

        prevQueueConversationIdRef.current = conversationId;

        if (previous === null || previous === conversationId) return;
        clearQueue();
    }, [conversationId, clearQueue]);

    const submitOrQueue = useCallback(
        (item: Omit<QueuedMessage, 'id'>) => {
            const thread = aui.thread;
            const threadState = thread.getState();
            const isPausedOnApproval = selectIsPausedOnApproval(threadState.messages.at(-1));

            if (threadState.isRunning) {
                enqueue(item);

                return;
            }

            // Sending abandons a turn that is waiting on an approval, so it has to be
            // marked interrupted (same signal as the Stop button) before the append —
            // the runtime cancels the pending tool call as part of accepting it.
            if (isPausedOnApproval) {
                onStopGeneration?.();
                thread.cancelRun();
            } else if (isPendingGeneration) {
                // The pending-generation poll can go stale-true while paused on
                // approval, so it's only trusted once we know that isn't the case.
                enqueue(item);

                return;
            }

            // Messages can be waiting while the thread is idle (abandoned approval
            // pause or a failed run). A direct append would run before them, so
            // enqueue behind them and re-send the head.
            if (queueRef.current.length > 0) {
                enqueue(item);

                const head = queueRef.current[0];

                if (head) {
                    cancelQueued(head.id);
                    thread.append(buildQueuedAppendMessage(head));
                }

                return;
            }

            thread.append({
                role: 'user',
                content: [{ type: 'text', text: item.sendText }],
                attachments: item.attachments,
                metadata: { custom: { fileIds: item.fileIds } } satisfies MessageMetadataCustom,
            });
        },
        [aui, enqueue, cancelQueued, isPendingGeneration, onStopGeneration],
    );

    const handleSubmit = useCallback(
        (payload: HomeSubmitPayload) => {
            const messageText = pendingQuote
                ? `${buildQuoteMarkdown(pendingQuote)}${payload.message}`.trimEnd()
                : payload.message;

            const finishSubmit = () => {
                clearPendingQuote();
                clearDraft();
                composerTextAreaRef.current?.focus();
            };

            // Saving an edit updates the queued item in place, preserving its order.
            if (editingQueuedId) {
                if (queueRef.current.some((message) => message.id === editingQueuedId)) {
                    updateQueued(editingQueuedId, { text: payload.message, sendText: messageText });
                    setEditingQueuedId(null);
                    finishSubmit();

                    return;
                }
                setEditingQueuedId(null);
            }

            submitOrQueue({
                text: payload.message,
                sendText: messageText,
                attachments: payload.attachments,
                fileIds: payload.fileIds || [],
            });
            finishSubmit();
        },
        [
            pendingQuote,
            clearPendingQuote,
            clearDraft,
            composerTextAreaRef,
            updateQueued,
            editingQueuedId,
            submitOrQueue,
        ],
    );

    const submitWidgetMessage = useCallback(
        (text: string) => {
            submitOrQueue({
                text,
                sendText: text,
                attachments: undefined,
                fileIds: [],
            });
        },
        [submitOrQueue],
    );

    const handleEditQueued = useCallback(
        (item: QueuedMessage) => {
            const text = item.text || item.sendText;

            setEditingQueuedId(item.id);
            onDraftChange(text);
            composerTextAreaRef.current?.changeText(text);
            composerTextAreaRef.current?.focusAtEnd();
        },
        [onDraftChange, composerTextAreaRef],
    );

    const handleCancelEditQueued = useCallback(() => {
        setEditingQueuedId(null);
        onDraftChange('');
        composerTextAreaRef.current?.changeText('');
    }, [onDraftChange, composerTextAreaRef]);

    const handleSendNowQueued = useCallback(
        (item: QueuedMessage) => {
            const thread = aui.thread;
            const threadState = thread.getState();

            if (threadState.isRunning) {
                // Cancel the in-flight generation and send this one next: promote it,
                // flag a forced drain, then stop the run so the drain fires on the edge.
                // onStopGeneration marks the interrupted message (shared with the Stop button).
                promoteQueued(item.id);
                forceNextDrainRef.current = true;
                onStopGeneration?.();
                thread.cancelRun();

                return;
            }

            // A paused turn never reaches a run-end edge, so a forced drain would never
            // fire; abandon it (marked interrupted, as the Stop button does) and append
            // this item straight away. Anything still queued drains behind its run.
            if (selectIsPausedOnApproval(threadState.messages.at(-1))) {
                onStopGeneration?.();
                thread.cancelRun();
                cancelQueued(item.id);
                thread.append(buildQueuedAppendMessage(item));

                return;
            }

            cancelQueued(item.id);
            thread.append(buildQueuedAppendMessage(item));
        },
        [aui, promoteQueued, cancelQueued, onStopGeneration],
    );

    return {
        queue,
        editingQueuedId,
        cancelQueued,
        handleSubmit,
        submitWidgetMessage,
        handleEditQueued,
        handleCancelEditQueued,
        handleSendNowQueued,
    };
};

export default useChatQueue;
