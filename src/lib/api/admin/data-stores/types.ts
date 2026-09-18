export type DataStoreFileMeta = {
    width?: number;
    height?: number;
    dpi?: number;
    aspect_ratio?: number;
    created?: string;
    modified?: string;
    size?: number;
};

export type DataStoreFileRecord = {
    _id: string;
    name: string;
    extension?: string;
    type?: string;
    title?: string;
    description?: string;
    url: string;
    thumbnail_url?: string;
    meta?: DataStoreFileMeta;
    created_at: string;
    updated_at?: string;
    is_deleted?: boolean;
    is_public?: boolean;
    is_incognito?: boolean;
    custom_fields?: Record<string, unknown>;
    embedding_status?: string;
    embedding_error?: string | null;
};

export interface WizardFieldsResult {
    totalCount: number;
    schema: { type: string; properties: Record<string, unknown> };
    sample: Record<string, unknown>[];
}

export interface WizardTemplate {
    templateKey: string;
    refName: string;
    name: string;
    description: string;
    code: string;
    parameters: Record<string, unknown>;
}

export interface WizardExploreResult {
    values?: Record<string, unknown>[];
    page_info?: {
        page?: number;
        size?: number;
        total_pages?: number;
        total_count?: number;
        next_continuation_token?: string | null;
    };
    request?: Record<string, unknown>;
}

export interface WizardConnectionSecretVerifyResult {
    token: string;
}

/** Server-side grouping for GET /datastores: file/blob storage, 'api' provider, 'weblinks', or 'db' (everything else). */
export type DataStoreProviderFilter = 'db' | 'blob-storage' | 'api' | 'weblinks';

/** Providers grouped under the file/blob-storage category (files + object storage). */
export const FILE_STORAGE_PROVIDERS = ['files', 'azure-blob-storage', 's3', 'sharepoint'];

/** Maps a data store's provider to its GET /datastores `provider` filter group. */
export const dataStoreProviderFilter = (provider?: string): DataStoreProviderFilter => {
    if (provider === 'api') return 'api';
    if (provider === 'weblinks') return 'weblinks';
    if (provider && FILE_STORAGE_PROVIDERS.includes(provider)) return 'blob-storage';

    return 'db';
};

/** A single web link entry within a weblinks datastore's `specification.links`. Non-secret only — credentials go through wizardSaveConnection. */
export interface WeblinkSpec {
    url: string;
    type: 'crawl' | 'scrape';
    siteMapLink?: string;
    auth?: 'none' | 'basic' | 'wordpress';
    respectRobots?: boolean;
    maxPages?: number;
    maxDepth?: number;
}
