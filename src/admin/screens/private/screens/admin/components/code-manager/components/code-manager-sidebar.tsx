import { format } from 'date-fns';
import {
    CalendarDaysIcon,
    GitForkIcon,
    HistoryIcon,
    PanelLeftIcon,
    PanelRightIcon,
    PlusIcon,
    TrashIcon,
    UserIcon,
} from 'lucide-react';
import { useState } from 'react';

import { InfiniteScrollTrigger } from '@/components';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import ConfirmationModal from '@/components/ui/confirmation-modal';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import SpinnerBlade from '@/components/ui/spinner';
import { useInfiniteScroll } from '@/hooks';
import { cn } from '@/lib/utils';
import type { CodeType } from '@/types/admin';

interface CodeManagerSidebarProps {
    toolCodes: CodeType[];
    selectedCodeId: string | null;
    selectedToolCodeId: string | null;
    canUserEdit: boolean;
    isDeletingCode: string;
    isHistoryPanelExpanded: boolean;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    fetchNextPage: () => void;
    onToggleExpand: (expanded: boolean) => void;
    onSelectCode: (code: CodeType) => void;
    onForkCode: (e: React.MouseEvent<HTMLButtonElement>, code: CodeType) => void;
    onDeleteCode: (code: CodeType) => Promise<void>;
    onNewVersion: () => void;
}

