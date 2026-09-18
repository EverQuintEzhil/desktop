import { type ReactNode } from 'react';

import { cn } from '@/lib/utils';

export const RAIL_ITEM_CLASS = cn(
    'relative w-full',
    "before:pointer-events-none before:absolute before:top-2.5 before:bottom-[-2.5rem] before:left-[-1.05rem] before:w-px before:bg-muted-foreground/30 before:content-['']",
    'last:before:hidden',
);

type RailNodeTone = 'active' | 'muted';

const RAIL_NODE_CLASS =
    'absolute left-[-26px] flex size-5 shrink-0 items-center justify-center rounded-full bg-background';

interface ToolRailNodeProps {
    tone: RailNodeTone;
    className?: string;
    children: ReactNode;
    dataSlot?: string;
}

export const ToolRailNode = ({ tone, className, children, dataSlot = 'tool-rail-node' }: ToolRailNodeProps) => (
    <div
        data-slot={dataSlot}
        className={cn(RAIL_NODE_CLASS, tone === 'muted' ? 'text-muted-foreground' : 'text-primary', className)}
    >
        {children}
    </div>
);

interface ToolRailStepProps {
    tone: RailNodeTone;
    icon: ReactNode;
    children: ReactNode;
    className?: string;
    nodeClassName?: string;
    nodeDataSlot?: string;
}

export const ToolRailStep = ({
    tone,
    icon,
    children,
    className,
    nodeClassName = 'top-1',
    nodeDataSlot,
}: ToolRailStepProps) => (
    <div className={cn(RAIL_ITEM_CLASS, className)}>
        <ToolRailNode tone={tone} dataSlot={nodeDataSlot} className={nodeClassName}>
            {icon}
        </ToolRailNode>
        {children}
    </div>
);
