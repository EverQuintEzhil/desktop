import React, { useEffect, useRef, useState } from 'react';

import { Collapsible, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

export interface ExpandableTextProps {
    children: React.ReactNode;
    maxLines?: number;
    showMoreText?: string;
    showLessText?: string;
    className?: string;
    textClassName?: string;
    buttonClassName?: string;
}

const ExpandableText: React.FC<ExpandableTextProps> = ({
    children,
    maxLines = 2,
    showMoreText = 'Show more',
    showLessText = 'Show less',
    className,
    textClassName,
    buttonClassName,
}) => {
    const [open, setOpen] = useState(false);
    const [showToggle, setShowToggle] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const element = contentRef.current;

        if (!element) return;

        const checkOverflow = () => {
            if (open) return;

            setShowToggle(element.scrollHeight > element.clientHeight + 1);
        };

        checkOverflow();

        const observer = new ResizeObserver(checkOverflow);

        observer.observe(element);

        return () => observer.disconnect();
    }, [children, maxLines, open]);

    const handleTriggerClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        e.preventDefault();
        setOpen((prev) => !prev);
    };

    return (
        <Collapsible open={open} onOpenChange={setOpen} className={cn('flex w-full min-w-0 flex-col', className)}>
            <div
                ref={contentRef}
                className={cn(
                    'max-w-full min-w-0 leading-normal wrap-break-word',
                    !open && 'line-clamp-1 [display:-webkit-box] overflow-hidden [-webkit-box-orient:vertical]',
                    textClassName,
                )}
                style={!open ? { WebkitLineClamp: maxLines } : undefined}
            >
                {children}
            </div>
            {showToggle && (
                <CollapsibleTrigger
                    type="button"
                    onClick={handleTriggerClick}
                    className={cn(
                        'cursor-pointer self-start border-0 bg-transparent p-0 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:underline',
                        buttonClassName,
                    )}
                >
                    {open ? showLessText : showMoreText}
                </CollapsibleTrigger>
            )}
        </Collapsible>
    );
};

export default ExpandableText;
