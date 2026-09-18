import type { ModelValueType } from '@/types/admin';
import type { FileType } from '@/types/chat';

export const DEFAULT_MAX_IMAGE_UPLOADS = 2;

const IMAGE_EXTENSION_PATTERN = /\.(avif|gif|heic|heif|jpeg|jpg|png|webp)$/i;

export const getModelMaxImageUploads = (model?: ModelValueType | null): number =>
    model?.options?.maxImageUploads ?? DEFAULT_MAX_IMAGE_UPLOADS;

export const getImageUploadLimitMessage = (limit: number): string => {
    if (limit === 1) return 'This model supports up to 1 uploaded image.';

    return `This model supports up to ${limit} uploaded images.`;
};

export const isIncomingImageFile = (file: File): boolean => {
    if (file.type.startsWith('image/')) return true;

    return IMAGE_EXTENSION_PATTERN.test(file.name);
};

export const isUploadedImageFile = (file: Pick<FileType, 'name' | 'type'>): boolean => {
    if (file.type === 'image') return true;

    return IMAGE_EXTENSION_PATTERN.test(file.name);
};

export const countUploadedImages = (files: FileType[]): number => files.filter(isUploadedImageFile).length;

export const limitUploadedImages = (files: FileType[], limit: number): FileType[] => {
    let imageCount = 0;

    return files.filter((file) => {
        if (!isUploadedImageFile(file)) return true;

        imageCount += 1;

        return imageCount <= limit;
    });
};

export const isWithinImageUploadLimit = (files: FileType[], limit: number): boolean =>
    countUploadedImages(files) <= limit;
