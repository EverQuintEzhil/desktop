import { BrainCircuitIcon, CircleAlert, RefreshCw } from 'lucide-react';
import type { Ref } from 'react';

import { PickerListEmpty } from '@/app/components/picker/picker-list-empty';
import { InfiniteScrollTrigger, SearchInput } from '@/components';
import { DescriptionHoverCard } from '@/components/description-hover-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { MemoryType } from '@/types/admin';

export interface MemoryListItem {
    memory: MemoryType;
    status: 'enabled' | 'disabled';
}

export interface MemoryGroup {
    label: string;
    items: MemoryListItem[];
}

interface MemoriesListPaneProps {
    groups: MemoryGroup[];
    selectedId?: string;
    onSelect: (id: string) => void;
    search: string;
    onSearchChange: (value: string) => void;
    isLoading: boolean;
    isError: boolean;
    loadMoreRef: Ref<HTMLDivElement | null>;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    onRetry?: () => void;
    className?: string;
}

const SKELETON_COUNT = 6;

const MemoriesListPane = ({
    groups,
    selectedId,
    onSelect,
    search,
    onSearchChange,
    isLoading,
    isError,
    loadMoreRef,
    hasNextPage,
    isFetchingNextPage,
    onRetry,
    className,
}: MemoriesListPaneProps) => {
    const renderEmptyState = () => (
        <PickerListEmpty label="memories" search={search} onClearSearch={() => onSearchChange('')} />
    );

    const renderErrorState = () => (
        <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <span
                className={cn(
                    'flex h-11 w-11 items-center justify-center rounded-[14px]',
                    'bg-[color-mix(in_srgb,var(--destructive)_8%,var(--surface))] text-destructive',
                    'border border-[color-mix(in_srgb,var(--destructive)_14%,var(--border))]',
                )}
            >
                <CircleAlert size={18} aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-(--text-primary)">Failed to load memories</span>
                <span className="max-w-[220px] text-xs leading-normal text-text-secondary">
                    Check your connection and try loading the memories list again.
                </span>
            </div>
            {onRetry && (
                <Button type="button" variant="secondary" size="sm" className="rounded-[10px]" onClick={onRetry}>
                    <RefreshCw className="size-4" aria-hidden="true" />
                    Retry
                </Button>
            )}
        </div>
    );

    const renderSkeletons = () => (
        <div className="flex flex-col gap-1 px-4">
            {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl p-3">
                    <Skeleton className="size-10 shrink-0 rounded-lg" />
                    <div className="flex flex-1 flex-col gap-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-48" />
                    </div>
                </div>
            ))}
        </div>
    );

    const renderContent = () => {
        if (isError) return renderErrorState();
        if (isLoading && groups.length === 0) return renderSkeletons();
        if (groups.length === 0) return renderEmptyState();

        return (
            <div className="memories-list-pane-content-container flex flex-col gap-6">
                {groups.map((group) => (
                    <div key={group.label} className="memories-list-pane-group flex flex-col gap-2">
                        {group.label && (
                            <span className="flex items-center justify-between px-2 pt-3 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                {group.label}
                                <Badge className="h-5 min-w-5 justify-center rounded-full px-1.5 text-[10px]">
                                    {group.items.length}
                                </Badge>
                            </span>
                        )}
                        <div className="memories-list-pane-group-items flex flex-col gap-1">
                            {group.items.map((item) => {
                                const isSelected = selectedId === item.memory._id;

                                return (
                                    <button
                                        key={item.memory._id}
                                        type="button"
                                        onClick={() => onSelect(item.memory._id)}
                                        className={cn(
                                            'group flex h-auto w-full cursor-pointer items-center justify-start gap-3',
                                            'rounded-none px-4 py-3 text-left whitespace-normal transition-colors',
                                            isSelected
                                                ? 'border-primary/20 bg-primary/10 text-primary'
                                                : 'border-transparent text-foreground hover:border-border hover:bg-muted/60',
                                            !isSelected &&
                                                'hover:border-primary/25 hover:bg-primary/5 hover:text-primary',
                                        )}
                                    >
                                        <div
                                            className={cn(
                                                'flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors',
                                                !isSelected && 'group-hover:bg-primary/15',
                                            )}
                                        >
                                            <BrainCircuitIcon className="size-5" />
                                        </div>
                                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                                            <span className="flex min-w-0 items-center gap-1.5">
                                                <span className="truncate text-sm font-medium">{item.memory.name}</span>
                                            </span>
                                            {item.memory.description && (
                                                <DescriptionHoverCard
                                                    name={item.memory.name}
                                                    description={item.memory.description}
                                                    dismissOnTriggerClick
                                                >
                                                    <span className="truncate text-xs text-muted-foreground">
                                                        {item.memory.description}
                                                    </span>
                                                </DescriptionHoverCard>
                                            )}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
                <InfiniteScrollTrigger loadMoreRef={loadMoreRef} hasMore={hasNextPage} isLoading={isFetchingNextPage} />
            </div>
        );
    };

    return (
        <div className={cn('memories-list-pane flex min-h-[calc(100svh-80px)] flex-col bg-card lg:min-h-0', className)}>
            <div className="memories-list-pane-header flex flex-col gap-3 border-b border-border/70 bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-0.5">
                        <h1 className="text-lg font-semibold">Memories</h1>
                        <span className="text-xs text-muted-foreground">Manage your memories access.</span>
                    </div>
                </div>
                <SearchInput
                    search={search}
                    searchOnChange
                    onChange={onSearchChange}
                    placeholder="Search memories"
                    className="max-w-full"
                />
            </div>

            <div className="memories-list-pane-content scrollbar-controller scrollbar-vertical min-h-0 flex-1 lg:pb-6">
                {renderContent()}
            </div>
        </div>
    );
};

export default MemoriesListPane;
