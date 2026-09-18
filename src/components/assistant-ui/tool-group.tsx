'use client';

import { useScrollLock } from '@assistant-ui/react';
import { ChevronDownIcon, CircleCheck } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { formatElapsed } from '@/components/assistant-ui/format-elapsed';
import { RAIL_ITEM_CLASS, ToolRailNode } from '@/components/chat/tools';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

const ANIMATION_DURATION = 200;

const TOOL_GROUP_RAIL_CLASS = 'aui-tool-group-rail mt-3 ml-2 flex flex-col gap-6 pl-4';

function ToolRailItem({ className, children, ...props }: React.ComponentProps<'div'>) {
    return (
        <div data-slot="tool-rail-item" className={cn('aui-tool-rail-item', RAIL_ITEM_CLASS, className)} {...props}>
            {children}
        </div>
    );
}

type ToolGroupRootProps = Omit<React.ComponentProps<typeof Collapsible>, 'open' | 'onOpenChange'> & {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    defaultOpen?: boolean;
    forceOpen?: boolean;
};

function ToolGroupRoot({
    className,
    open: controlledOpen,
    onOpenChange: controlledOnOpenChange,
    defaultOpen = false,
    forceOpen = false,
    children,
    ...props
}: ToolGroupRootProps) {
    const collapsibleRef = useRef<HTMLDivElement>(null);
    const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
    const lockScroll = useScrollLock(collapsibleRef, ANIMATION_DURATION);

    const isControlled = controlledOpen !== undefined;
    const isOpen = isControlled ? controlledOpen : uncontrolledOpen;

    // A tool that starts mid-turn asks for approval after this group has already mounted closed,
    // and the approval UI lives inside the collapsed content, so it would never be rendered.
    useEffect(() => {
        if (forceOpen) {
            setUncontrolledOpen(true);
        }
    }, [forceOpen]);

    const handleOpenChange = useCallback(
        (open: boolean) => {
            if (!open) {
                lockScroll();
            }
            if (!isControlled) {
                setUncontrolledOpen(open);
            }
            controlledOnOpenChange?.(open);
        },
        [lockScroll, isControlled, controlledOnOpenChange],
    );

    return (
        <Collapsible
            ref={collapsibleRef}
            data-slot="tool-group-root"
            open={isOpen}
            onOpenChange={handleOpenChange}
            className={cn(
                'aui-tool-group-root group/tool-group-root mb-3 w-full',
                'animate-in duration-(--animation-duration) fade-in-0 motion-reduce:animate-none',
                className,
            )}
            style={
                {
                    '--animation-duration': `${ANIMATION_DURATION}ms`,
                } as React.CSSProperties
            }
            {...props}
        >
            {children}
        </Collapsible>
    );
}

function ToolGroupTrigger({
    count = 0,
    active = false,
    label,
    elapsedMs,
    className,
    ...props
}: React.ComponentProps<typeof CollapsibleTrigger> & {
    count?: number;
    active?: boolean;
    label?: string;
    elapsedMs?: number;
}) {
    const defaultLabel = `Used ${count} tool${count === 1 ? '' : 's'}`;
    const text = label ?? defaultLabel;

    return (
        <CollapsibleTrigger
            data-slot="tool-group-trigger"
            className={cn(
                'aui-tool-group-trigger group/trigger flex max-w-full items-center gap-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground',
                className,
            )}
            {...props}
        >
            <span
                data-slot="tool-group-trigger-label"
                className="aui-tool-group-trigger-label-wrapper relative inline-block text-left leading-none"
            >
                <span
                    className={cn(
                        active && 'inline-block shimmer text-sm text-muted-foreground motion-reduce:animate-none',
                    )}
                >
                    {text}
                </span>
                {elapsedMs !== undefined && (
                    <span className="ml-1 text-sm text-muted-foreground tabular-nums">{`· ${formatElapsed(elapsedMs)}`}</span>
                )}
            </span>
            <ChevronDownIcon
                data-slot="tool-group-trigger-chevron"
                className={cn(
                    'aui-tool-group-trigger-chevron mt-0.5 size-4',
                    'transition-transform duration-(--animation-duration) ease-out',
                    'group-data-[state=closed]/trigger:-rotate-90',
                    'group-data-[state=open]/trigger:rotate-0',
                )}
            />
        </CollapsibleTrigger>
    );
}

function ToolGroupContent({ className, children, ...props }: React.ComponentProps<typeof CollapsibleContent>) {
    return (
        <CollapsibleContent
            data-slot="tool-group-content"
            className={cn(
                'aui-tool-group-content relative overflow-hidden text-sm outline-none',
                'group/collapsible-content ease-out',
                'data-[state=closed]:animate-collapsible-up',
                'data-[state=open]:animate-collapsible-down',
                'data-[state=closed]:fill-mode-forwards',
                'data-[state=closed]:pointer-events-none',
                'data-[state=open]:duration-(--animation-duration)',
                'data-[state=closed]:duration-(--animation-duration)',
                className,
            )}
            {...props}
        >
            <div className={TOOL_GROUP_RAIL_CLASS}>{children}</div>
        </CollapsibleContent>
    );
}

function ToolGroupDone() {
    return (
        <ToolRailItem
            data-slot="tool-group-done"
            className="aui-tool-group-done flex items-center gap-2 text-sm text-muted-foreground"
        >
            <ToolRailNode tone="active" dataSlot="tool-group-done-node" className="aui-tool-group-done-node">
                <CircleCheck className="size-4" aria-hidden="true" />
            </ToolRailNode>
            <span>Done</span>
        </ToolRailItem>
    );
}

type ToolGroupProps = {
    count: number;
    active?: boolean;
    done?: boolean;
    defaultOpen?: boolean;
    forceOpen?: boolean;
    label?: string;
    elapsedMs?: number;
    children: React.ReactNode;
};

function ToolGroup({
    count,
    active = false,
    done = false,
    defaultOpen = false,
    forceOpen = false,
    label,
    elapsedMs,
    children,
}: ToolGroupProps) {
    return (
        <ToolGroupRoot defaultOpen={defaultOpen} forceOpen={forceOpen}>
            <ToolGroupTrigger count={count} active={active} label={label} elapsedMs={elapsedMs} />
            <ToolGroupContent>
                {children}
                {done && <ToolGroupDone />}
            </ToolGroupContent>
        </ToolGroupRoot>
    );
}

export { ToolGroup, ToolGroupRoot, ToolGroupTrigger, ToolGroupContent, ToolGroupDone, ToolRailItem };
