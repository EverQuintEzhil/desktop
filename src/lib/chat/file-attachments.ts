import type { CompleteAttachment, ThreadUserMessagePart } from '@assistant-ui/react';

import type { FileType } from '@/types/chat';

function getFileId(file: FileType): string {
    return file._id || file.tempId || file.url;
}

function getFileMimeType(file: FileType): string {
    if (file.type === 'image') return 'image/jpeg';

    return 'application/octet-stream';
}

function fileToContentPart(file: FileType): ThreadUserMessagePart {
    if (file.type === 'image') {
        return {
            type: 'image',
            image: file.url,
            filename: file.name,
        };
    }

    return {
        type: 'file',
        data: file.url,
        mimeType: getFileMimeType(file),
        filename: file.name,
    };
}

export function getUploadedFileIds(files: FileType[]): string[] {
    return files.flatMap((file) => (file._id && !file.uploadError ? [file._id] : []));
}

export function filesToAttachments(files: FileType[]): CompleteAttachment[] {
    return (
        files
            // assistant-ui 0.15 throws inside `thread.append` on a nullish image/data payload,
            // so a file with no url is dropped rather than allowed to kill the whole send.
            .filter((file) => !file.uploadError && Boolean(file.url))
            .map((file) => ({
                id: getFileId(file),
                type: file.type === 'image' ? 'image' : 'file',
                name: file.name,
                contentType: getFileMimeType(file),
                status: { type: 'complete' },
                content: [fileToContentPart(file)],
            }))
    );
}

export function getMessageFileIds(metadata: unknown): string[] {
    if (!metadata || typeof metadata !== 'object') return [];

    const record = metadata as Record<string, unknown>;
    const custom = record.custom;
    let rawFileIds: unknown[] = [];

    if (Array.isArray(record.fileIds)) {
        rawFileIds = record.fileIds;
    } else if (custom && typeof custom === 'object' && Array.isArray((custom as Record<string, unknown>).fileIds)) {
        rawFileIds = (custom as Record<string, unknown>).fileIds as unknown[];
    }

    return rawFileIds.filter((id): id is string => typeof id === 'string' && id.length > 0);
}
