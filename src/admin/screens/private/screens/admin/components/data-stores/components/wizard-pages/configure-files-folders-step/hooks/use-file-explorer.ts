import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useWizardExploreMutation } from '@/lib/api/admin/data-stores';
import type { ProviderType } from '@/types/admin';
import { showErrorToast } from '@/utils';

import {
    attachFetchedChildren,
    buildExplorePostBody,
    getBrowseCacheKeyFromSegments,
    getFetchKeyForFolderKeyPath,
    getSharePointBrowseFolder,
    mapExploreValuesToNodes,
    type PrefixCacheEntry,
    EXPLORE_PAGE_SIZE,
} from '../files-folders-explore-helpers';
import { buildBreadcrumb, buildBreadcrumbFromPathSegments, getFolderAtPath, sortChildren } from '../tree-utils';
import type { BreadcrumbItem, ExplorerFolderNode } from '../types';

export interface UseFileExplorerResult {
    prefixCache: Record<string, PrefixCacheEntry>;
    loadingPrefixes: Set<string>;
    failedPrefixes: Set<string>;
    fetchPrefix: (cacheKey: string, continuationToken?: string) => Promise<void>;
    pathSegments: string[];
    root: ExplorerFolderNode;
    currentFolder: ExplorerFolderNode | null;
    breadcrumbItems: BreadcrumbItem[];
    listedChildren: ExplorerFolderNode['children'];
    hasNextPage: boolean;
    isBrowseLoading: boolean;
    isBrowseError: boolean;
    currentBrowsePage: number;
    navigateToPath: (segments: string[]) => void;
    goBack: () => void;
    enterFolder: (folder: ExplorerFolderNode) => void;
    handleNextPage: () => void;
    handlePrevPage: () => void;
}

/**
 * Owns prefix-cache fetching and browse-mode navigation (path segments, pagination) for the
 * files/folders explorer. Tree-mode expansion reuses `fetchPrefix` from the returned result.
 */
