import type { ProviderType } from '@/types/admin';

import { isFolder } from './tree-utils';
import type { ExplorerFolderNode, ExplorerNode } from './types';

export const EXPLORE_PAGE_SIZE = 20;

export type ExploreListItem = {
    key: string;
    name: string;
    type: 'prefix' | 'object';
    metadata: {
        size?: number;
        lastModified?: string;
        etag?: string;
        storageClass?: string;
    };
};

export type PrefixCacheEntry = {
    fetched: boolean;
    children: ExplorerNode[];
    nextContinuationToken?: string | null;
};

/**
 * SharePoint explore row: paths are full from root for folders; files may have `path: null` — use `webUrl` as id.
 * `type === 'file'` is a file; `folder`, `list`, etc. are folders.
 */
export type SharePointExploreListItem = {
    name: string;
    type: string;
    path: string | null;
    webUrl?: string | null;
    size?: number;
    mimeType?: string | null;
    description?: string;
    lastModifiedDateTime?: string;
    createdDateTime?: string;
    createdBy?: string;
    lastModifiedBy?: string;
};

export function isSharePointProvider(provider: ProviderType): boolean {
    return provider === 'sharepoint';
}

export function buildExplorePostBody(
    provider: ProviderType,
    pathOrPrefix: string,
    continuationToken?: string,
): Record<string, unknown> {
    if (isSharePointProvider(provider)) {
        const body: Record<string, unknown> = {
            path: pathOrPrefix,
            delimiter: '/',
            size: EXPLORE_PAGE_SIZE,
        };

        if (continuationToken) {
            body.continuationToken = continuationToken;
        }

        return body;
    }

    const body: Record<string, unknown> = {
        prefix: pathOrPrefix,
        delimiter: '/',
        size: EXPLORE_PAGE_SIZE,
    };

    if (continuationToken) {
        body.continuationToken = continuationToken;
    }

    return body;
}

/** Browse / tree loading key: S3 non-root prefixes end with `/`; SharePoint uses joined segments as full path. */
export function getBrowseCacheKeyFromSegments(provider: ProviderType, pathSegments: string[]): string {
    if (pathSegments.length === 0) return '';

    const joined = pathSegments.join('/');

    if (isSharePointProvider(provider)) return joined;

    return `${joined}/`;
}

export function getFetchKeyForFolderKeyPath(provider: ProviderType, folderKeyPath: string): string {
    if (isSharePointProvider(provider)) {
        return folderKeyPath;
    }

    return keyPathToApiPrefix(folderKeyPath);
}

function sharePointItemKeyPath(item: SharePointExploreListItem, isFile: boolean): string {
    if (isFile) {
        if (item.path != null && item.path !== '') return item.path;
        if (item.webUrl != null && item.webUrl !== '') return item.webUrl;

        return item.name;
    }

    if (item.path != null && item.path !== '') return item.path;
    if (item.webUrl != null && item.webUrl !== '') return item.webUrl;

    return item.name;
}

export function mapSharePointExploreItemToNode(item: SharePointExploreListItem): ExplorerNode {
    const t = item.type?.toLowerCase() ?? '';
    const isFile = t === 'file';

    if (isFile) {
        return {
            type: 'file',
            keyPath: sharePointItemKeyPath(item, true),
            label: item.name,
            dateModified: formatLastModified(item.lastModifiedDateTime),
            sizeBytes: item.size,
        };
    }

    return {
        type: 'folder',
        keyPath: sharePointItemKeyPath(item, false),
        label: item.name,
        children: [],
        dateModified: formatLastModified(item.lastModifiedDateTime),
        sizeBytes: item.size,
    };
}

export function keyPathToApiPrefix(keyPath: string): string {
    if (keyPath === '') return '';

    return keyPath.endsWith('/') ? keyPath : `${keyPath}/`;
}

function stripTrailingSlash(key: string): string {
    return key.endsWith('/') ? key.slice(0, -1) : key;
}

function formatLastModified(iso: string | undefined): string | undefined {
    if (!iso) return undefined;
    try {
        return new Date(iso).toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
        });
    } catch {
        return undefined;
    }
}

export function mapExploreItemToNode(item: ExploreListItem): ExplorerNode {
    if (item.type === 'prefix') {
        return {
            type: 'folder',
            keyPath: stripTrailingSlash(item.key),
            label: item.name,
            children: [],
        };
    }

    const meta = item.metadata ?? {};

    return {
        type: 'file',
        keyPath: item.key,
        label: item.name,
        dateModified: formatLastModified(meta.lastModified),
        sizeBytes: meta.size,
    };
}

export function mapExploreValuesToNodes(provider: ProviderType, values: unknown[]): ExplorerNode[] {
    if (isSharePointProvider(provider)) {
        return values.map((v) => mapSharePointExploreItemToNode(v as SharePointExploreListItem));
    }

    return values.map((v) => mapExploreItemToNode(v as ExploreListItem));
}

/** Browse current folder for SharePoint: listings are keyed by full path (no per-segment tree walk). */
export function getSharePointBrowseFolder(
    pathSegments: string[],
    prefixCache: Record<string, PrefixCacheEntry>,
    provider: ProviderType,
): ExplorerFolderNode | null {
    const key = pathSegments.length === 0 ? '' : pathSegments.join('/');
    const entry = prefixCache[key];

    if (!entry?.fetched) return null;

    const label = pathSegments.length === 0 ? 'Root' : pathSegments[pathSegments.length - 1];

    return {
        type: 'folder',
        keyPath: key,
        label,
        children: entry.children.map((ch) => attachFetchedChildren(ch, prefixCache, provider)),
    };
}

export function attachFetchedChildren(
    node: ExplorerNode,
    cache: Record<string, PrefixCacheEntry>,
    provider: ProviderType = 's3',
): ExplorerNode {
    if (!isFolder(node)) return node;

    const cacheKey = isSharePointProvider(provider) ? node.keyPath : keyPathToApiPrefix(node.keyPath);
    const entry = cache[cacheKey];

    if (entry?.fetched) {
        return {
            ...node,
            listingPending: false,
            children: entry.children.map((ch) => attachFetchedChildren(ch, cache, provider)),
        };
    }

    return { ...node, children: [], listingPending: true };
}
