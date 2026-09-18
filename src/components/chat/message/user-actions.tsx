import { ActionBarPrimitive, useAuiState } from '@assistant-ui/react';
import { PencilIcon, PlusIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import MessageCopyFormattedButton from '../primitives/message-copy-formatted-button';

interface UserActionsProps {
    copy?: boolean;
    copyTooltip?: string;
    edit?: boolean;
    onAddPrompt?: () => void;
    leading?: ReactNode;
    trailing?: ReactNode;
    autohide?: 'always' | 'not-last';
    hideLastWhileRunning?: boolean;
    className?: string;
}

export const UserActions = ({
    copy = true,
    copyTooltip = 'Copy message',
    edit = false,
    onAddPrompt,
    leading,
    trailing,
    autohide,
    hideLastWhileRunning = false,
    className,
}: UserActionsProps) => {
    const isRunning = useAuiState((s) => s.thread.isRunning);
    const isLast = useAuiState((s) => s.message.isLast);

    if (hideLastWhileRunning && isRunning && isLast) return null;

    return (
        <ActionBarPrimitive.Root
            autohide={autohide}
            className={cn('flex min-h-8 items-center justify-end gap-2', className)}
        >
            <TooltipProvider>
                {leading}
                {copy ? (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="flex items-center">
                                <MessageCopyFormattedButton aria-label="Copy message" />
                            </span>
                        </TooltipTrigger>
                        <TooltipContent>{copyTooltip}</TooltipContent>
                    </Tooltip>
                ) : null}
                {edit ? (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <ActionBarPrimitive.Edit asChild>
                                <Button
                                    size="icon-xs"
                                    variant="ghost"
                                    className="justify-center"
                                    aria-label="Edit message"
                                >
                                    <PencilIcon />
                                </Button>
                            </ActionBarPrimitive.Edit>
                        </TooltipTrigger>
                        <TooltipContent>Edit message</TooltipContent>
                    </Tooltip>
                ) : null}
                {onAddPrompt ? (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                size="icon-xs"
                                variant="ghost"
                                className="justify-center"
                                onClick={onAddPrompt}
                                aria-label="Add to prompt library"
                            >
                                <PlusIcon />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Add to prompt library</TooltipContent>
                    </Tooltip>
                ) : null}
                {trailing}
            </TooltipProvider>
        </ActionBarPrimitive.Root>
    );
};