export function useFileExplorer(
    dataStoreId: string | undefined,
    provider: ProviderType | null | undefined,
    isSharePoint: boolean,
): UseFileExplorerResult {
    const { mutateAsync: exploreMutateAsync } = useWizardExploreMutation();

    const [prefixCache, setPrefixCache] = useState<Record<string, PrefixCacheEntry>>({});
    const [loadingPrefixes, setLoadingPrefixes] = useState<Set<string>>(() => new Set());
    const [failedPrefixes, setFailedPrefixes] = useState<Set<string>>(() => new Set());
    const prefixCacheRef = useRef(prefixCache);
    const inFlightPrefixesRef = useRef(new Set<string>());
    const currentDataStoreIdRef = useRef(dataStoreId);

    const [pathSegments, setPathSegments] = useState<string[]>([]);
    const [currentBrowsePage, setCurrentBrowsePage] = useState(0);
    const [tokenHistory, setTokenHistory] = useState<Record<number, string>>({});

    prefixCacheRef.current = prefixCache;

    const fetchPrefix = useCallback(
        async (cacheKey: string, continuationToken?: string) => {
            if (!dataStoreId || provider == null) return;

            const effectiveKey = continuationToken ? `${cacheKey}__page__${continuationToken}` : cacheKey;

            if (prefixCacheRef.current[effectiveKey]?.fetched) return;
            if (inFlightPrefixesRef.current.has(effectiveKey)) return;

            // The data store can be switched while this request is in flight; the reset effect below
            // updates currentDataStoreIdRef, so a mismatch here means the response belongs to a data
            // store that is no longer selected and must not be written into state.
            const requestDataStoreId = dataStoreId;

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

                if (currentDataStoreIdRef.current !== requestDataStoreId) return;

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
                if (currentDataStoreIdRef.current !== requestDataStoreId) return;

                console.error(error);
                setFailedPrefixes((prev) => new Set(prev).add(effectiveKey));
                showErrorToast('Failed to load folder contents.');
            } finally {
                inFlightPrefixesRef.current.delete(effectiveKey);
                if (currentDataStoreIdRef.current === requestDataStoreId) {
                    setLoadingPrefixes((prev) => {
                        const next = new Set(prev);

                        next.delete(cacheKey);

                        return next;
                    });
                }
            }
        },
        [dataStoreId, exploreMutateAsync, provider],
    );

    useEffect(() => {
        currentDataStoreIdRef.current = dataStoreId;
        setPrefixCache({});
        setPathSegments([]);
        setFailedPrefixes(new Set());
        setCurrentBrowsePage(0);
        setTokenHistory({});
    }, [dataStoreId]);

    useEffect(() => {
        if (dataStoreId) void fetchPrefix('');
    }, [dataStoreId, fetchPrefix]);

    const activeBrowseCacheKey = useMemo(() => {
        if (provider == null) return '';

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
            children: baseChildren.map((ch) => attachFetchedChildren(ch, prefixCache, provider ?? 's3')),
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
                children: entry.children.map((ch) => attachFetchedChildren(ch, prefixCache, provider ?? 's3')),
            };
        }

        if (isSharePoint && provider != null) {
            return getSharePointBrowseFolder(pathSegments, prefixCache, provider);
        }

        return getFolderAtPath(root, pathSegments);
    }, [activeBrowseCacheKey, isSharePoint, pathSegments, prefixCache, provider, root]);

    const breadcrumbItems = useMemo(() => {
        if (isSharePoint) return buildBreadcrumbFromPathSegments(pathSegments);

        return buildBreadcrumb(root, pathSegments);
    }, [isSharePoint, pathSegments, root]);

    const listedChildren = useMemo(() => (currentFolder ? sortChildren(currentFolder.children) : []), [currentFolder]);

    const hasNextPage = useMemo(() => {
        const entry = prefixCache[activeBrowseCacheKey];

        return !!entry?.nextContinuationToken && listedChildren.length >= EXPLORE_PAGE_SIZE;
    }, [activeBrowseCacheKey, prefixCache, listedChildren.length]);

    const browseCacheKey = useMemo(
        () => (provider == null ? '' : getBrowseCacheKeyFromSegments(provider, pathSegments)),
        [provider, pathSegments],
    );

    const isBrowseLoading = useMemo(
        () =>
            loadingPrefixes.has(browseCacheKey) ||
            (pathSegments.length === 0 && !prefixCache['']?.fetched && !!dataStoreId && !failedPrefixes.has('')),
        [browseCacheKey, dataStoreId, failedPrefixes, loadingPrefixes, pathSegments.length, prefixCache],
    );
    const isBrowseError = failedPrefixes.has(activeBrowseCacheKey);

    const navigateToPath = useCallback(
        (segments: string[]) => {
            setPathSegments(segments);
            setCurrentBrowsePage(0);
            setTokenHistory({});
            if (provider == null) return;

            void fetchPrefix(getBrowseCacheKeyFromSegments(provider, segments));
        },
        [fetchPrefix, provider],
    );

    const goBack = useCallback(() => {
        setPathSegments((prev) => {
            const next = prev.slice(0, -1);

            if (provider != null) void fetchPrefix(getBrowseCacheKeyFromSegments(provider, next));

            return next;
        });
        setCurrentBrowsePage(0);
        setTokenHistory({});
    }, [fetchPrefix, provider]);

    const enterFolder = useCallback(
        (folder: ExplorerFolderNode) => {
            const segments = folder.keyPath ? folder.keyPath.split('/').filter(Boolean) : [];

            if (provider != null) void fetchPrefix(getFetchKeyForFolderKeyPath(provider, folder.keyPath));
            setPathSegments(segments);
            setCurrentBrowsePage(0);
            setTokenHistory({});
        },
        [fetchPrefix, provider],
    );

    const handleNextPage = useCallback(() => {
        if (provider == null) return;

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
        if (currentBrowsePage <= 0 || provider == null) return;

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

    return {
        prefixCache,
        loadingPrefixes,
        failedPrefixes,
        fetchPrefix,
        pathSegments,
        root,
        currentFolder,
        breadcrumbItems,
        listedChildren,
        hasNextPage,
        isBrowseLoading,
        isBrowseError,
        currentBrowsePage,
        navigateToPath,
        goBack,
        enterFolder,
        handleNextPage,
        handlePrevPage,
    };
}
