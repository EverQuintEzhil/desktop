export type GalleryAiArgumentValue = string | number | boolean | null;

export type GalleryProviderOptions = Record<string, GalleryAiArgumentValue>;

export type GalleryAiArguments = Record<string, GalleryAiArgumentValue | GalleryProviderOptions | undefined> & {
    prompt: string;
    options?: GalleryProviderOptions;
};

export interface GeneratedItem {
    _id: string;
    uniqueId?: string;
    is_deleted: boolean;
    created_at: number;
    updated_at: number;
    title: string;
    meta: {
        aspect_ratio: number;
        bitrate: number;
        created: number;
        dpi: number;
        duration: number;
        height: number;
        modified: number;
        size: number;
        width: number;
    };
    ai: {
        model_id: string;
        model_name: string;
        model_provider: string;
        arguments?: GalleryAiArguments;
        usage?: {
            input_tokens: number;
            output_tokens: number;
            total_tokens: number;
        };
    };
    url: string;
    creator_name: string;
    creator_id: string;
    extension: string;
    related_file_ids?: string[];

    likes?: string[];
    likes_count?: number;
    isLikedByThisUser?: boolean;
    isMyItem?: boolean;
    is_public?: boolean;
    isRunning?: boolean;
}

export interface GalleryItemActionHandlers {
    onDeleteItemClicked?: (item: GeneratedItem) => void;
    onEditItemClicked?: (item: GeneratedItem) => void;
    onViewItemClicked?: (item: GeneratedItem) => void;
    onLikeItemClicked?: (item: GeneratedItem) => void;
}

export interface GalleryState {
    history: GeneratedItem[];
    loading: boolean;
    error: string | null;
    page: number;
    pages: number;
    showMoreLoading: boolean;
    isLoadedWithPlaceholders: boolean;
}

export interface FileApiResponse {
    _id: string;
    name: string;
    extension: string;
    type: string;
    title: string;
    description: string;
    agent_id: string;
    agent_name?: string;
    agent_slug?: string;
    conversation_id: string | null;
    origin?: {
        type?: string;
        agent_id?: string | null;
        conversation_id?: string | null;
        message_id?: string | null;
        skill_id?: string | null;
        app_id?: string | null;
        project_id?: string | null;
        user_id?: string | null;
        datastore_id?: string | null;
    };
    creator_id: string;
    creator_name: string;
    updated_by_id: string;
    updated_by_name: string;
    url: string;
    thumbnail_url: string;
    file_content_text: string;
    file_hash: string;
    is_public: boolean;
    is_deleted: boolean;
    is_incognito: boolean;
    created_at: number;
    updated_at: number;
    // `null` for plain uploads — only generated outputs carry an `ai` object.
    ai: {
        generated: boolean;
        model_id: string;
        model_name: string;
        model_provider: string;
        arguments: GalleryAiArguments;
        usage: {
            input_tokens: number;
            output_tokens: number;
            total_tokens: number;
        };
    } | null;
    meta: {
        width: number;
        height: number;
        size: number;
        dpi: number;
        aspect_ratio: number;
    };
    related_file_ids: string[];
    likes?: string[];
    likes_count?: number;
    embedding_status?: string;
    embedding_error?: string | null;
}
