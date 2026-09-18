import { ActionBarPrimitive, AuiIf } from '@assistant-ui/react';
import { CheckIcon, ClipboardCopyIcon } from 'lucide-react';

import { TooltipIconButton } from '@/components/assistant-ui/tooltip-icon-button';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MessageCopyButtonProps {
    tooltip?: string;
    className?: string;
    'aria-label'?: string;
}

const MessageCopyButton = ({ tooltip, className, 'aria-label': ariaLabel }: MessageCopyButtonProps) => {
    if (tooltip) {
        return (
            <ActionBarPrimitive.Copy asChild>
                <TooltipIconButton tooltip={tooltip} className={className}>
                    <AuiIf condition={(s) => s.message.isCopied}>
                        <CheckIcon className="size-4" />
                    </AuiIf>
                    <AuiIf condition={(s) => !s.message.isCopied}>
                        <ClipboardCopyIcon className="size-4" />
                    </AuiIf>
                </TooltipIconButton>
            </ActionBarPrimitive.Copy>
        );
    }

    return (
        <ActionBarPrimitive.Copy asChild>
            <Button size="icon-xs" variant="ghost" className={cn('justify-center', className)} aria-label={ariaLabel}>
                <AuiIf condition={(s) => s.message.isCopied}>
                    <CheckIcon />
                </AuiIf>
                <AuiIf condition={(s) => !s.message.isCopied}>
                    <ClipboardCopyIcon />
                </AuiIf>
            </Button>
        </ActionBarPrimitive.Copy>
    );
};

export default MessageCopyButton;
