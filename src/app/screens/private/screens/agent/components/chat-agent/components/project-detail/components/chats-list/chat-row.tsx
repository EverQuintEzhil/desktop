import {
    CalendarClockIcon,
    FolderMinusIcon,
    GlobeIcon,
    LockIcon,
    MoreHorizontalIcon,
    PencilIcon,
    PinIcon,
    PinOffIcon,
    Trash2Icon,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import ConversationStatusIndicator from '@/app/components/conversation-status-indicator';
import AddToProjectMenu from '@/app/screens/private/screens/agent/components/chat-agent/components/chat/chat-side-bar/add-to-project-menu';
import { Button } from '@/components/ui/button';
import {
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRoot,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Spinner from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ChatAgentType } from '@/types/admin';
import type { ProjectChatType } from '@/types/project';

import ExportConversationMenu from '../../../export-conversation-menu';
import { ROW_HOVER_CLASS_NAME } from '../../constants';
import { formatShortDate } from '../../utils/format-short-date';

export interface PendingPin {
    id: string;
    favorited: boolean;
    source: 'button' | 'menu';
}

export interface PendingVisibility {
    id: string;
    isPublic: boolean;
}

export interface Props {
    agent: ChatAgentType;
    chat: ProjectChatType;
    projectId?: string;
    isRoutineRun?: boolean;
    pendingPin: PendingPin | null;
    pendingVisibility: PendingVisibility | null;
    openMenuChatId: string | null;
    changingChatSpaceId: string | null;
    onOpenMenuChange: (chatId: string, open: boolean) => void;
    onTogglePin: (chatId: string, currentFavorited: boolean, source: 'button' | 'menu') => void;
    onOpenRename: (chatId: string, title: string) => void;
    onToggleVisibility: (chatId: string, currentIsPublic: boolean) => void;
    onChangeSpace: (chatId: string, targetProjectId: string | null) => void;
    onRemove: (chatId: string) => void;
    onDelete: (chatId: string) => void;
}

const ChatRow = ({
    agent,
    chat,
    projectId,
    isRoutineRun,
    pendingPin,
    pendingVisibility,
    openMenuChatId,
    changingChatSpaceId,
    onOpenMenuChange,
    onTogglePin,
    onOpenRename,
    onToggleVisibility,
    onChangeSpace,
    onRemove,
    onDelete,
}: Props) => {
    const isPinning = pendingPin?.id === chat._id;
    const favorited = isPinning ? pendingPin.favorited : chat.favorited;
    const isChangingVisibility = pendingVisibility?.id === chat._id;
    const isPublic = isChangingVisibility ? pendingVisibility.isPublic : chat.isPublic;
    const isChangingSpace = changingChatSpaceId === chat._id;

    // Show this button only when the pin button itself triggered the change; hide it while a
    // menu-triggered change is pending or the options menu is open. The disabled:opacity-0
    // override is required to beat the Button's own disabled:opacity-50.
    // Below md the row actions stay visible — touch layouts have no hover to reveal them.
    let pinButtonVisibilityClass = 'opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100';

    if (isPinning) {
        pinButtonVisibilityClass = pendingPin?.source === 'button' ? 'opacity-100' : 'opacity-0 disabled:opacity-0';
    } else if (openMenuChatId === chat._id) {
        pinButtonVisibilityClass = 'opacity-0';
    }

    return (
        <li
            className={cn(
                'group flex items-center gap-3 border-t border-border-secondary px-4 py-3 first:border-t-0',
                ROW_HOVER_CLASS_NAME,
            )}
        >
            <ConversationStatusIndicator status={chat.status} showSettled />
            <Link
                to={`/agent/${agent.slug}/chat/${chat._id}`}
                className="flex min-w-0 flex-1 flex-col gap-0.5 text-foreground no-underline"
            >
                <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-foreground! transition-colors group-hover:text-primary!">
                        {chat.title}
                    </span>
                    {isRoutineRun && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span
                                    aria-label="Routine run"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                    }}
                                    className="inline-flex size-5 shrink-0 cursor-default items-center justify-center rounded-full bg-primary/10 text-primary"
                                >
                                    <CalendarClockIcon className="size-3" aria-hidden />
                                </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">Scheduled &middot; written by a routine</TooltipContent>
                        </Tooltip>
                    )}
                    {isPublic && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span
                                    aria-label="Shared chat"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                    }}
                                    className="inline-flex size-5 shrink-0 cursor-default items-center justify-center rounded-full bg-primary/10 text-primary"
                                >
                                    <GlobeIcon className="size-3" aria-hidden />
                                </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">Public &middot; shared to others</TooltipContent>
                        </Tooltip>
                    )}
                </span>
                <span className="text-xs text-muted-foreground">Last message {formatShortDate(chat.updatedAt)}</span>
            </Link>
            <div className="flex shrink-0 items-center gap-1">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={favorited ? 'Unpin' : 'Pin'}
                            disabled={isPinning}
                            onClick={() => onTogglePin(chat._id, Boolean(chat.favorited), 'button')}
                            className={cn('shrink-0 rounded-full transition-opacity', pinButtonVisibilityClass)}
                        >
                            {favorited ? <PinOffIcon /> : <PinIcon />}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">{favorited ? 'Unpin' : 'Pin'}</TooltipContent>
                </Tooltip>
                <DropdownMenuRoot onOpenChange={(open) => onOpenMenuChange(chat._id, open)}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label="Chat options"
                                    disabled={isChangingSpace}
                                    className={cn(
                                        'shrink-0 rounded-full transition-opacity data-[state=open]:opacity-100',
                                        isChangingSpace
                                            ? 'opacity-100'
                                            : 'opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100',
                                    )}
                                >
                                    {isChangingSpace ? <Spinner /> : <MoreHorizontalIcon />}
                                </Button>
                            </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Chat options</TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent align="end" side="bottom">
                        <DropdownMenuItem
                            className="cursor-pointer"
                            disabled={isPinning}
                            onClick={(e) => {
                                e.preventDefault();
                                onTogglePin(chat._id, Boolean(chat.favorited), 'menu');
                            }}
                        >
                            {favorited ? <PinOffIcon className="size-3.5" /> : <PinIcon className="size-3.5" />}
                            {favorited ? 'Unpin' : 'Pin'}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer" onClick={() => onOpenRename(chat._id, chat.title)}>
                            <PencilIcon className="size-3.5" />
                            Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            className="cursor-pointer"
                            disabled={isChangingVisibility}
                            onClick={(e) => {
                                e.preventDefault();
                                onToggleVisibility(chat._id, Boolean(chat.isPublic));
                            }}
                        >
                            {isPublic ? <LockIcon className="size-3.5" /> : <GlobeIcon className="size-3.5" />}
                            {isPublic ? 'Make private' : 'Make public'}
                        </DropdownMenuItem>
                        <AddToProjectMenu
                            agentId={agent._id}
                            selectedProjectId={projectId}
                            label="Change space"
                            onSelect={(target) => onChangeSpace(chat._id, target)}
                        />
                        <DropdownMenuItem className="cursor-pointer" onClick={() => onRemove(chat._id)}>
                            <FolderMinusIcon className="size-3.5" />
                            Remove from space
                        </DropdownMenuItem>
                        <ExportConversationMenu agentId={agent._id} conversationId={chat._id} title={chat.title} />
                        <DropdownMenuItem
                            variant="destructive"
                            className="cursor-pointer"
                            onClick={() => onDelete(chat._id)}
                        >
                            <Trash2Icon className="size-3.5" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenuRoot>
            </div>
        </li>
    );
};

export default ChatRow;
