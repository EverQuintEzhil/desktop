export type UploadOriginType = 'chat' | 'gallery';

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export const getFileType = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase();

    return ['jpg', 'jpeg', 'png', 'gif'].includes(ext || '') ? 'image' : 'file';
};

export const generateTempId = (): string => `temp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

export const getUploadErrorMessage = (error: unknown): string =>
    error instanceof Error && error.message ? error.message : 'Upload failed. Click to retry.';
