import { ChevronLeftIcon, ChevronRightIcon, FileIcon, FolderIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

import {
    getFileColumnMeta,
    getFolderDateDisplay,
    getFolderSizeDisplay,
    isFolder,
    isPathSelectedOrUnderSelectedFolder,
    isPathUnderSelectedFolder,
    TREE_ROW_GRID,
} from '../tree-utils';
import type { ExplorerFolderNode, ExplorerNode } from '../types';

export interface BrowsePanelProps {
    isBrowseLoading: boolean;
    isBrowseError: boolean;
    currentFolder: ExplorerFolderNode | null;
    listedChildren: ExplorerNode[];
    pathSegmentsLength: number;
    selectedKeys: Set<string>;
    isSubmitting: boolean;
    toggleSelectedKey: (keyPath: string, checked: boolean) => void;
    enterFolder: (folder: ExplorerFolderNode) => void;
    isSharePoint: boolean;
    currentBrowsePage: number;
    hasNextPage: boolean;
    onPrevPage: () => void;
    onNextPage: () => void;
}

const renderTableHeader = () => (
    <div
        className={cn(
            TREE_ROW_GRID,
            'configure-files-folders-tree-header sticky top-0 z-1 bg-muted/80 px-2 py-2 text-xs font-medium text-muted-foreground backdrop-blur-sm',
        )}
    >
        <span className="min-w-0 pl-8">Name</span>
        <span className="whitespace-nowrap">Date modified</span>
        <span className="text-right">Size</span>
        <span className="min-w-0">Kind</span>
    </div>
);

const BrowsePanel = ({
    isBrowseLoading,
    isBrowseError,
    currentFolder,
    listedChildren,
    pathSegmentsLength,
    selectedKeys,
    isSubmitting,
    toggleSelectedKey,
    enterFolder,
    isSharePoint,
    currentBrowsePage,
    hasNextPage,
    onPrevPage,
    onNextPage,
}: BrowsePanelProps) => {
    const renderFolderRow = (node: ExplorerFolderNode) => {
        const checked = isPathSelectedOrUnderSelectedFolder(node.keyPath, selectedKeys);
        const checkboxDisabled = isSubmitting || isPathUnderSelectedFolder(node.keyPath, selectedKeys);

        return (
            <div
                key={node.keyPath}
                className={cn(TREE_ROW_GRID, 'min-h-[44px] cursor-pointer px-2 py-1.5 text-sm hover:bg-muted/60')}
                onClick={() => {
                    if (!isSubmitting) enterFolder(node);
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (!isSubmitting) enterFolder(node);
                    }
                }}
                role="button"
                tabIndex={0}
            >
                <div className="flex min-w-0 items-center gap-1.5">
                    <div
                        className="flex shrink-0 items-center"
                        onClick={(e) => e.stopPropagation()}
                        role="presentation"
                    >
                        <Checkbox
                            className={checkboxDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}
                            checked={checked}
                            disabled={checkboxDisabled}
                            onChange={(_, value) => toggleSelectedKey(node.keyPath, value)}
                            aria-label={`Select folder ${node.label}`}
                        />
                    </div>
                    <FolderIcon className="size-4" />
                    <span className="min-w-0 truncate font-medium">{node.label}</span>
                </div>
                <span className="min-w-0 truncate text-xs text-muted-foreground sm:text-sm">
                    {getFolderDateDisplay(node)}
                </span>
                <span className="text-right text-xs text-muted-foreground tabular-nums sm:text-sm">
                    {getFolderSizeDisplay(node)}
                </span>
                <span className="min-w-0 truncate text-xs text-muted-foreground sm:text-sm">Folder</span>
            </div>
        );
    };

    const renderFileRow = (node: Extract<ExplorerNode, { type: 'file' }>) => {
        const checked = isPathSelectedOrUnderSelectedFolder(node.keyPath, selectedKeys);
        const checkboxDisabled = isSubmitting || isPathUnderSelectedFolder(node.keyPath, selectedKeys);
        const meta = getFileColumnMeta(node);

        return (
            <div key={node.keyPath} className={cn(TREE_ROW_GRID, 'min-h-[44px] px-2 py-1.5 text-sm')}>
                <div className="flex min-w-0 items-center gap-1.5">
                    <div className="flex shrink-0 items-center">
                        <Checkbox
                            className={checkboxDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}
                            checked={checked}
                            disabled={checkboxDisabled}
                            onChange={(_, value) => toggleSelectedKey(node.keyPath, value)}
                            aria-label={`Select file ${node.label}`}
                        />
                    </div>
                    <FileIcon className="size-4 text-muted-foreground!" />
                    <span className="min-w-0 truncate">{node.label}</span>
                </div>
                <span className="min-w-0 truncate text-xs text-muted-foreground sm:text-sm">{meta.dateModified}</span>
                <span className="text-right text-xs text-muted-foreground tabular-nums sm:text-sm">{meta.size}</span>
                <span className="min-w-0 truncate text-xs text-muted-foreground sm:text-sm">{meta.kind}</span>
            </div>
        );
    };

    const renderRows = () =>
        listedChildren.map((node) => (isFolder(node) ? renderFolderRow(node) : renderFileRow(node)));

    const renderPagination = () => {
        if (isSharePoint || isBrowseLoading || isBrowseError || !currentFolder || listedChildren.length === 0) {
            return null;
        }

        return (
            <div className="flex items-center justify-between border-t border-border px-3 py-2">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={currentBrowsePage === 0 || isSubmitting}
                    onClick={onPrevPage}
                >
                    <ChevronLeftIcon className="size-4" />
                    Prev
                </Button>
                <span className="text-xs text-muted-foreground">
                    {'Page '}
                    {currentBrowsePage + 1}
                </span>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={!hasNextPage || isSubmitting}
                    onClick={onNextPage}
                >
                    Next
                    <ChevronRightIcon className="size-4" />
                </Button>
            </div>
        );
    };

    const renderBody = () => {
        if (isBrowseLoading) {
            return (
                <div className="flex flex-1 items-center justify-center p-8">
                    <span className="text-sm text-muted-foreground">Loading...</span>
                </div>
            );
        }

        if (isBrowseError) {
            return (
                <div className="flex flex-1 items-center justify-center p-8">
                    <span className="text-sm text-muted-foreground">Failed to load folder contents.</span>
                </div>
            );
        }

        if (!currentFolder && pathSegmentsLength > 0) {
            return (
                <div className="flex flex-1 items-center justify-center p-8">
                    <span className="text-sm text-muted-foreground">Folder not found.</span>
                </div>
            );
        }

        if (currentFolder && listedChildren.length === 0) {
            return (
                <div className="flex flex-1 items-center justify-center p-8">
                    <span className="text-sm text-muted-foreground">This folder is empty.</span>
                </div>
            );
        }

        if (currentFolder && listedChildren.length > 0) {
            return (
                <>
                    {renderTableHeader()}
                    {renderRows()}
                </>
            );
        }

        return null;
    };

    return (
        <div className="scrollbar-controller scrollbar-vertical flex max-h-[50svh] min-h-[40svh] flex-1 flex-col rounded-md border border-border">
            {renderBody()}
            {renderPagination()}
        </div>
    );
};

export default BrowsePanel;
