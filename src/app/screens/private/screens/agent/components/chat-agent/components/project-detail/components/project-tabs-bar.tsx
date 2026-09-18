import { ChevronDownIcon, LockIcon } from 'lucide-react';
import type { ComponentProps, RefObject } from 'react';

import {
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRoot,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOverflowTabs } from '@/hooks';
import { cn } from '@/lib/utils';

import { PROJECT_TABS, TAB_TRIGGER_CLASS_NAME } from '../constants';
import type { ProjectTab } from '../types';

export interface Props {
    // The bar's height is published as `--space-tabs-h` by useStickyTabsOffset, which measures
    // this element — so the ref belongs to the owner, not to this component.
    barRef: RefObject<HTMLDivElement | null>;
    activeTab: ProjectTab;
    onTabChange: (value: string) => void;
}

// Same type ramp as the real triggers (which are `px-0`), so a ghost label measures the width
// its trigger would take.
const GHOST_LABEL_CLASS_NAME = 'text-sm font-medium whitespace-nowrap';

// Spreads the rest props: as the `asChild` child of DropdownMenuTrigger it is handed the
// trigger's ref and pointer handlers, and dropping them leaves the menu unopenable.
const MoreTrigger = ({ active, className, ...props }: { active: boolean } & ComponentProps<'button'>) => (
    <button
        type="button"
        {...props}
        className={cn(
            'relative flex h-10 flex-none cursor-pointer items-center gap-1 text-sm font-medium whitespace-nowrap',
            'text-text-secondary hover:text-primary',
            active && 'text-primary after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-primary',
            className,
        )}
    >
        More
        <ChevronDownIcon className="size-4" />
    </button>
);

/**
 * Priority+ ("okayNav") tabs bar: the tabs that fit render inline, the rest collapse into a
 * "More" dropdown, so a narrow viewport never pushes the page into horizontal scroll.
 * See {@link useOverflowTabs} for the measurement.
 */
const ProjectTabsBar = ({ barRef, activeTab, onTabChange }: Props) => {
    const { containerRef, ghostRef, moreRef, visibleCount } = useOverflowTabs<HTMLDivElement>(PROJECT_TABS.length);

    const visibleTabs = PROJECT_TABS.slice(0, visibleCount);
    const overflowTabs = PROJECT_TABS.slice(visibleCount);
    const activeInOverflow = overflowTabs.some((tab) => tab.value === activeTab);

    return (
        <div
            ref={barRef}
            className={cn(
                'project-tabs-bar sticky top-0 z-2 flex flex-wrap items-end justify-between gap-3 border-b border-border-secondary',
                'bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80',
            )}
        >
            {/* `min-w-48` is the wrap trigger: once the note no longer fits beside that much tab
                strip it drops to its own row and the strip gets the full width back. */}
            <div
                ref={containerRef}
                className="project-tabs-bar-nav relative flex min-w-48 flex-1 items-end gap-5 overflow-x-clip"
            >
                <Tabs value={activeTab} onValueChange={onTabChange} className="min-w-0 gap-0">
                    <TabsList variant="line" className="h-10! justify-start gap-5 p-0">
                        {visibleTabs.map((tab) => (
                            <TabsTrigger key={tab.value} value={tab.value} className={TAB_TRIGGER_CLASS_NAME}>
                                {tab.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>

                {overflowTabs.length > 0 ? (
                    <DropdownMenuRoot>
                        <DropdownMenuTrigger asChild>
                            <MoreTrigger active={activeInOverflow} />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-45">
                            {overflowTabs.map((tab) => (
                                <DropdownMenuItem
                                    key={tab.value}
                                    className={cn(
                                        'cursor-pointer rounded-md',
                                        activeTab === tab.value && 'text-primary',
                                    )}
                                    onSelect={() => onTabChange(tab.value)}
                                >
                                    {tab.label}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenuRoot>
                ) : null}

                {/* Hidden measurement row — always holds every tab so collapsed widths are known. */}
                <div
                    ref={ghostRef}
                    aria-hidden
                    className="project-tabs-bar-ghost pointer-events-none invisible absolute top-0 left-0 flex flex-nowrap items-center gap-5"
                >
                    {PROJECT_TABS.map((tab) => (
                        <span key={tab.value} className={GHOST_LABEL_CLASS_NAME}>
                            {tab.label}
                        </span>
                    ))}
                </div>

                {/* Hidden "More" trigger — measured to reserve its space when collapsing. */}
                <div ref={moreRef} aria-hidden className="pointer-events-none invisible absolute top-0 left-0">
                    <MoreTrigger active={false} />
                </div>
            </div>

            {activeTab === 'shared' ? null : (
                <span className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <LockIcon className="size-3" />
                    Your chats are private until shared
                </span>
            )}
        </div>
    );
};

export default ProjectTabsBar;