const CodeManagerSidebar = ({
    toolCodes,
    selectedCodeId,
    selectedToolCodeId,
    canUserEdit,
    isDeletingCode,
    isHistoryPanelExpanded,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    onToggleExpand,
    onSelectCode,
    onForkCode,
    onDeleteCode,
    onNewVersion,
}: CodeManagerSidebarProps) => {
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
    const [codeToDelete, setCodeToDelete] = useState<CodeType | null>(null);

    const { loadMoreRef } = useInfiniteScroll({
        loading: false,
        showMoreLoading: isFetchingNextPage,
        hasMore: hasNextPage,
        itemsLength: toolCodes.length,
        onLoadMore: () => {
            fetchNextPage();
        },
    });

    const handleDeleteClick = (e: React.MouseEvent<HTMLButtonElement>, code: CodeType) => {
        e.stopPropagation();
        setCodeToDelete(code);
        setIsConfirmDeleteOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (codeToDelete) {
            await onDeleteCode(codeToDelete);
        }
        setIsConfirmDeleteOpen(false);
        setCodeToDelete(null);
    };

    const handleCancelDelete = () => {
        setIsConfirmDeleteOpen(false);
        setCodeToDelete(null);
    };

    return (
        <>
            <div
                className={cn(
                    'tool-code-sidebar flex flex-col border-r border-border-secondary bg-(--bg-secondary)',
                    'min-h-0 overflow-hidden transition-[width] duration-200 ease-out',
                    isHistoryPanelExpanded ? 'w-[220px]' : 'w-9 shrink-0',
                )}
            >
                {isHistoryPanelExpanded ? (
                    <div className="flex h-8 min-w-0 shrink-0 items-center justify-between gap-2 border-b border-border-secondary px-4 py-1">
                        <h4 className="truncate text-[10px] font-semibold tracking-wider text-text-secondary uppercase">
                            Versions
                        </h4>
                        <div className="flex shrink-0 items-center gap-1">
                            {canUserEdit && (
                                <SimpleTooltip content="Add Version" side="bottom">
                                    <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        onClick={onNewVersion}
                                        className={cn(selectedCodeId === null && 'bg-accent text-accent-foreground')}
                                        disabled={selectedCodeId === null}
                                    >
                                        <PlusIcon />
                                    </Button>
                                </SimpleTooltip>
                            )}
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
                    <div className="flex shrink-0 flex-col items-center gap-1 border-b border-border-secondary p-1">
                        <SimpleTooltip content="Expand histories" side="right">
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
                        {canUserEdit && (
                            <SimpleTooltip content="Add Version" side="right">
                                <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    onClick={onNewVersion}
                                    className={cn(selectedCodeId === null && 'bg-accent text-accent-foreground')}
                                    disabled={selectedCodeId === null}
                                >
                                    <PlusIcon />
                                </Button>
                            </SimpleTooltip>
                        )}
                    </div>
                )}

                <div className={cn('min-h-0 flex-1', !isHistoryPanelExpanded && 'hidden')}>
                    {toolCodes.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center gap-2 px-3 text-center">
                            <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
                                <HistoryIcon className="size-5" />
                            </span>
                            <div className="flex max-w-40 flex-col items-center gap-1">
                                <span className="text-sm font-medium text-foreground">No versions yet</span>
                                <span className="text-xs leading-5 text-muted-foreground">
                                    {canUserEdit
                                        ? 'Create a version with the + button above.'
                                        : 'Saved versions of this code will appear here.'}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="tool-code-history scrollbar-controller scrollbar-vertical scrollbar-horizontal flex flex-col gap-2 px-4 py-2">
                            {toolCodes.map((code) => (
                                <div
                                    key={code._id}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => onSelectCode(code)}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            onSelectCode(code);
                                        }
                                    }}
                                    className={cn(
                                        'tool-code-history-item flex cursor-pointer flex-col gap-0.5 rounded-md p-2 text-left',
                                        'border border-border-secondary',
                                        'hover:border-border-primary hover:bg-background',
                                        'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                                        selectedCodeId === code._id &&
                                            'tool-code-history-item--selected border-border-primary bg-background',
                                    )}
                                >
                                    <div className="flex items-center justify-between gap-1.5">
                                        <span className="font-mono text-xs leading-none font-bold">
                                            v{code.version}
                                        </span>
                                        <div className="flex shrink-0 items-center gap-0.5">
                                            {selectedToolCodeId === code._id && (
                                                <Badge
                                                    variant="outline"
                                                    className="h-3.5 px-1 py-0 text-[9px] leading-none uppercase"
                                                >
                                                    Default
                                                </Badge>
                                            )}
                                            <SimpleTooltip content="Fork" side="bottom">
                                                <Button
                                                    variant="ghost"
                                                    size="icon-xs"
                                                    onClick={(e: React.MouseEvent<HTMLButtonElement>) =>
                                                        onForkCode(e, code)
                                                    }
                                                >
                                                    <GitForkIcon className="size-3" />
                                                </Button>
                                            </SimpleTooltip>
                                            {selectedToolCodeId !== code._id && (
                                                <SimpleTooltip content="Delete" side="bottom">
                                                    <Button
                                                        variant="destructive"
                                                        size="icon-xs"
                                                        onClick={(e: React.MouseEvent<HTMLButtonElement>) =>
                                                            handleDeleteClick(e, code)
                                                        }
                                                    >
                                                        {isDeletingCode === code._id ? (
                                                            <SpinnerBlade />
                                                        ) : (
                                                            <TrashIcon className="size-3" />
                                                        )}
                                                    </Button>
                                                </SimpleTooltip>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <UserIcon className="size-3 shrink-0 text-(--text-tertiary)" />
                                        <span className="truncate text-[10px] text-(--text-tertiary)">
                                            {code.creator.name.first + ' ' + code.creator.name.last}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <CalendarDaysIcon className="size-3 shrink-0 text-(--text-tertiary)" />
                                        <span className="text-[10px] text-(--text-tertiary)">
                                            {format(new Date(code.createdAt), 'MMM d, yy HH:mm')}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            <InfiniteScrollTrigger
                                isLoading={isFetchingNextPage}
                                hasMore={hasNextPage}
                                loadMoreRef={loadMoreRef}
                            />
                        </div>
                    )}
                </div>
            </div>
            {isConfirmDeleteOpen && (
                <ConfirmationModal
                    isOpen={isConfirmDeleteOpen}
                    onClose={handleCancelDelete}
                    onConfirm={handleConfirmDelete}
                    isButtonLoading={isDeletingCode ? true : false}
                    title="Delete Version"
                    confirmButtonText="Delete"
                    cancelButtonText="Cancel"
                >
                    <div className="mx-auto flex flex-col items-center justify-center text-center">
                        <span className="text-sm">Are you sure you want to delete this version of code ?.</span>
                    </div>
                </ConfirmationModal>
            )}
        </>
    );
};

export default CodeManagerSidebar;
