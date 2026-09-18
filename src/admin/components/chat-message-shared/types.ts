export interface AdminSource {
    site_name: string;
    thumbnail: string;
    favicon: string;
    description: string;
    title: string;
    type: string;
    url: string;
}

export interface AdminMessageFile {
    _id: string;
    name: string;
    extension?: string;
    type?: string;
    ai?: unknown;
}

export interface AdminDataStoreFile {
    name: string;
    ai?: unknown;
    mediaType?: string;
    storeId: string;
    type?: string;
    fileId: string;
}
