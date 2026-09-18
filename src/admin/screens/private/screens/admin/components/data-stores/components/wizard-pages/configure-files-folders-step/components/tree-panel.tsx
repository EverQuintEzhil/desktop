import { cn } from '@/lib/utils';
import type { ProviderType } from '@/types/admin';

import type { PrefixCacheEntry } from '../files-folders-explore-helpers';
import { TreeExplorerBody } from '../tree-explorer-components';
import { sortChildren, TREE_ROW_GRID } from '../tree-utils';
import type { ExplorerNode } from '../types';

export interface TreePanelProps {
    nodes: ExplorerNode[];
    expandedFolderKeys: Set<string>;
    selectedKeys: Set<string>;
    isSubmitting: boolean;
    toggleTreeFolderExpanded: (keyPath: string) => void;
    toggleSelectedKey: (keyPath: string, checked: boolean) => void;
    loadingPrefixes: Set<string>;
    failedPrefixes: Set<string>;
    prefixCache: Record<string, PrefixCacheEntry>;
    provider: ProviderType | null | undefined;
    hasDataStore: boolean;
}

const TreePanel = ({
    nodes,
    expandedFolderKeys,
    selectedKeys,
    isSubmitting,
    toggleTreeFolderExpanded,
    toggleSelectedKey,
    loadingPrefixes,
    failedPrefixes,
    prefixCache,
    provider,
    hasDataStore,
}: TreePanelProps) => {
    const rootFetched = !!prefixCache['']?.fetched;
    const rootFailed = failedPrefixes.has('');
    const rootLoading = loadingPrefixes.has('');

    const renderRootState = () => {
        if (rootFailed && !rootFetched && hasDataStore) {
            return (
                <div className="flex min-h-[200px] flex-1 items-center justify-center p-8">
                    <span className="text-sm text-muted-foreground">Failed to load folder contents.</span>
                </div>
            );
        }

        if (!rootFailed && rootLoading && !rootFetched && hasDataStore) {
            return (
                <div className="flex min-h-[200px] flex-1 items-center justify-center p-8">
                    <span className="text-sm text-muted-foreground">Loading...</span>
                </div>
            );
        }

        const canShowBody =
            (!rootFailed || rootFetched || !hasDataStore) && (!rootLoading || rootFetched || !hasDataStore);

        if (!canShowBody) return null;

        return (
            <TreeExplorerBody
                nodes={sortChildren(nodes)}
                depth={0}
                expandedFolderKeys={expandedFolderKeys}
                selectedKeys={selectedKeys}
                selectionDisabled={isSubmitting}
                toggleTreeFolderExpanded={toggleTreeFolderExpanded}
                toggleSelectedKey={toggleSelectedKey}
                loadingPrefixes={loadingPrefixes}
                provider={provider ?? 's3'}
            />
        );
    };

    return (
        <div className="flex max-h-[50svh] min-h-[40svh] flex-1 flex-col overflow-hidden rounded-md border border-border">
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
            <div className="scrollbar-controller scrollbar-vertical scrollbar-horizontal min-h-0 flex-1">
                {renderRootState()}
            </div>
        </div>
    );
};

export default TreePanel;
