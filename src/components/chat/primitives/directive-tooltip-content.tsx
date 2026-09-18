import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

interface DirectiveTooltipContentProps extends HTMLAttributes<HTMLSpanElement> {
    description?: string;
    type: string;
    label?: string;
}

export const DirectiveTooltipContent = ({
    description,
    type,
    label,
    className,
    ...props
}: DirectiveTooltipContentProps) => {
    return (
        <span
            className={cn(
                'flex flex-col gap-1.5 rounded-xl border border-border bg-popover p-2',
                'font-sans text-sm leading-relaxed font-normal shadow-md',
                'text-left tracking-normal whitespace-normal text-popover-foreground',
                className,
            )}
            {...props}
        >
            <div className="rounded-lg bg-background/80 p-2">
                <span className="line-clamp-4 text-xs text-foreground">
                    {description || label || 'No description available'}
                </span>
            </div>
            <span className="text-xs text-text-secondary">{type}</span>
        </span>
    );
};
