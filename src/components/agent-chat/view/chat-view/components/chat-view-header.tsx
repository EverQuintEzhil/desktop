import { MoreHorizontalIcon, ShareIcon, Trash2Icon } from 'lucide-react';

import type { AgentLauncherSlot, ChatSlots } from '@/components/chat-host';
import { Button } from '@/components/ui/button';
import {
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRoot,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ChatAgentType } from '@/types/admin';

import { useChatShell } from '../../../context/chat-shell-context';
import { ChatFindBar, FindInChatButton, useFindContext } from '../../chat-find-bar';
import PreviewBackButton from '../../preview-back-button';

export interface ChatViewHeaderProps {
    agent: ChatAgentType;
    conversationId: string | null;
    slots?: ChatSlots;
    launcher: AgentLauncherSlot;
    headerClassName?: string;
    canManageConversation: boolean;
    isForeignConversation: boolean;
    onShare: () => void;
    onDeleteClick: () => void;
}

/** Default chat header: back button, launcher name/info, and the share/overflow menu — used when the host does not supply `slots.renderHeader`. */
const ChatViewHeader = ({
    agent,
    conversationId,
    slots,
    launcher,
    headerClassName,
    canManageConversation,
    isForeignConversation,
    onShare,
    onDeleteClick,
}: ChatViewHeaderProps) => {
    const agentMenuItems = slots?.useAgentMenuItems?.({ agent }) ?? null;
    const findContext = useFindContext();
    const { variant } = useChatShell();
    const isPanel = variant === 'panel';

    if (slots?.renderHeader) {
        return slots.renderHeader({ agent, conversationId });
    }

    const hasOverflowMenu = canManageConversation || Boolean(agentMenuItems);

    const conversationMenuItems =
        canManageConversation && conversationId
            ? (slots?.renderConversationMenuItems?.({ agent, conversationId }) ?? null)
            : null;

    const renderOverflowMenu = () => (
        <DropdownMenuRoot>
            <Tooltip>
                <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-xs" aria-label="More" className="shrink-0 rounded-full">
                            <MoreHorizontalIcon className="size-3.5" />
                        </Button>
                    </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom">More</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end">
                {conversationMenuItems}
                {agentMenuItems && conversationMenuItems && <DropdownMenuSeparator />}
                {agentMenuItems}
                {agentMenuItems && canManageConversation && <DropdownMenuSeparator />}
                {isPanel && canManageConversation && (
                    <DropdownMenuItem className="cursor-pointer" onClick={onShare}>
                        <ShareIcon className="size-3.5" />
                        Share
                    </DropdownMenuItem>
                )}
                {canManageConversation && (
                    <DropdownMenuItem variant="destructive" className="cursor-pointer" onClick={onDeleteClick}>
                        <Trash2Icon className="size-3.5" />
                        Delete
                    </DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenuRoot>
    );

    const renderFindBar = () => {
        if (!findContext?.isOpen) return null;

        const { find, focusRequest, close, hasMoreOlderMessages, isLoadingOlderMessages, onLoadOlderMessages } =
            findContext;

        return (
            <ChatFindBar
                find={find}
                onClose={close}
                focusRequest={focusRequest}
                hasMoreOlderMessages={hasMoreOlderMessages}
                isLoadingOlderMessages={isLoadingOlderMessages}
                onLoadOlderMessages={onLoadOlderMessages}
            />
        );
    };

    const isFindOpen = Boolean(findContext?.isOpen);

    const renderTitle = () => (
        <div className="header-title-left flex min-w-0 items-center gap-1.5">
            <PreviewBackButton />
            <div className="flex min-w-0 items-center gap-1.5">
                {!isPanel && (
                    <>
                        <h2 className="brand-name font-bold">{launcher.launcherName}</h2>
                        {launcher.renderInfoIcon && (
                            <SimpleTooltip content="Info" side="bottom">
                                {launcher.renderInfoIcon('shrink-0')}
                            </SimpleTooltip>
                        )}
                    </>
                )}
                {conversationId && slots?.renderConversationBadge?.({ agent, conversationId })}
            </div>
        </div>
    );

    // While find is open the same row is rendered again, hidden and inert, purely so
    // the find bar that covers it inherits the width of the buttons it replaced.
    const renderActions = (isGhost = false) => (
        <div
            className={cn(
                'header-title-right flex items-center gap-2',
                isPanel && 'ml-auto shrink-0',
                isGhost && 'invisible',
            )}
            aria-hidden={isGhost || undefined}
            inert={isGhost || undefined}
        >
            {conversationId && <FindInChatButton compact={isPanel} isPlaceholder={isGhost} />}
            {conversationId &&
                (canManageConversation || isForeignConversation) &&
                slots?.renderHeaderActions?.({ agent, conversationId })}
            {hasOverflowMenu && (
                <div className="home-header-actions flex items-center gap-2">
                    {!isPanel && canManageConversation && (
                        <Button variant="outline" size="xs" className="shrink-0 rounded-full" onClick={onShare}>
                            <ShareIcon className="size-3.5" />
                            <span className="max-lg:hidden">Share</span>
                        </Button>
                    )}
                    {renderOverflowMenu()}
                </div>
            )}
        </div>
    );

    return (
        <div className={cn('header-title z-10 flex min-w-0 items-center justify-between gap-2', headerClassName)}>
            {renderTitle()}
            {isFindOpen ? (
                <div className="header-find-slot relative flex shrink-0 items-center">
                    {renderActions(true)}
                    {/* Absolute so the taller bar overhangs into the header's own padding
                        instead of growing the row: the header height never changes. */}
                    <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center">
                        {renderFindBar()}
                    </div>
                </div>
            ) : (
                renderActions()
            )}
        </div>
    );
};

export default ChatViewHeader;
