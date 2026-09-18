import { ChevronDownIcon, ChevronRightIcon, FileIcon, FolderIcon } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import SpinnerBlade from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import type { ProviderType } from '@/types/admin';

import { getFetchKeyForFolderKeyPath } from './files-folders-explore-helpers';
import {
    getFileColumnMeta,
    getFolderDateDisplay,
    getFolderSizeDisplay,
    isFolder,
    isPathSelectedOrUnderSelectedFolder,
    isPathUnderSelectedFolder,
    sortChildren,
    TREE_ROW_GRID,
} from './tree-utils';
import type { TreeBodyProps, TreeFileRowProps, TreeFolderRowsProps } from './types';

const EMPTY_LOADING_PREFIXES = new Set<string>();

const DEFAULT_EXPLORE_PROVIDER = 's3' satisfies ProviderType;

export function TreeExplorerBody({
    nodes,
    depth,
    expandedFolderKeys,
    selectedKeys,
    selectionDisabled,
    hideCheckboxes,
    toggleTreeFolderExpanded,
    toggleSelectedKey,
    loadingPrefixes = EMPTY_LOADING_PREFIXES,
    provider = DEFAULT_EXPLORE_PROVIDER,
}: TreeBodyProps) {
    return (
        <>
            {nodes.map((node) => (
                <Fragment key={node.keyPath}>
                    {isFolder(node) ? (
                        <TreeFolderRows
                            folder={node}
                            depth={depth}
                            expandedFolderKeys={expandedFolderKeys}
                            selectedKeys={selectedKeys}
                            selectionDisabled={selectionDisabled}
                            hideCheckboxes={hideCheckboxes}
                            toggleTreeFolderExpanded={toggleTreeFolderExpanded}
                            toggleSelectedKey={toggleSelectedKey}
                            loadingPrefixes={loadingPrefixes}
                            provider={provider}
                        />
                    ) : (
                        <TreeFileRow
                            file={node}
                            depth={depth}
                            selectedKeys={selectedKeys}
                            selectionDisabled={selectionDisabled}
                            hideCheckboxes={hideCheckboxes}
                            toggleSelectedKey={toggleSelectedKey}
                        />
                    )}
                </Fragment>
            ))}
        </>
    );
}

