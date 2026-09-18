import { ActionBarMorePrimitive, ActionBarPrimitive, useAuiState } from '@assistant-ui/react';
import { format, isToday, isYesterday } from 'date-fns';
import {
    CircleDollarSign,
    CircleMinus,
    GitBranchIcon,
    Loader2Icon,
    MoreHorizontalIcon,
    TelescopeIcon,
    ThumbsDownIcon,
    ThumbsUpIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

import MessageCopyButton from '@/components/chat/primitives/message-copy-button';
import MessageCopyFormattedButton from '@/components/chat/primitives/message-copy-formatted-button';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import { MENU_ITEM_CLASS, MENU_CONTENT_CLASS } from './action-menu-styles';
import { RegenerateMenu, type RegenerateModel } from './regenerate-menu';

const formatMessageTime = (isoString: string): string => {
    const date = new Date(isoString);

    if (isToday(date)) return `Today, ${format(date, 'h:mm a')}`;
    if (isYesterday(date)) return `Yesterday, ${format(date, 'h:mm a')}`;

    return format(date, 'MMM d, h:mm a');
};

export interface AssistantActionsFeedback {
    isLiked: boolean;
    isDisliked: boolean;
    isPending: boolean;
    onFeedback: (liked: boolean, disliked: boolean) => void;
}

export interface AssistantActionsRegenerate {
    models?: RegenerateModel[];
}

export interface AssistantActionsBranch {
    isPending: boolean;
    onBranch: () => void;
}

export interface AssistantActionsUsage {
    onShow: () => void;
}

interface AssistantActionsProps {
    copy?: boolean;
    copyTooltip?: string;
    copyFormatted?: boolean;
    feedback?: AssistantActionsFeedback;
    regenerate?: AssistantActionsRegenerate;
    branch?: AssistantActionsBranch;
    usage?: AssistantActionsUsage;
    messageCreatedAt?: string;
    interrupted?: boolean;
    deepResearch?: boolean;
    leading?: ReactNode;
    trailing?: ReactNode;
    autohide?: 'always' | 'not-last';
    hideLastWhileRunning?: boolean;
    className?: string;
}

export const AssistantActions = ({
    copy = true,
    copyTooltip = 'Copy as markdown',
    copyFormatted = false,
    feedback,
    regenerate,
    branch,
    usage,
    messageCreatedAt,
    interrupted = false,
    deepResearch = false,
    leading,
    trailing,
    autohide = 'not-last',
    hideLastWhileRunning = true,
    className,
}: AssistantActionsProps) => {
    const isRunning = useAuiState((s) => s.thread.isRunning);
    const isLast = useAuiState((s) => s.message.isLast);

    // Sibling of the action bar, never a child: ActionBarPrimitive.Root unmounts its
    // subtree when autohide applies, and a provenance label must not be hover-gated.
    const deepResearchTag = deepResearch ? (
        <span className="deep-research-tag flex items-center gap-1.5 text-sm text-muted-foreground">
            <TelescopeIcon className="size-4" aria-hidden />
            Deep Research
        </span>
    ) : null;

    // The tag is provenance on a finished answer. Shown mid-run it is the only thing under
    // "Generating", which reads as a status the run never claimed.
    if (hideLastWhileRunning && isRunning && isLast) return null;

    const renderFeedback = () => {
        if (!feedback) return null;

        return (
            <>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            size="icon-xs"
                            variant="ghost"
                            className="justify-center"
                            disabled={feedback.isPending}
                            onClick={() => feedback.onFeedback(true, false)}
                            aria-label="Like this response"
                        >
                            <ThumbsUpIcon fill={feedback.isLiked ? 'currentColor' : 'none'} />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="pointer-events-none">
                        Good response
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            size="icon-xs"
                            variant="ghost"
                            className="justify-center"
                            disabled={feedback.isPending}
                            onClick={() => feedback.onFeedback(false, true)}
                            aria-label="Dislike this response"
                        >
                            <ThumbsDownIcon fill={feedback.isDisliked ? 'currentColor' : 'none'} />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="pointer-events-none">
                        Bad response
                    </TooltipContent>
                </Tooltip>
            </>
        );
    };

    const renderMore = () => {
        if (!usage && !branch) return null;

        return (
            <ActionBarMorePrimitive.Root>
                <ActionBarMorePrimitive.Trigger asChild>
                    <Button
                        size="icon-xs"
                        variant="ghost"
                        className="justify-center"
                        aria-label="More actions"
                        title="More actions"
                    >
                        <MoreHorizontalIcon />
                    </Button>
                </ActionBarMorePrimitive.Trigger>
                <ActionBarMorePrimitive.Content align="start" className={MENU_CONTENT_CLASS}>
                    {messageCreatedAt && (
                        <p className="px-2 py-1.5 text-xs text-muted-foreground">
                            {formatMessageTime(messageCreatedAt)}
                        </p>
                    )}
                    {usage ? (
                        <ActionBarMorePrimitive.Item className={MENU_ITEM_CLASS} onSelect={usage.onShow}>
                            <CircleDollarSign className="size-3.5" />
                            AI Usage
                        </ActionBarMorePrimitive.Item>
                    ) : null}
                    {branch ? (
                        <ActionBarMorePrimitive.Item
                            className={MENU_ITEM_CLASS}
                            disabled={branch.isPending}
                            onSelect={(e) => {
                                e.preventDefault();
                                branch.onBranch();
                            }}
                        >
                            {branch.isPending ? (
                                <Loader2Icon className="size-3.5 animate-spin" />
                            ) : (
                                <GitBranchIcon className="size-3.5" />
                            )}
                            Branch in new chat
                        </ActionBarMorePrimitive.Item>
                    ) : null}
                </ActionBarMorePrimitive.Content>
            </ActionBarMorePrimitive.Root>
        );
    };

    return (
        <>
            <ActionBarPrimitive.Root
                autohide={autohide}
                className={cn('flex animate-in items-center gap-2 duration-150 fade-in', className)}
            >
                <TooltipProvider disableHoverableContent>
                    {leading}
                    {renderFeedback()}
                    {copyFormatted ? (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="flex items-center">
                                    <MessageCopyFormattedButton aria-label="Copy formatted answer" />
                                </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="pointer-events-none">
                                Copy as text
                            </TooltipContent>
                        </Tooltip>
                    ) : null}
                    {copy ? (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="flex items-center">
                                    <MessageCopyButton aria-label="Copy answer" />
                                </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="pointer-events-none">
                                {copyTooltip}
                            </TooltipContent>
                        </Tooltip>
                    ) : null}
                    {regenerate ? <RegenerateMenu models={regenerate.models} /> : null}
                    {renderMore()}
                    {trailing}
                </TooltipProvider>
                {interrupted ? (
                    <span className="interrupted-tag flex items-center gap-1.5 text-sm text-muted-foreground">
                        <CircleMinus className="size-4" aria-hidden />
                        Interrupted
                    </span>
                ) : null}
            </ActionBarPrimitive.Root>
            {deepResearchTag}
        </>
    );
};
