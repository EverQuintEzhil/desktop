import {
    ArrowLeftIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    FileIcon,
    FolderTreeIcon,
    FolderIcon,
    TablePropertiesIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import Switch from '@/components/ui/switch';
import { useWizardExploreMutation } from '@/lib/api/admin/data-stores';
import { cn } from '@/lib/utils';
import type { ProviderType } from '@/types/admin';
import { showErrorToast } from '@/utils';

import {
    attachFetchedChildren,
    buildExplorePostBody,
    getBrowseCacheKeyFromSegments,
    getFetchKeyForFolderKeyPath,
    mapExploreValuesToNodes,
    type PrefixCacheEntry,
    EXPLORE_PAGE_SIZE,
} from '../configure-files-folders-step/files-folders-explore-helpers';
import { TreeExplorerBody } from '../configure-files-folders-step/tree-explorer-components';
import {
    buildBreadcrumb,
    getFileColumnMeta,
    getFolderDateDisplay,
    getFolderSizeDisplay,
    getFolderAtPath,
    isFolder,
    sortChildren,
    TREE_ROW_GRID,
} from '../configure-files-folders-step/tree-utils';
import type { ExplorerFolderNode, ExplorerViewMode } from '../configure-files-folders-step/types';
import '../configure-files-folders-step/configure-files-folders-step.scss';

interface S3FileBrowserProps {
    dataStoreId: string;
    provider: ProviderType;
    isWizardPage?: boolean;
}

const S3FileBrowser = ({ dataStoreId, provider, isWizardPage = false }: S3FileBrowserProps) => {
    const { mutateAsync: exploreMutateAsync } = useWizardExploreMutation();

    const [viewMode, setViewMode] = useState<ExplorerViewMode>('browse');
    const [pathSegments, setPathSegments] = useState<string[]>([]);
    const [expandedFolderKeys, setExpandedFolderKeys] = useState<Set<string>>(() => new Set());

    const [prefixCache, setPrefixCache] = useState<Record<string, PrefixCacheEntry>>({});
    const [loadingPrefixes, setLoadingPrefixes] = useState<Set<string>>(() => new Set());
    const [failedPrefixes, setFailedPrefixes] = useState<Set<string>>(() => new Set());
    const prefixCacheRef = useRef(prefixCache);
    const inFlightPrefixesRef = useRef(new Set<string>());

    const [currentBrowsePage, setCurrentBrowsePage] = useState(0);
    const [tokenHistory, setTokenHistory] = useState<Record<number, string>>({});

    prefixCacheRef.current = prefixCache;

    const fetchPrefix = useCallback(
        async (cacheKey: string, continuationToken?: string) => {
            const effectiveKey = continuationToken ? `${cacheKey}__page__${continuationToken}` : cacheKey;

            if (prefixCacheRef.current[effectiveKey]?.fetched) return;
            if (inFlightPrefixesRef.current.has(effectiveKey)) return;

            inFlightPrefixesRef.current.add(effectiveKey);
            setFailedPrefixes((prev) => {
                const next = new Set(prev);

                next.delete(effectiveKey);

                return next;
            });
            setLoadingPrefixes((prev) => new Set(prev).add(cacheKey));

            try {
                const result = await exploreMutateAsync({
                    id: dataStoreId,
                    data: buildExplorePostBody(provider, cacheKey, continuationToken),
                });

                const values = ((result as { values?: unknown[] })?.values ?? []) as unknown[];
                const children = sortChildren(mapExploreValuesToNodes(provider, values));
                const nextToken =
                    (result as { page_info?: { next_continuation_token?: string | null } })?.page_info
                        ?.next_continuation_token ?? null;

                setPrefixCache((prev) => ({
                    ...prev,
                    [effectiveKey]: { fetched: true, children, nextContinuationToken: nextToken },
                }));
            } catch (error) {
                console.error(error);
                setFailedPrefixes((prev) => new Set(prev).add(effectiveKey));
                showErrorToast('Failed to load folder contents.');
            } finally {
                inFlightPrefixesRef.current.delete(effectiveKey);
                setLoadingPrefixes((prev) => {
                    const next = new Set(prev);

                    next.delete(cacheKey);

                    return next;
                });
            }
        },
        [dataStoreId, exploreMutateAsync, provider],
    );

    useEffect(() => {
        void fetchPrefix('');
    }, [fetchPrefix]);

    const activeBrowseCacheKey = useMemo(() => {
        const base = getBrowseCacheKeyFromSegments(provider, pathSegments);
        const token = tokenHistory[currentBrowsePage];

        return token ? `${base}__page__${token}` : base;
    }, [provider, pathSegments, currentBrowsePage, tokenHistory]);

    const root = useMemo((): ExplorerFolderNode => {
        const rootEntry = prefixCache[''];
        const baseChildren = rootEntry?.children ?? [];

        return {
            type: 'folder',
            keyPath: '',
            label: 'Root',
            children: baseChildren.map((ch) => attachFetchedChildren(ch, prefixCache, provider)),
        };
    }, [prefixCache, provider]);

    const currentFolder = useMemo(() => {
        const entry = prefixCache[activeBrowseCacheKey];

        if (entry?.fetched) {
            const label = pathSegments.length === 0 ? 'Root' : pathSegments[pathSegments.length - 1];

            return {
                type: 'folder' as const,
                keyPath: pathSegments.join('/'),
                label,
                children: entry.children.map((ch) => attachFetchedChildren(ch, prefixCache, provider)),
            };
        }

        return getFolderAtPath(root, pathSegments);
    }, [activeBrowseCacheKey, pathSegments, prefixCache, provider, root]);

    const breadcrumbItems = useMemo(() => buildBreadcrumb(root, pathSegments), [pathSegments, root]);

    const listedChildren = useMemo(() => (currentFolder ? sortChildren(currentFolder.children) : []), [currentFolder]);

    const hasNextPage = useMemo(() => {
        const entry = prefixCache[activeBrowseCacheKey];

        return !!entry?.nextContinuationToken && listedChildren.length >= EXPLORE_PAGE_SIZE;
    }, [activeBrowseCacheKey, prefixCache, listedChildren.length]);

    const browseCacheKey = useMemo(
        () => getBrowseCacheKeyFromSegments(provider, pathSegments),
        [provider, pathSegments],
    );

    const isBrowseLoading = useMemo(
        () =>
            loadingPrefixes.has(browseCacheKey) ||
            (pathSegments.length === 0 && !prefixCache['']?.fetched && !failedPrefixes.has('')),
        [browseCacheKey, failedPrefixes, loadingPrefixes, pathSegments.length, prefixCache],
    );
    const isBrowseError = failedPrefixes.has(activeBrowseCacheKey);

    const navigateToPath = useCallback(
        (segments: string[]) => {
            setPathSegments(segments);
            setCurrentBrowsePage(0);
            setTokenHistory({});
            void fetchPrefix(getBrowseCacheKeyFromSegments(provider, segments));
        },
        [fetchPrefix, provider],
    );

    const goBack = useCallback(() => {
        setPathSegments((prev) => {
            const next = prev.slice(0, -1);

            void fetchPrefix(getBrowseCacheKeyFromSegments(provider, next));

            return next;
        });
        setCurrentBrowsePage(0);
        setTokenHistory({});
    }, [fetchPrefix, provider]);

    const enterFolder = useCallback(
        (folder: ExplorerFolderNode) => {
            const segments = folder.keyPath ? folder.keyPath.split('/').filter(Boolean) : [];

            void fetchPrefix(getFetchKeyForFolderKeyPath(provider, folder.keyPath));
            setPathSegments(segments);
            setCurrentBrowsePage(0);
            setTokenHistory({});
        },
        [fetchPrefix, provider],
    );

    const handleNextPage = useCallback(() => {
        const entry = prefixCache[activeBrowseCacheKey];
        const nextToken = entry?.nextContinuationToken;

        if (!nextToken) return;

        const nextPage = currentBrowsePage + 1;

        setTokenHistory((prev) => ({ ...prev, [nextPage]: nextToken }));
        setCurrentBrowsePage(nextPage);

        const baseCacheKey = getBrowseCacheKeyFromSegments(provider, pathSegments);

        void fetchPrefix(baseCacheKey, nextToken);
    }, [activeBrowseCacheKey, currentBrowsePage, fetchPrefix, pathSegments, prefixCache, provider]);

    const handlePrevPage = useCallback(() => {
        if (currentBrowsePage <= 0) return;

        const prevPage = currentBrowsePage - 1;

        setCurrentBrowsePage(prevPage);

        if (prevPage === 0) {
            const baseCacheKey = getBrowseCacheKeyFromSegments(provider, pathSegments);

            void fetchPrefix(baseCacheKey);
        } else {
            const prevToken = tokenHistory[prevPage];
            const baseCacheKey = getBrowseCacheKeyFromSegments(provider, pathSegments);

            void fetchPrefix(baseCacheKey, prevToken);
        }
    }, [currentBrowsePage, fetchPrefix, pathSegments, provider, tokenHistory]);

    const toggleTreeFolderExpanded = useCallback(
        (keyPath: string) => {
            setExpandedFolderKeys((prev) => {
                const next = new Set(prev);

                if (next.has(keyPath)) {
                    next.delete(keyPath);
                } else {
                    next.add(keyPath);
                    void fetchPrefix(getFetchKeyForFolderKeyPath(provider, keyPath));
                }

                return next;
            });
        },
        [fetchPrefix, provider],
    );

    const canGoUp = pathSegments.length > 0;

    const viewToggle = (
        <div className="inline-flex shrink-0 items-center" role="group" aria-label="Explorer view mode">
            <Switch
                options={[
                    { label: 'Browse', icon: TablePropertiesIcon },
                    { label: 'Tree', icon: FolderTreeIcon },
                ]}
                activeIndex={viewMode === 'browse' ? 0 : 1}
                onChange={(_event, index) => {
                    setViewMode(index === 0 ? 'browse' : 'tree');
                }}
                width={100}
            />
        </div>
    );

    return (
        <div className="configure-files-folders-step flex min-h-0 min-w-0 flex-1 flex-col gap-4">
            <div className="flex flex-col gap-3 border-b border-border pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                        {viewMode === 'browse' && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-1.5"
                                disabled={!canGoUp}
                                onClick={goBack}
                                aria-label="Go up one folder"
                            >
                                <ArrowLeftIcon className="size-4" />
                                Back
                            </Button>
                        )}
                    </div>
                    {viewToggle}
                </div>
                {viewMode === 'browse' && (
                    <nav
                        className="configure-files-folders-breadcrumb flex flex-wrap items-center gap-1 text-sm"
                        aria-label="Folder path"
                    >
                        {breadcrumbItems.map((item, idx) => {
                            const isLast = idx === breadcrumbItems.length - 1;

                            return (
                                <div
                                    key={item.pathSegments.join('/') || 'root'}
                                    className="flex min-w-0 items-center gap-1"
                                >
                                    {idx > 0 && (
                                        <ChevronRightIcon className="size-4 text-muted-foreground!" aria-hidden />
                                    )}
                                    <button
                                        type="button"
                                        className={cn(
                                            'min-w-0 cursor-pointer truncate rounded px-1 py-0.5 text-left transition-colors',
                                            'hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                                            isLast && 'font-medium text-foreground',
                                            !isLast && 'text-muted-foreground hover:text-foreground',
                                        )}
                                        onClick={() => navigateToPath(item.pathSegments)}
                                        aria-current={isLast ? 'page' : undefined}
                                        title={item.label}
                                    >
                                        {item.label}
                                    </button>
                                </div>
                            );
                        })}
                    </nav>
                )}
            </div>

            {viewMode === 'browse' && (
                <>
                    <div
                        className={cn(
                            'scrollbar-controller scrollbar-vertical flex max-h-[calc(100svh-136px-210px)] min-h-[55svh] flex-1 flex-col rounded-md border border-border bg-card',
                            isWizardPage && 'max-h-[calc(100svh-136px-390px)] min-h-[45svh]',
                        )}
                    >
                        {isBrowseLoading && (
                            <div className="flex flex-1 items-center justify-center p-8">
                                <span className="text-sm text-muted-foreground">Loading...</span>
                            </div>
                        )}
                        {!isBrowseLoading && isBrowseError && (
                            <div className="flex flex-1 items-center justify-center p-8">
                                <span className="text-sm text-muted-foreground">Failed to load folder contents.</span>
                            </div>
                        )}
                        {!isBrowseLoading && !isBrowseError && !currentFolder && pathSegments.length > 0 && (
                            <div className="flex flex-1 items-center justify-center p-8">
                                <span className="text-sm text-muted-foreground">Folder not found.</span>
                            </div>
                        )}
                        {!isBrowseLoading && !isBrowseError && currentFolder && listedChildren.length === 0 && (
                            <div className="flex flex-1 items-center justify-center p-8">
                                <span className="text-sm text-muted-foreground">This folder is empty.</span>
                            </div>
                        )}
                        {!isBrowseLoading && !isBrowseError && currentFolder && listedChildren.length > 0 && (
                            <div
                                className={cn(
                                    TREE_ROW_GRID,
                                    'configure-files-folders-tree-header sticky top-0 z-1 bg-muted/80 px-2 py-2 text-xs font-medium text-muted-foreground backdrop-blur-sm',
                                )}
                            >
                                <span className="min-w-0 pl-3">Name</span>
                                <span className="whitespace-nowrap">Date modified</span>
                                <span className="text-right">Size</span>
                                <span className="min-w-0">Kind</span>
                            </div>
                        )}
                        {!isBrowseLoading &&
                            !isBrowseError &&
                            currentFolder &&
                            listedChildren.map((node) => {
                                if (isFolder(node)) {
                                    return (
                                        <div
                                            key={node.keyPath}
                                            role="button"
                                            tabIndex={0}
                                            className={cn(
                                                TREE_ROW_GRID,
                                                'min-h-[44px] cursor-pointer px-2 py-1.5 text-sm hover:bg-muted/60',
                                            )}
                                            onClick={() => enterFolder(node)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    enterFolder(node);
                                                }
                                            }}
                                        >
                                            <div className="flex min-w-0 items-center gap-1.5 pl-1">
                                                <FolderIcon className="size-4" />
                                                <span className="min-w-0 truncate font-medium">{node.label}</span>
                                            </div>
                                            <span className="min-w-0 truncate text-xs text-muted-foreground sm:text-sm">
                                                {getFolderDateDisplay(node)}
                                            </span>
                                            <span className="text-right text-xs text-muted-foreground tabular-nums sm:text-sm">
                                                {getFolderSizeDisplay(node)}
                                            </span>
                                            <span className="min-w-0 truncate text-xs text-muted-foreground sm:text-sm">
                                                Folder
                                            </span>
                                        </div>
                                    );
                                }

                                const meta = getFileColumnMeta(node);

                                return (
                                    <div
                                        key={node.keyPath}
                                        className={cn(TREE_ROW_GRID, 'min-h-[44px] px-2 py-1.5 text-sm')}
                                    >
                                        <div className="flex min-w-0 items-center gap-1.5 pl-1">
                                            <FileIcon className="size-4 text-muted-foreground!" />
                                            <span className="min-w-0 truncate">{node.label}</span>
                                        </div>
                                        <span className="min-w-0 truncate text-xs text-muted-foreground sm:text-sm">
                                            {meta.dateModified}
                                        </span>
                                        <span className="text-right text-xs text-muted-foreground tabular-nums sm:text-sm">
                                            {meta.size}
                                        </span>
                                        <span className="min-w-0 truncate text-xs text-muted-foreground sm:text-sm">
                                            {meta.kind}
                                        </span>
                                    </div>
                                );
                            })}
                    </div>

                    {!isBrowseLoading && !isBrowseError && currentFolder && listedChildren.length > 0 && (
                        <div className="flex items-center justify-between border-t border-border px-3 py-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-1.5"
                                disabled={currentBrowsePage === 0}
                                onClick={handlePrevPage}
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
                                disabled={!hasNextPage}
                                onClick={handleNextPage}
                            >
                                Next
                                <ChevronRightIcon className="size-4" />
                            </Button>
                        </div>
                    )}
                </>
            )}

            {viewMode === 'tree' && (
                <div
                    className={cn(
                        'flex max-h-[70svh] min-h-[55svh] flex-1 flex-col overflow-hidden rounded-md border border-border bg-card',
                        isWizardPage && 'max-h-[55svh] min-h-[45svh]',
                    )}
                >
                    <div
                        className={cn(
                            TREE_ROW_GRID,
                            'configure-files-folders-tree-header sticky top-0 z-1 bg-muted/80 px-2 py-2 text-xs font-medium text-muted-foreground backdrop-blur-sm',
                        )}
                    >
                        <span className="min-w-0 pl-3">Name</span>
                        <span className="whitespace-nowrap">Date modified</span>
                        <span className="text-right">Size</span>
                        <span className="min-w-0">Kind</span>
                    </div>
                    <div className="scrollbar-controller scrollbar-vertical scrollbar-horizontal min-h-0 flex-1">
                        {failedPrefixes.has('') && !prefixCache['']?.fetched && (
                            <div className="flex min-h-[200px] flex-1 items-center justify-center p-8">
                                <span className="text-sm text-muted-foreground">Failed to load folder contents.</span>
                            </div>
                        )}
                        {!failedPrefixes.has('') && loadingPrefixes.has('') && !prefixCache['']?.fetched && (
                            <div className="flex min-h-[200px] flex-1 items-center justify-center p-8">
                                <span className="text-sm text-muted-foreground">Loading...</span>
                            </div>
                        )}
                        {!failedPrefixes.has('') && (!loadingPrefixes.has('') || prefixCache['']?.fetched) && (
                            <TreeExplorerBody
                                nodes={sortChildren(root.children)}
                                depth={0}
                                expandedFolderKeys={expandedFolderKeys}
                                selectedKeys={new Set<string>()}
                                selectionDisabled
                                hideCheckboxes={true}
                                toggleTreeFolderExpanded={toggleTreeFolderExpanded}
                                toggleSelectedKey={() => {}}
                                loadingPrefixes={loadingPrefixes}
                                provider={provider}
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default S3FileBrowser;