export function TreeFolderRows({
    folder,
    depth,
    expandedFolderKeys,
    selectedKeys,
    selectionDisabled,
    hideCheckboxes,
    toggleTreeFolderExpanded,
    toggleSelectedKey,
    loadingPrefixes,
    provider = DEFAULT_EXPLORE_PROVIDER,
}: TreeFolderRowsProps) {
    const hasChildren = folder.children.length > 0 || !!folder.listingPending;
    const isExpanded = expandedFolderKeys.has(folder.keyPath);
    const checked = isPathSelectedOrUnderSelectedFolder(folder.keyPath, selectedKeys);
    const checkboxDisabled = selectionDisabled || isPathUnderSelectedFolder(folder.keyPath, selectedKeys);
    const isFolderLoading = loadingPrefixes.has(getFetchKeyForFolderKeyPath(provider, folder.keyPath));
    const indentPx = 10 + depth * 16;

    let expandAffordance: ReactNode;

    if (isFolderLoading) {
        expandAffordance = <SpinnerBlade className="size-4 shrink-0 scale-90" aria-hidden />;
    } else if (isExpanded) {
        expandAffordance = <ChevronDownIcon className="size-4" />;
    } else {
        expandAffordance = <ChevronRightIcon className="size-4" />;
    }

    return (
        <>
            <div className={cn(TREE_ROW_GRID, 'min-h-[44px] px-2 py-1.5 text-sm', checked && 'bg-primary/15')}>
                <div className="flex min-w-0 items-center gap-1.5" style={{ paddingLeft: indentPx }}>
                    {!hideCheckboxes && (
                        <div
                            className="flex shrink-0 items-center"
                            onClick={(e) => e.stopPropagation()}
                            role="presentation"
                        >
                            <Checkbox
                                checked={checked}
                                disabled={checkboxDisabled}
                                onChange={(_, value) => toggleSelectedKey(folder.keyPath, value)}
                                className={checkboxDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}
                                aria-label={`Select folder ${folder.label}`}
                            />
                        </div>
                    )}
                    <div className="flex w-5 shrink-0 justify-center">
                        {hasChildren ? (
                            <button
                                type="button"
                                className={cn(
                                    'cursor-pointer rounded p-0.5 text-muted-foreground',
                                    'hover:bg-muted hover:text-foreground',
                                    'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                                )}
                                aria-busy={isFolderLoading}
                                aria-expanded={isExpanded}
                                aria-label={isExpanded ? `Collapse ${folder.label}` : `Expand ${folder.label}`}
                                disabled={selectionDisabled}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (!selectionDisabled) toggleTreeFolderExpanded(folder.keyPath);
                                }}
                            >
                                {expandAffordance}
                            </button>
                        ) : (
                            <span className="inline-block w-4" aria-hidden />
                        )}
                    </div>
                    <FolderIcon className="size-4" />
                    <span className="min-w-0 truncate font-medium">{folder.label}</span>
                </div>
                <span className="min-w-0 truncate text-xs text-muted-foreground sm:text-sm">
                    {getFolderDateDisplay(folder)}
                </span>
                <span className="text-right text-xs text-muted-foreground tabular-nums sm:text-sm">
                    {getFolderSizeDisplay(folder)}
                </span>
                <span className="min-w-0 truncate text-xs text-muted-foreground sm:text-sm">Folder</span>
            </div>
            {hasChildren && isExpanded && (
                <TreeExplorerBody
                    nodes={sortChildren(folder.children)}
                    depth={depth + 1}
                    expandedFolderKeys={expandedFolderKeys}
                    selectedKeys={selectedKeys}
                    selectionDisabled={selectionDisabled}
                    hideCheckboxes={hideCheckboxes}
                    toggleTreeFolderExpanded={toggleTreeFolderExpanded}
                    toggleSelectedKey={toggleSelectedKey}
                    loadingPrefixes={loadingPrefixes}
                    provider={provider}
                />
            )}
        </>
    );
}

export function TreeFileRow({
    file,
    depth,
    selectedKeys,
    selectionDisabled,
    hideCheckboxes,
    toggleSelectedKey,
}: TreeFileRowProps) {
    const checked = isPathSelectedOrUnderSelectedFolder(file.keyPath, selectedKeys);
    const checkboxDisabled = selectionDisabled || isPathUnderSelectedFolder(file.keyPath, selectedKeys);
    const meta = getFileColumnMeta(file);
    const indentPx = 10 + depth * 16;

    return (
        <div className={cn(TREE_ROW_GRID, 'min-h-[44px] px-2 py-1.5 text-sm', checked && 'bg-primary/15')}>
            <div className="flex min-w-0 items-center gap-1.5" style={{ paddingLeft: indentPx }}>
                {!hideCheckboxes && (
                    <>
                        <div className="flex shrink-0 items-center">
                            <Checkbox
                                checked={checked}
                                disabled={checkboxDisabled}
                                className={checkboxDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}
                                onChange={(_, value) => toggleSelectedKey(file.keyPath, value)}
                                aria-label={`Select file ${file.label}`}
                            />
                        </div>
                        <span className="inline-block w-5 shrink-0" aria-hidden />
                    </>
                )}
                <FileIcon className="size-4 text-muted-foreground!" />
                <span className="min-w-0 truncate">{file.label}</span>
            </div>
            <span className="min-w-0 truncate text-xs text-muted-foreground sm:text-sm">{meta.dateModified}</span>
            <span className="text-right text-xs text-muted-foreground tabular-nums sm:text-sm">{meta.size}</span>
            <span className="min-w-0 truncate text-xs text-muted-foreground sm:text-sm">{meta.kind}</span>
        </div>
    );
}
