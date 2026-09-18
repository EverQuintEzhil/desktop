import { Loader2Icon, PencilIcon } from 'lucide-react';
import type { RefObject } from 'react';

import type { ChatSlots } from '@/components/chat-host';
import type { TextAreaRef } from '@/components/text-area';
import { Button } from '@/components/ui/button';
import type { ChatAgentType } from '@/types/admin';

import type { HomeSubmitPayload } from '../../../types';
import ChatComposer from '../../agent-chat-composer';
import QueuedMessagesPanel from '../../message-queue/queued-messages-panel';
import type { QueuedMessage } from '../../message-queue/use-message-queue';

export interface ChatViewComposerSlotProps {
    agent: ChatAgentType;
    slots?: ChatSlots;
    isForeignConversation: boolean;
    isForkPending: boolean;
    canFork: boolean;
    onFork: () => void;
    isRunning: boolean;
    onSubmit: (payload: HomeSubmitPayload) => void;
    draft: string;
    onDraftChange: (value: string) => void;
    composerTextAreaRef: RefObject<TextAreaRef | null>;
    isEditingMessage: boolean;
    editingQueuedId: string | null;
    queue: QueuedMessage[];
    onEditQueued: (item: QueuedMessage) => void;
    onSendNowQueued: (item: QueuedMessage) => void;
    onCancelQueued: (id: string) => void;
    onCancelEditQueued: () => void;
    spaceMove?: {
        selectedProjectId?: string | null;
        onMove: (space: { _id: string; name: string } | null) => void;
    };
}

const renderForeignCta = (isForkPending: boolean, canFork: boolean, onFork: () => void) => (
    <div className="mx-auto w-full max-w-[810px] px-4 pb-8">
        <div className="flex justify-center">
            <Button className="rounded-full" onClick={onFork} disabled={isForkPending || !canFork}>
                {isForkPending && <Loader2Icon className="size-3.5 animate-spin" />}
                Continue in your own chat
            </Button>
        </div>
    </div>
);

/**
 * Renders the composer slot below the thread: the host's custom composer if
 * supplied, the "continue in your own chat" CTA for a foreign conversation, or the
 * default composer — optionally wrapped with the queued-messages panel.
 */
const ChatViewComposerSlot = ({
    agent,
    slots,
    isForeignConversation,
    isForkPending,
    canFork,
    onFork,
    isRunning,
    onSubmit,
    draft,
    onDraftChange,
    composerTextAreaRef,
    isEditingMessage,
    editingQueuedId,
    queue,
    onEditQueued,
    onSendNowQueued,
    onCancelQueued,
    onCancelEditQueued,
    spaceMove,
}: ChatViewComposerSlotProps) => {
    if (agent.uiConfig.chat?.followUp === false) return null;
    if (isForeignConversation) return renderForeignCta(isForkPending, canFork, onFork);

    if (slots?.renderComposer) {
        return slots.renderComposer({
            send: (message) => onSubmit({ message }),
            isRunning,
            isDisabled: isRunning,
        });
    }

    const hasExtras = queue.length > 0 || Boolean(editingQueuedId);
    const aboveComposer = slots?.renderAboveComposer?.();

    if (hasExtras) {
        return (
            <div className="queue-composer-wrap relative mx-auto w-full max-w-[810px] px-4 pb-4">
                {aboveComposer}
                <QueuedMessagesPanel
                    queue={queue}
                    editingId={editingQueuedId}
                    onEdit={onEditQueued}
                    onSendNow={onSendNowQueued}
                    onRemove={onCancelQueued}
                />
                <div className="queue-composer-shell relative z-10">
                    {editingQueuedId && (
                        <div className="queue-composer-editing flex items-center justify-between gap-2 px-4 py-2.5">
                            <span className="flex items-center gap-2 text-sm text-muted-foreground">
                                <PencilIcon className="size-3.5" />
                                Editing queued message
                            </span>
                            <Button
                                variant="ghost"
                                size="xs"
                                className="rounded-full text-primary"
                                onClick={onCancelEditQueued}
                            >
                                Cancel
                            </Button>
                        </div>
                    )}
                    <ChatComposer
                        agent={agent}
                        onSubmit={onSubmit}
                        value={draft}
                        onChange={onDraftChange}
                        textAreaRef={composerTextAreaRef}
                        plusDropdownSide="top"
                        showRunningControls
                        isEditingInProgress={isEditingMessage}
                        isEditingQueued={Boolean(editingQueuedId)}
                        enableHistoryHint
                        spaceMove={spaceMove}
                        autoFocus
                        wrapperClassName="textarea-wrapper"
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto w-full max-w-[810px] px-4 pb-4">
            {aboveComposer}
            <ChatComposer
                agent={agent}
                onSubmit={onSubmit}
                value={draft}
                onChange={onDraftChange}
                textAreaRef={composerTextAreaRef}
                plusDropdownSide="top"
                showRunningControls
                isEditingInProgress={isEditingMessage}
                enableHistoryHint
                spaceMove={spaceMove}
                autoFocus
                wrapperClassName="textarea-wrapper"
            />
        </div>
    );
};

export default ChatViewComposerSlot;
