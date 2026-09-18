import type { DataStoreType, ProviderType } from '@/types/admin';

export type ExplorerFileNode = {
    type: 'file';
    /** Full key path, e.g. "documents/notes.txt" */
    keyPath: string;
    label: string;
    /** Display string for "Date modified" (tree view) */
    dateModified?: string;
    sizeBytes?: number;
    /** Human-readable kind, e.g. "PNG image" */
    kind?: string;
};

export type ExplorerFolderNode = {
    type: 'folder';
    /** Full key path, e.g. "documents/archive" — empty string for synthetic root */
    keyPath: string;
    label: string;
    children: ExplorerNode[];
    dateModified?: string;
    /** Some providers (e.g. SharePoint) return total size for folders. */
    sizeBytes?: number;
    /** True when this folder exists in a listing but its children have not been loaded yet (lazy tree). */
    listingPending?: boolean;
};

export type ExplorerNode = ExplorerFolderNode | ExplorerFileNode;

export type ExplorerViewMode = 'browse' | 'tree';

export type BreadcrumbItem = {
    label: string;
    pathSegments: string[];
};

export type WizardCommonSlice = {
    dataStore?: DataStoreType;
    completedPages?: number[];
    /** Selected paths for files/folders step; persisted in `embeddingConfig.embeddingFields` only. */
    selectedEmbeddingKeys?: string[];
    /** @deprecated Use `selectedEmbeddingKeys` — merged on load if `selectedEmbeddingKeys` is unset. */
    selectedFolderKeys?: string[];
    /** @deprecated Use `selectedEmbeddingKeys` — merged on load if `selectedEmbeddingKeys` is unset. */
    selectedFileKeys?: string[];
} | null;

export type TreeBodyProps = {
    nodes: ExplorerNode[];
    depth: number;
    expandedFolderKeys: Set<string>;
    /** Folder and file paths stored together (same as `embeddingFields`). */
    selectedKeys: Set<string>;
    selectionDisabled: boolean;
    hideCheckboxes?: boolean;
    toggleTreeFolderExpanded: (keyPath: string) => void;
    toggleSelectedKey: (keyPath: string, checked: boolean) => void;
    /** API-style prefixes (e.g. `cats-folder/`) currently loading; used for expand spinner in tree mode. */
    loadingPrefixes?: ReadonlySet<string>;
    /** Matches explore cache keys for tree loading spinners (S3 trailing slash vs SharePoint full path). */
    provider?: ProviderType;
};

export type TreeFolderRowsProps = {
    folder: ExplorerFolderNode;
    depth: number;
    expandedFolderKeys: Set<string>;
    selectedKeys: Set<string>;
    selectionDisabled: boolean;
    hideCheckboxes?: boolean;
    toggleTreeFolderExpanded: (keyPath: string) => void;
    toggleSelectedKey: (keyPath: string, checked: boolean) => void;
    loadingPrefixes: ReadonlySet<string>;
    provider?: ProviderType;
};

export type TreeFileRowProps = {
    file: ExplorerFileNode;
    depth: number;
    selectedKeys: Set<string>;
    selectionDisabled: boolean;
    hideCheckboxes?: boolean;
    toggleSelectedKey: (keyPath: string, checked: boolean) => void;
};
