import { ChevronDownIcon } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface CollapsibleMessageTextProps {
    children: ReactNode;
    collapsedHeight?: number;
    className?: string;
}

const DEFAULT_COLLAPSED_HEIGHT = 160;

const CollapsibleMessageText = ({
    children,
    collapsedHeight = DEFAULT_COLLAPSED_HEIGHT,
    className,
}: CollapsibleMessageTextProps) => {
    const contentRef = useRef<HTMLDivElement>(null);
    const [canCollapse, setCanCollapse] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    useLayoutEffect(() => {
        const element = contentRef.current;

        if (!element) return undefined;

        const measure = () => {
            setCanCollapse(element.scrollHeight > collapsedHeight + 1);
        };

        measure();

        const observer = new ResizeObserver(measure);

        observer.observe(element);

        return () => {
            observer.disconnect();
        };
    }, [collapsedHeight]);

    const isCollapsed = canCollapse && !isExpanded;

    const toggleExpanded = () => {
        setIsExpanded((value) => !value);
    };

    return (
        <div className={cn('collapsible-message-text flex flex-col', className)}>
            <div
                ref={contentRef}
                data-collapsed={isCollapsed ? '' : undefined}
                className={cn(
                    'collapsible-message-text-content overflow-hidden',
                    isCollapsed && 'mask-[linear-gradient(to_bottom,black_calc(100%-1.25rem),transparent)]',
                )}
                style={{ maxHeight: isExpanded ? undefined : collapsedHeight }}
            >
                {children}
            </div>
            {canCollapse && (
                <button
                    type="button"
                    className="mt-1 flex cursor-pointer items-center gap-1 self-start border-none bg-transparent p-0 text-xs font-medium text-primary hover:opacity-80"
                    onClick={toggleExpanded}
                >
                    <span>{isExpanded ? 'Show less' : 'Show more'}</span>
                    <ChevronDownIcon
                        size={14}
                        aria-hidden="true"
                        className={cn('transition-transform duration-150', isExpanded && 'rotate-180')}
                    />
                </button>
            )}
        </div>
    );
};

export default CollapsibleMessageText;
