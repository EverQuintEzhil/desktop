import type { AdminDataStoreFile, AdminMessageFile } from '../types';

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'];

const isImageFileName = (name: string, extension?: string): boolean => {
    const fullName = `${name}${extension || ''}`.toLowerCase();

    return IMAGE_EXTENSIONS.some((ext) => fullName.endsWith(ext));
};

export const isAdminMessageImageFile = (file: AdminMessageFile): boolean => {
    if (file.type?.toLowerCase() === 'image') return true;

    return isImageFileName(file.name, file.extension);
};

export const isAdminDataStoreImageFile = (file: AdminDataStoreFile): boolean => {
    if (file.mediaType?.startsWith('image/')) return true;

    return isImageFileName(file.name);
};
