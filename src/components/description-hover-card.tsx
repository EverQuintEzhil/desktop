import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';

interface DescriptionHoverCardProps {
    name: string;
    description?: string | null;
    side?: 'top' | 'right' | 'bottom' | 'left';
    dismissOnTriggerClick?: boolean;
    forceClose?: boolean;
    children: ReactNode;
}

const useHasHover = () => {
    const [hasHover, setHasHover] = useState(true);

    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return;

        const mql = window.matchMedia('(hover: hover) and (pointer: fine)');

        setHasHover(mql.matches);

        const onChange = (event: MediaQueryListEvent) => setHasHover(event.matches);

        mql.addEventListener('change', onChange);

        return () => mql.removeEventListener('change', onChange);
    }, []);

    return hasHover;
};

export const DescriptionHoverCard = ({
    name,
    description,
    side = 'right',
    dismissOnTriggerClick = false,
    forceClose = false,
    children,
}: DescriptionHoverCardProps) => {
    const [open, setOpen] = useState(false);
    const contentRef = useRef<HTMLDivElement | null>(null);
    const suppressedRef = useRef(false);
    const hasHover = useHasHover();
    const effectiveOpen = open && !forceClose;

    useEffect(() => {
        if (!effectiveOpen) return;

        const handleScroll = (event: Event) => {
            const target = event.target;

            if (target instanceof Node && contentRef.current?.contains(target)) return;

            setOpen(false);
        };

        document.addEventListener('scroll', handleScroll, { capture: true, passive: true });

        return () => document.removeEventListener('scroll', handleScroll, { capture: true });
    }, [effectiveOpen]);

    const setContentRef = useCallback((node: HTMLDivElement | null) => {
        contentRef.current = node;

        if (!node) return;

        const handleWheel = (event: WheelEvent) => {
            if (node.scrollHeight <= node.clientHeight) return;

            event.preventDefault();
            event.stopPropagation();
            node.scrollTop += event.deltaY;
        };

        node.addEventListener('wheel', handleWheel, { passive: false });

        return () => {
            node.removeEventListener('wheel', handleWheel);
            contentRef.current = null;
        };
    }, []);

    if (!description || !hasHover) return children;

    return (
        <HoverCard
            open={effectiveOpen}
            openDelay={60}
            closeDelay={60}
            onOpenChange={(next) => {
                if (forceClose) return;
                if (next && suppressedRef.current) return;
                setOpen(next);
            }}
        >
            <HoverCardTrigger
                asChild
                onPointerDownCapture={() => {
                    suppressedRef.current = true;
                    setOpen(false);
                }}
                onPointerLeave={() => {
                    suppressedRef.current = false;
                }}
                onClickCapture={dismissOnTriggerClick ? () => setOpen(false) : undefined}
            >
                {children}
            </HoverCardTrigger>
            <HoverCardContent
                ref={setContentRef}
                side={side}
                collisionPadding={12}
                className="scrollbar-controller scrollbar-vertical z-60 max-h-[min(420px,var(--radix-hover-card-content-available-height))] w-auto max-w-[360px]"
            >
                <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium">{name}</span>
                    <p className="m-0 text-sm wrap-break-word whitespace-pre-wrap text-muted-foreground">
                        {description}
                    </p>
                </div>
            </HoverCardContent>
        </HoverCard>
    );
};
