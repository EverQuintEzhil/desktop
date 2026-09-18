import { type ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface ChatBlockProps {
    header?: ReactNode;
    children: ReactNode;
    className?: string;
    bodyClassName?: string;
    scrollBody?: boolean;
    dataSlot?: string;
}

export const ChatBlock = ({
    header,
    children,
    className,
    bodyClassName,
    scrollBody = false,
    dataSlot = 'chat-block',
}: ChatBlockProps) => (
    <div
        data-slot={dataSlot}
        className={cn('w-full overflow-hidden rounded-xl border border-border bg-card', className)}
    >
        {header ? (
            <div className="chat-block-header flex items-center gap-2 border-b border-border bg-muted-foreground/5 px-4 py-2.5">
                {header}
            </div>
        ) : null}
        <div className={cn(scrollBody && 'scrollbar-controller scrollbar-vertical max-h-[42svh]', bodyClassName)}>
            {children}
        </div>
    </div>
);
