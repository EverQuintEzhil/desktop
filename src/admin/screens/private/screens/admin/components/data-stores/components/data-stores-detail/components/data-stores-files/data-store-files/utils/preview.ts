import { IMAGE_EXTENSIONS, VIDEO_EXTENSIONS, isPreviewableFile, normalizeExt } from '@/components/file-list';
import type { DataStoreFileRecord } from '@/lib/api/admin/data-stores';

export const isPreviewableRecord = (record: DataStoreFileRecord): boolean => isPreviewableFile(record);

export const getPreviewType = (record: DataStoreFileRecord): 'image' | 'video' | 'pdf' | 'file' => {
    const ext = normalizeExt(record.extension ?? record.name?.split('.').pop());

    if (VIDEO_EXTENSIONS.includes(ext) || record.type?.toLowerCase().includes('video')) return 'video';
    if (ext === 'pdf' || record.type?.toLowerCase().includes('pdf')) return 'pdf';
    if (IMAGE_EXTENSIONS.includes(ext) || record.type?.toLowerCase().includes('image')) return 'image';

    return 'file';
};
