import type { GeneratedItem } from '@/types/gallery';

interface GalleryFileOverrides {
    _id?: string;
    title?: string;
    prompt?: string;
    creatorId?: string;
    creatorName?: string;
    extension?: string;
    isDeleted?: boolean;
    likes?: string[];
}

/**
 * A `/files` row as the API sends it. `url` must be non-empty or `GalleryImage`
 * takes its `isRunning || !item.url` branch and renders a bare spinner with no
 * alt text to assert on.
 */
export const makeGalleryFile = (overrides: GalleryFileOverrides = {}): GeneratedItem => {
    const id = overrides._id ?? 'file-1';
    const title = overrides.title ?? 'Generated media';

    return {
        _id: id,
        is_deleted: overrides.isDeleted ?? false,
        created_at: 1735689600000,
        updated_at: 1735689600000,
        title,
        meta: {
            aspect_ratio: 1,
            bitrate: 0,
            created: 0,
            dpi: 0,
            duration: 0,
            height: 512,
            modified: 0,
            size: 1024,
            width: 512,
        },
        ai: {
            model_id: 'model-1',
            model_name: 'imagen',
            model_provider: 'google',
            arguments: { prompt: overrides.prompt ?? `${title} prompt` },
        },
        url: `https://files.localhost/download/${id}`,
        creator_name: overrides.creatorName ?? 'Test User',
        creator_id: overrides.creatorId ?? 'user-1',
        extension: overrides.extension ?? 'png',
        likes: overrides.likes ?? [],
        likes_count: overrides.likes?.length ?? 0,
    };
};
