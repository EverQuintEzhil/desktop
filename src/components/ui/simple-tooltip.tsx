import { type ReactNode } from 'react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface SimpleTooltipProps {
    content: ReactNode;
    children: ReactNode;
    side?: 'top' | 'right' | 'bottom' | 'left';
    sideOffset?: number;
    disabled?: boolean;
    className?: string;
    disableHoverableContent?: boolean;
}

export function SimpleTooltip({
    content,
    children,
    side = 'bottom',
    sideOffset,
    disabled = false,
    className,
    disableHoverableContent,
}: SimpleTooltipProps) {
    if (disabled || !content) {
        return <>{children}</>;
    }

    return (
        <Tooltip disableHoverableContent={disableHoverableContent}>
            <TooltipTrigger asChild>{children}</TooltipTrigger>
            <TooltipContent side={side} sideOffset={sideOffset} className={className}>
                {content}
            </TooltipContent>
        </Tooltip>
    );
}
