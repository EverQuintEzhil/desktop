import {
    ArrowUpIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    CircleIcon,
    PaperclipIcon,
    PencilIcon,
    Trash2Icon,
} from 'lucide-react';
import { useState } from 'react';

import DirectiveLabel from '@/components/chat/primitives/directive-label';
import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { cn } from '@/lib/utils';

import { useMentionSuggestions } from '../../hooks/use-mention-suggestions';
import { useChatViewContext } from '../chat-view-context';

import type { QueuedMessage } from './use-message-queue';

interface QueuedMessagesPanelProps {
    queue: QueuedMessage[];
    editingId?: string | null;
    onEdit: (item: QueuedMessage) => void;
    onSendNow: (item: QueuedMessage) => void;
    onRemove: (id: string) => void;
}

const QueuedMessagesPanel = ({ queue, editingId, onEdit, onSendNow, onRemove }: QueuedMessagesPanelProps) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const { agent } = useChatViewContext();
    const suggestions = useMentionSuggestions(agent);

    if (queue.length === 0) return null;

    const renderRowActions = (item: QueuedMessage) => (
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100">
            <SimpleTooltip content="Edit" side="top" sideOffset={6} disableHoverableContent>
                <Button
                    variant="ghost"
                    size="icon-xs"
                    className="rounded-full"
                    aria-label="Edit queued message"
                    onClick={() => onEdit(item)}
                >
                    <PencilIcon className="size-3.5" />
                </Button>
            </SimpleTooltip>
            <SimpleTooltip content="Send now" side="top" sideOffset={6} disableHoverableContent>
                <Button
                    variant="ghost"
                    size="icon-xs"
                    className="rounded-full"
                    aria-label="Send queued message now"
                    onClick={() => onSendNow(item)}
                >
                    <ArrowUpIcon className="size-3.5" />
                </Button>
            </SimpleTooltip>
            <SimpleTooltip content="Remove" side="top" sideOffset={6} disableHoverableContent>
                <Button
                    variant="ghost"
                    size="icon-xs"
                    className="rounded-full"
                    aria-label="Remove queued message"
                    onClick={() => onRemove(item.id)}
                >
                    <Trash2Icon className="size-3.5" />
                </Button>
            </SimpleTooltip>
        </div>
    );

    const renderRow = (item: QueuedMessage) => {
        const displayText = item.text || item.sendText;
        const attachmentCount = item.attachments?.length ?? 0;
        const isEditing = item.id === editingId;

        return (
            <div
                key={item.id}
                className={cn(
                    'group flex items-center gap-2 rounded-md px-3 py-1.5 hover:bg-accent/50',
                    isEditing && 'bg-accent/50 ring-1 ring-primary',
                )}
            >
                <CircleIcon className="size-3 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-sm">
                    {displayText ? <DirectiveLabel text={displayText} suggestions={suggestions} /> : 'Queued message'}
                </span>
                {attachmentCount > 0 && (
                    <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        <PaperclipIcon className="size-3" />
                        {attachmentCount}
                    </span>
                )}
                {renderRowActions(item)}
            </div>
        );
    };

    return (
        <div className="queued-messages-panel rounded-t-3xl border border-b-0 bg-card">
            <button
                type="button"
                className="flex w-full cursor-pointer items-center gap-1.5 rounded-t-3xl px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                aria-expanded={!isCollapsed}
                onClick={() => setIsCollapsed((v) => !v)}
            >
                {isCollapsed ? <ChevronRightIcon className="size-3.5" /> : <ChevronDownIcon className="size-3.5" />}
                {queue.length === 1 ? '1 Queued' : `${queue.length} Queued`}
            </button>
            {!isCollapsed && (
                <div className="scrollbar-vertical scrollbar-controller flex max-h-[15vh] flex-col px-1 pt-0.5 pb-1.5">
                    {queue.map(renderRow)}
                </div>
            )}
        </div>
    );
};

export default QueuedMessagesPanel;
