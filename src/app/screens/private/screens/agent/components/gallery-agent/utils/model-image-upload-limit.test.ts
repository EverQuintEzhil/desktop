import { describe, expect, it } from 'vitest';

import type { FileType } from '@/types/chat';

import {
    countUploadedImages,
    DEFAULT_MAX_IMAGE_UPLOADS,
    getImageUploadLimitMessage,
    getModelMaxImageUploads,
    isIncomingImageFile,
    isUploadedImageFile,
    isWithinImageUploadLimit,
    limitUploadedImages,
} from './model-image-upload-limit';

const file = (name: string, type: FileType['type'] = 'image'): FileType => ({
    _id: name,
    name,
    type,
    size: 1,
    url: '',
});

describe('model-image-upload-limit', () => {
    it('uses the model option or the default max image uploads', () => {
        expect(getModelMaxImageUploads()).toBe(DEFAULT_MAX_IMAGE_UPLOADS);
        expect(
            getModelMaxImageUploads({
                name: 'm',
                modelId: 'm1',
                options: { maxImageUploads: 4 },
            }),
        ).toBe(4);
    });

    it('formats singular and plural limit messages', () => {
        expect(getImageUploadLimitMessage(1)).toBe('This model supports up to 1 uploaded image.');
        expect(getImageUploadLimitMessage(3)).toBe('This model supports up to 3 uploaded images.');
    });

    it('detects incoming image files by mime type or extension', () => {
        expect(isIncomingImageFile(new File(['x'], 'a.png', { type: 'image/png' }))).toBe(true);
        expect(isIncomingImageFile(new File(['x'], 'a.PNG', { type: '' }))).toBe(true);
        expect(isIncomingImageFile(new File(['x'], 'a.txt', { type: 'text/plain' }))).toBe(false);
    });

    it('detects uploaded image files by type or extension', () => {
        expect(isUploadedImageFile(file('a.png', 'image'))).toBe(true);
        expect(isUploadedImageFile(file('a.jpg', 'file'))).toBe(true);
        expect(isUploadedImageFile(file('a.pdf', 'file'))).toBe(false);
    });

    it('counts, limits, and validates uploaded image totals', () => {
        const files = [file('a.png'), file('notes.txt', 'file'), file('b.jpg'), file('c.webp')];

        expect(countUploadedImages(files)).toBe(3);
        expect(isWithinImageUploadLimit(files, 3)).toBe(true);
        expect(isWithinImageUploadLimit(files, 2)).toBe(false);
        expect(limitUploadedImages(files, 2).map((item) => item.name)).toEqual(['a.png', 'notes.txt', 'b.jpg']);
    });
});
