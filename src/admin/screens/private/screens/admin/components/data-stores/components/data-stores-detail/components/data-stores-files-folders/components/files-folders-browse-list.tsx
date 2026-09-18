import { FileIcon, FolderIcon } from 'lucide-react';

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
} from '../../../../wizard-pages/configure-files-folders-step/tree-utils';
import type {
    ExplorerFileNode,
    ExplorerFolderNode,
    ExplorerNode,
} from '../../../../wizard-pages/configure-files-folders-step/types';

export interface FilesFoldersBrowseListProps {
    isLoading: boolean;
    isError: boolean;
    currentFolder: ExplorerFolderNode | null;
    listedChildren: ExplorerNode[];
    pathSegments: string[];
    selectedKeys: Set<string>;
    isSubmitting: boolean;
    onEnterFolder: (folder: ExplorerFolderNode) => void;
    onToggleSelectedKey: (keyPath: string, checked: boolean) => void;
}

const renderListHeader = () => (
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

const FilesFoldersBrowseList = (props: FilesFoldersBrowseListProps) => {
    const {
        isLoading,
        isError,
        currentFolder,
        listedChildren,
        pathSegments,
        selectedKeys,
        isSubmitting,
        onEnterFolder,
        onToggleSelectedKey,
    } = props;

    const renderFolderRow = (node: ExplorerFolderNode) => {
        const checked = isPathSelectedOrUnderSelectedFolder(node.keyPath, selectedKeys);
        const checkboxDisabled = isSubmitting || isPathUnderSelectedFolder(node.keyPath, selectedKeys);

        return (
            <div
                key={node.keyPath}
                className={cn(TREE_ROW_GRID, 'min-h-[44px] cursor-pointer px-2 py-1.5 text-sm hover:bg-muted/60')}
                onClick={() => {
                    if (!isSubmitting) onEnterFolder(node);
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (!isSubmitting) onEnterFolder(node);
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
                            onChange={(_, value) => onToggleSelectedKey(node.keyPath, value)}
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

    const renderFileRow = (node: ExplorerFileNode) => {
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
                            onChange={(_, value) => onToggleSelectedKey(node.keyPath, value)}
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

    const renderStatus = (message: string) => (
        <div className="flex flex-1 items-center justify-center p-8">
            <span className="text-sm text-muted-foreground">{message}</span>
        </div>
    );

    return (
        <div className="scrollbar-controller scrollbar-vertical flex max-h-[55svh] min-h-[50svh] flex-1 flex-col rounded-md border border-border">
            {isLoading && renderStatus('Loading...')}
            {!isLoading && isError && renderStatus('Failed to load folder contents.')}
            {!isLoading && !isError && !currentFolder && pathSegments.length > 0 && renderStatus('Folder not found.')}
            {!isLoading &&
                !isError &&
                currentFolder &&
                listedChildren.length === 0 &&
                renderStatus('This folder is empty.')}
            {!isLoading && !isError && currentFolder && listedChildren.length > 0 && renderListHeader()}
            {!isLoading &&
                !isError &&
                currentFolder &&
                listedChildren.map((node) => (isFolder(node) ? renderFolderRow(node) : renderFileRow(node)))}
        </div>
    );
};

export default FilesFoldersBrowseList;
