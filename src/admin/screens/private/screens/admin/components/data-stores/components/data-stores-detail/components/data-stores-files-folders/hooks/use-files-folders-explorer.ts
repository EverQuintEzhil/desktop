import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useWizardExploreMutation, useWizardSaveEmbeddingConfigMutation } from '@/lib/api/admin/data-stores';
import type { DataStoreType } from '@/types/admin';
import { showErrorToast, showSuccessToast } from '@/utils';

import {
    attachFetchedChildren,
    buildExplorePostBody,
    getBrowseCacheKeyFromSegments,
    getFetchKeyForFolderKeyPath,
    getSharePointBrowseFolder,
    isSharePointProvider,
    mapExploreValuesToNodes,
    type PrefixCacheEntry,
    EXPLORE_PAGE_SIZE,
} from '../../../../wizard-pages/configure-files-folders-step/files-folders-explore-helpers';
import {
    buildBreadcrumb,
    buildBreadcrumbFromPathSegments,
    getFolderAtPath,
    isStrictPathAncestor,
    normalizeSelectionKeys,
    setsEqualString,
    sortChildren,
} from '../../../../wizard-pages/configure-files-folders-step/tree-utils';
import type { ExplorerFolderNode, ExplorerViewMode } from '../../../../wizard-pages/configure-files-folders-step/types';

interface UseFilesFoldersExplorerResult {
    isSubmitting: boolean;
    formError: string;
    viewMode: ExplorerViewMode;
    setViewMode: (mode: ExplorerViewMode) => void;
    provider: DataStoreType['provider'];
    isSharePoint: boolean;
    pathSegments: string[];
    expandedFolderKeys: Set<string>;
    selectedKeys: Set<string>;
    prefixCache: Record<string, PrefixCacheEntry>;
    loadingPrefixes: Set<string>;
    failedPrefixes: Set<string>;
    currentBrowsePage: number;
    root: ExplorerFolderNode;
    currentFolder: ExplorerFolderNode | null;
    breadcrumbItems: ReturnType<typeof buildBreadcrumb>;
    listedChildren: ExplorerFolderNode['children'];
    hasNextPage: boolean;
    isBrowseLoading: boolean;
    isBrowseError: boolean;
    canGoUp: boolean;
    navigateToPath: (segments: string[]) => void;
    goBack: () => void;
    enterFolder: (folder: ExplorerFolderNode) => void;
    handleNextPage: () => void;
    handlePrevPage: () => void;
    toggleSelectedKey: (keyPath: string, checked: boolean) => void;
    toggleTreeFolderExpanded: (keyPath: string) => void;
    handleSave: () => Promise<void>;
}

export const useFilesFoldersExplorer = (
    dataStore: DataStoreType,
    onSubmit: (value: DataStoreType) => void,
): UseFilesFoldersExplorerResult => {
    const { mutateAsync: exploreMutateAsync } = useWizardExploreMutation();
    const saveEmbeddingMutation = useWizardSaveEmbeddingConfigMutation();
    const provider = dataStore.provider;
    const isSharePoint = isSharePointProvider(provider);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState('');

    const [viewMode, setViewMode] = useState<ExplorerViewMode>('browse');
    const [pathSegments, setPathSegments] = useState<string[]>([]);
    const [expandedFolderKeys, setExpandedFolderKeys] = useState<Set<string>>(() => new Set());
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() =>
        normalizeSelectionKeys(dataStore?.embeddingConfig?.embeddingFields ?? []),
    );

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
                    id: dataStore._id,
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
        [dataStore._id, exploreMutateAsync, provider],
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

        if (isSharePoint) {
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

    useEffect(() => {
        if (dataStore?.embeddingConfig) {
            setSelectedKeys(normalizeSelectionKeys(dataStore.embeddingConfig.embeddingFields ?? []));
        }
    }, [dataStore?.embeddingConfig]);

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

    const toggleSelectedKey = useCallback((keyPath: string, checked: boolean) => {
        setSelectedKeys((prev) => {
            const next = new Set(prev);

            if (checked) {
                for (const x of prev) {
                    if (x !== keyPath && isStrictPathAncestor(keyPath, x)) {
                        next.delete(x);
                    }
                }
                next.add(keyPath);
            } else {
                next.delete(keyPath);
            }

            return next;
        });
    }, []);

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

    const submitFilesFoldersConfig = useCallback(
        async (embeddingFieldKeys: string[]): Promise<boolean> => {
            if (!dataStore?._id) return false;

            setIsSubmitting(true);
            setFormError('');
            try {
                const result = await saveEmbeddingMutation.mutateAsync({
                    id: dataStore._id,
                    data: {
                        embeddingFields: embeddingFieldKeys,
                    },
                });

                showSuccessToast('Settings saved successfully.');
                onSubmit(result);

                return true;
            } catch (error: unknown) {
                console.error(error);

                const axiosError = error as { response?: { data?: { message?: string }; status?: number } };
                const message = axiosError.response?.data?.message || 'Something went wrong. Please try again.';

                setFormError(
                    axiosError.response?.status === 500 ? 'Internal server error, Please try again.' : message,
                );

                return false;
            } finally {
                setIsSubmitting(false);
            }
        },
        [dataStore, onSubmit, saveEmbeddingMutation],
    );

    const handleSave = useCallback(async () => {
        if (!dataStore?._id) return;

        const keys = [...new Set(Array.from(selectedKeys))].sort();

        if (keys.length === 0) {
            showErrorToast('Please select at least one folder or file.');

            return;
        }

        if (dataStore.embeddingConfig) {
            const saved = new Set(dataStore.embeddingConfig.embeddingFields ?? []);

            if (setsEqualString(selectedKeys, saved)) {
                return;
            }
        }

        await submitFilesFoldersConfig(keys);
    }, [dataStore, selectedKeys, submitFilesFoldersConfig]);

    const canGoUp = pathSegments.length > 0;

    return {
        isSubmitting,
        formError,
        viewMode,
        setViewMode,
        provider,
        isSharePoint,
        pathSegments,
        expandedFolderKeys,
        selectedKeys,
        prefixCache,
        loadingPrefixes,
        failedPrefixes,
        currentBrowsePage,
        root,
        currentFolder,
        breadcrumbItems,
        listedChildren,
        hasNextPage,
        isBrowseLoading,
        isBrowseError,
        canGoUp,
        navigateToPath,
        goBack,
        enterFolder,
        handleNextPage,
        handlePrevPage,
        toggleSelectedKey,
        toggleTreeFolderExpanded,
        handleSave,
    };
};
