import { CheckIcon } from 'lucide-react';

import { getItemAbbr, getItemColor, type PickerItem } from '@/app/components/picker/picker-shared';
import { DescriptionHoverCard } from '@/components/description-hover-card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { rowActive, rowBase } from '../constants';
import type { PickerGroup } from '../utils/picker-items-query';

export interface CapabilityListGroupProps {
    group: PickerGroup;
    selectedIds: Set<string>;
    selectedItem: PickerItem | null;
    currentUserId: string | null;
    onSelect: (item: PickerItem) => void;
}

const CapabilityListGroup = ({
    group,
    selectedIds,
    selectedItem,
    currentUserId,
    onSelect,
}: CapabilityListGroupProps) => {
    if (group.items.length === 0) return null;

    return (
        <div className="not-first:mt-1">
            <div className="px-2 pt-[10px] pb-2 text-[10px] font-bold tracking-[0.07em] text-text-secondary uppercase">
                {group.label}
            </div>
            {group.items.map((item) => {
                const alreadyEnabled = selectedIds.has(item._id);
                const abbr = getItemAbbr(item.name);
                const color = getItemColor(item._id);
                const isActive = selectedItem?._id === item._id && selectedItem.kind === item.kind;
                const isCustom = !!item.creatorId && item.creatorId === currentUserId;

                return (
                    <button
                        key={`${item.kind}-${item._id}`}
                        className={cn(rowBase, isActive && rowActive)}
                        onClick={() => onSelect(item)}
                    >
                        <span
                            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[14px] text-[13px] font-bold text-white"
                            style={{ background: color }}
                        >
                            {abbr}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="flex min-w-0 items-center gap-1.5">
                                <span className="min-w-0 overflow-hidden font-medium text-ellipsis whitespace-nowrap">
                                    {item.name}
                                </span>
                                {isCustom && (
                                    <Badge
                                        variant="secondary"
                                        className="h-4 shrink-0 rounded-full border-transparent bg-primary/10 px-1.5 text-[10px] leading-none font-medium text-primary"
                                    >
                                        Custom
                                    </Badge>
                                )}
                            </span>
                            {item.description && (
                                <DescriptionHoverCard name={item.name} description={item.description}>
                                    <span className="overflow-hidden text-xs text-ellipsis whitespace-nowrap text-text-secondary">
                                        {item.description}
                                    </span>
                                </DescriptionHoverCard>
                            )}
                        </span>
                        {alreadyEnabled && (
                            <CheckIcon
                                size={13}
                                style={{ color: 'var(--primary)', flexShrink: 0 }}
                                aria-hidden="true"
                            />
                        )}
                    </button>
                );
            })}
        </div>
    );
};

export default CapabilityListGroup;
