import type { LibraryItem } from '@/components/agent-chat/hooks/use-media-library';
import type { ProjectFileType } from '@/types/project';

import { isImageFile, isVideoFile, isPdfFile, isPreviewable } from '../../library/file-preview';

export type PreviewType = 'image' | 'video' | 'pdf' | 'file';

export interface ConversationFile {
    id: string;
    name: string;
    extension: string;
    size?: number;
    createdAt?: number | string;
    url: string;
    thumbnailUrl?: string;
    isImage: boolean;
    previewable: boolean;
    previewType: PreviewType;
    embeddingStatus?: string;
    embeddingError?: string | null;
    isGenerated: boolean;
    modelName?: string;
    creatorName?: string;
    item: LibraryItem;
}

const getPreviewType = (item: LibraryItem): PreviewType => {
    if (isImageFile(item)) return 'image';
    if (isVideoFile(item)) return 'video';
    if (isPdfFile(item)) return 'pdf';

    return 'file';
};

export const conversationFileFromLibraryItem = (item: LibraryItem): ConversationFile => ({
    id: item._id,
    name: item.name || item.title,
    extension: item.extension,
    size: item.size,
    createdAt: item.createdAt,
    url: item.url,
    thumbnailUrl: item.thumbnailUrl,
    isImage: isImageFile(item),
    previewable: isPreviewable(item),
    previewType: getPreviewType(item),
    embeddingStatus: item.embeddingStatus,
    embeddingError: item.embeddingError,
    isGenerated: item.isGenerated,
    modelName: item.modelName,
    creatorName: item.creatorName,
    item,
});

export const conversationFileFromProjectFile = (file: ProjectFileType): ConversationFile => {
    const item = file as unknown as LibraryItem;

    return {
        id: file._id,
        name: file.name,
        extension: file.extension,
        size: file.size,
        createdAt: file.createdAt,
        url: file.url,
        thumbnailUrl: file.thumbnailUrl,
        isImage: isImageFile(item),
        previewable: isPreviewable(item),
        previewType: getPreviewType(item),
        embeddingStatus: file.embedding_status,
        embeddingError: file.embedding_error,
        isGenerated: false,
        creatorName: file.creatorName,
        item,
    };
};
