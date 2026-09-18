import {
    BlocksIcon,
    BotIcon,
    BrainIcon,
    CpuIcon,
    TriangleAlertIcon,
    WrenchIcon,
    XIcon,
    type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import type { NamedItem } from '../types';

export type ItemPillKind = 'connector' | 'agent' | 'tool' | 'memory' | 'model';

const ICON_BY_KIND: Record<ItemPillKind, LucideIcon> = {
    connector: BlocksIcon,
    agent: BotIcon,
    tool: WrenchIcon,
    memory: BrainIcon,
    model: CpuIcon,
};

export interface ItemPillProps {
    item: NamedItem;
    kind: ItemPillKind;
    isExpired?: boolean;
    badge?: ReactNode;
    onRemove?: (item: NamedItem) => void;
    onViewDetail: (item: NamedItem) => void;
    onReconnect?: () => void;
}

const ItemPill = ({ item, kind, isExpired, badge, onRemove, onViewDetail, onReconnect }: ItemPillProps) => {
    const KindIcon = ICON_BY_KIND[kind];

    return (
        <span
            className={cn(
                'group/chip inline-flex h-7 items-center gap-1.5 rounded-full pr-3 pl-2 text-sm whitespace-nowrap text-(--text-primary)',
                'border border-[color-mix(in_srgb,var(--border)_86%,var(--primary))] bg-[color-mix(in_srgb,var(--primary)_4%,var(--surface))]',
                'transition-[border-color] duration-140 hover:border-[color-mix(in_srgb,var(--primary)_32%,var(--border))]',
            )}
        >
            {onRemove ? (
                <button
                    type="button"
                    className={cn(
                        'group/remove inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent p-0',
                        'group-hover/chip:bg-[color-mix(in_srgb,var(--danger)_12%,transparent)]',
                        'focus-visible:bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] focus-visible:outline-none',
                    )}
                    aria-label={`Remove ${item.name}`}
                    onClick={() => onRemove(item)}
                >
                    <KindIcon
                        className="shrink-0 group-hover/chip:hidden group-focus-visible/remove:hidden"
                        size={12}
                        color="var(--primary)"
                        aria-hidden="true"
                    />
                    <XIcon
                        className="hidden text-(--danger) group-hover/chip:block group-focus-visible/remove:block"
                        size={12}
                        aria-hidden="true"
                    />
                </button>
            ) : (
                <span className="inline-flex size-4 shrink-0 items-center justify-center">
                    <KindIcon className="shrink-0" size={12} color="var(--primary)" aria-hidden="true" />
                </span>
            )}
            <button
                type="button"
                className={cn(
                    'cursor-pointer border-none bg-transparent p-0 font-[inherit] text-(--text-primary)',
                    'transition-[color] duration-140 hover:text-primary focus-visible:text-primary focus-visible:underline focus-visible:outline-none',
                    'max-w-[160px] overflow-hidden text-ellipsis whitespace-nowrap',
                )}
                aria-label={`View ${item.name} details`}
                onClick={() => onViewDetail(item)}
            >
                {item.name}
            </button>
            {badge}
            {isExpired && (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            type="button"
                            className="inline-flex cursor-pointer items-center border-none bg-transparent p-0 focus-visible:outline-none"
                            onClick={onReconnect}
                            aria-label={`Reconnect ${item.name}`}
                        >
                            <TriangleAlertIcon className="shrink-0 text-(--danger)" size={14} aria-hidden="true" />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent>Connection expired or disconnected. Click to reconnect.</TooltipContent>
                </Tooltip>
            )}
        </span>
    );
};

export default ItemPill;
