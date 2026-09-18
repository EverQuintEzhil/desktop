import { PanelLeftIcon, PanelRightIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface CodeManagerLoadingSkeletonProps {
    canUserEdit: boolean;
    isHistoryPanelExpanded: boolean;
    onToggleExpand: (expanded: boolean) => void;
}

const CodeManagerLoadingSkeleton = ({
    canUserEdit,
    isHistoryPanelExpanded,
    onToggleExpand,
}: CodeManagerLoadingSkeletonProps) => (
    <div className="tab-content tool-tab code-manager-tab flex h-full min-h-[400px] flex-col overflow-hidden p-0! max-lg:min-h-[calc(100svh-193px)]">
        <div className="flex min-h-0 flex-1 overflow-hidden rounded-none! p-0!">
            <div
                className={cn(
                    'tool-code-sidebar flex flex-col border-r border-border-secondary bg-(--bg-secondary)',
                    'overflow-hidden transition-[width] duration-200 ease-out',
                    isHistoryPanelExpanded ? 'w-[220px]' : 'w-11 shrink-0',
                )}
            >
                {isHistoryPanelExpanded ? (
                    <div className="flex items-center justify-between gap-2 border-b border-border-secondary px-3 py-1">
                        <Skeleton className="h-4 w-20 rounded-sm" />
                        <div className="flex shrink-0 items-center gap-1">
                            {canUserEdit ? <Skeleton className="size-6 rounded-md" /> : null}
                            <SimpleTooltip content="Collapse histories" side="bottom">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-xs"
                                    aria-label="Collapse histories panel"
                                    onClick={() => onToggleExpand(false)}
                                >
                                    <PanelRightIcon />
                                </Button>
                            </SimpleTooltip>
                        </div>
                    </div>
                ) : (
                    <div className="flex justify-center border-b border-border-secondary p-2 py-1">
                        <SimpleTooltip content="Expand histories" side="bottom">
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                aria-label="Expand histories panel"
                                onClick={() => onToggleExpand(true)}
                            >
                                <PanelLeftIcon />
                            </Button>
                        </SimpleTooltip>
                    </div>
                )}
                <div className={cn('flex-1 overflow-hidden', !isHistoryPanelExpanded && 'hidden')}>
                    <div className="flex flex-col gap-2">
                        {[0, 1, 2].map((i) => (
                            <div key={i} className="flex flex-col gap-2 rounded-md p-3">
                                <div className="flex items-center justify-between gap-2">
                                    <Skeleton className="h-4 w-14 rounded-sm" />
                                    <Skeleton className="h-4 w-16 rounded-sm" />
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                                        <Skeleton className="h-3 w-full max-w-[140px] rounded-sm" />
                                        <Skeleton className="h-3 w-full max-w-[120px] rounded-sm" />
                                    </div>
                                    <Skeleton className="size-8 shrink-0 rounded-md" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-center justify-between gap-3 border-b border-border-secondary bg-(--bg-primary) px-3 py-1">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                        <Skeleton className="h-6 w-[100px] shrink-0 rounded-md" />
                        <div className="h-6 w-px shrink-0 bg-border-secondary" />
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                            <Skeleton className="h-6 w-14 shrink-0 rounded-sm" />
                            <Skeleton className="h-6 w-full max-w-[80px] rounded-md" />
                        </div>
                    </div>
                    {canUserEdit ? (
                        <div className="flex shrink-0 items-center gap-2">
                            <Skeleton className="h-6 w-[128px] rounded-md" />
                            <Skeleton className="h-6 w-[96px] rounded-md" />
                        </div>
                    ) : null}
                </div>
                <div className="editor-controller relative flex min-h-0 flex-1 flex-col overflow-hidden">
                    <div className="tool-code-editor absolute inset-0 flex flex-col gap-3 rounded-none! border-0! p-4">
                        <Skeleton className="h-3 w-[55%] rounded-sm" />
                        <Skeleton className="h-3 w-full rounded-sm" />
                        <Skeleton className="h-3 w-[88%] rounded-sm" />
                        <Skeleton className="h-3 w-[72%] rounded-sm" />
                        <Skeleton className="min-h-[200px] w-full flex-1 rounded-md" />
                    </div>
                </div>
            </div>
        </div>
    </div>
);

export default CodeManagerLoadingSkeleton;
