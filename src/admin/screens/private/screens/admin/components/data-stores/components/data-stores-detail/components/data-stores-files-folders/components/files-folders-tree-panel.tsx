import { cn } from '@/lib/utils';
import type { ProviderType } from '@/types/admin';

import type { PrefixCacheEntry } from '../../../../wizard-pages/configure-files-folders-step/files-folders-explore-helpers';
import { TreeExplorerBody } from '../../../../wizard-pages/configure-files-folders-step/tree-explorer-components';
import { sortChildren, TREE_ROW_GRID } from '../../../../wizard-pages/configure-files-folders-step/tree-utils';
import type { ExplorerFolderNode } from '../../../../wizard-pages/configure-files-folders-step/types';

export interface FilesFoldersTreePanelProps {
    root: ExplorerFolderNode;
    prefixCache: Record<string, PrefixCacheEntry>;
    loadingPrefixes: Set<string>;
    failedPrefixes: Set<string>;
    expandedFolderKeys: Set<string>;
    selectedKeys: Set<string>;
    isSubmitting: boolean;
    provider: ProviderType;
    onToggleTreeFolderExpanded: (keyPath: string) => void;
    onToggleSelectedKey: (keyPath: string, checked: boolean) => void;
}

const renderTreeHeader = () => (
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

const FilesFoldersTreePanel = (props: FilesFoldersTreePanelProps) => {
    const {
        root,
        prefixCache,
        loadingPrefixes,
        failedPrefixes,
        expandedFolderKeys,
        selectedKeys,
        isSubmitting,
        provider,
        onToggleTreeFolderExpanded,
        onToggleSelectedKey,
    } = props;

    const rootFetched = !!prefixCache['']?.fetched;
    const rootFailed = failedPrefixes.has('');
    const rootLoading = loadingPrefixes.has('');

    return (
        <div className="flex max-h-[55svh] min-h-[50svh] flex-1 flex-col overflow-hidden rounded-md border border-border">
            {renderTreeHeader()}
            <div className="scrollbar-controller scrollbar-vertical scrollbar-horizontal min-h-0 flex-1">
                {rootFailed && !rootFetched && (
                    <div className="flex min-h-[200px] flex-1 items-center justify-center p-8">
                        <span className="text-sm text-muted-foreground">Failed to load folder contents.</span>
                    </div>
                )}
                {!rootFailed && rootLoading && !rootFetched && (
                    <div className="flex min-h-[200px] flex-1 items-center justify-center p-8">
                        <span className="text-sm text-muted-foreground">Loading...</span>
                    </div>
                )}
                {!rootFailed && (!rootLoading || rootFetched) && (
                    <TreeExplorerBody
                        nodes={sortChildren(root.children)}
                        depth={0}
                        expandedFolderKeys={expandedFolderKeys}
                        selectedKeys={selectedKeys}
                        selectionDisabled={isSubmitting}
                        toggleTreeFolderExpanded={onToggleTreeFolderExpanded}
                        toggleSelectedKey={onToggleSelectedKey}
                        loadingPrefixes={loadingPrefixes}
                        provider={provider}
                    />
                )}
            </div>
        </div>
    );
};

export default FilesFoldersTreePanel;
