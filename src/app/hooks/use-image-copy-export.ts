import { useCallback, useState } from 'react';

import { appMediaApi } from '@/lib/api/app/media';
import { showErrorToast, showSuccessToast } from '@/utils';
import { makeSafeDownloadFilename } from '@/utils/download-filename';

export type ExportImageFormat = 'jpeg' | 'png' | 'webp';

const MIME_BY_FORMAT: Record<ExportImageFormat, string> = {
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
};

const EXT_BY_FORMAT: Record<ExportImageFormat, string> = {
    jpeg: 'jpg',
    png: 'png',
    webp: 'webp',
};

const INVALID_IMAGE_COPY_ERROR = 'Could not copy: invalid image';

function triggerDownload(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}

const convertImageBlobToPng = async (blob: Blob): Promise<Blob> => {
    if (!blob.type.startsWith('image/')) {
        throw new Error(INVALID_IMAGE_COPY_ERROR);
    }

    const objectUrl = window.URL.createObjectURL(blob);

    try {
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();

            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = objectUrl;
        });
        const canvas = document.createElement('canvas');

        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            throw new Error('Failed to prepare image for clipboard');
        }

        ctx.drawImage(image, 0, 0);

        const pngBlob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob(resolve, 'image/png');
        });

        if (!pngBlob) {
            throw new Error('Failed to prepare image for clipboard');
        }

        return pngBlob;
    } finally {
        window.URL.revokeObjectURL(objectUrl);
    }
};

const useImageCopyExport = () => {
    const [copying, setCopying] = useState(false);
    const [exporting, setExporting] = useState(false);

    const copyImage = useCallback(async (imageUrl: string) => {
        if (!imageUrl) return;

        setCopying(true);
        try {
            const resolveBlob = async (): Promise<Blob> => {
                const blob = await appMediaApi.downloadBlob(imageUrl);

                return convertImageBlobToPng(blob);
            };

            await navigator.clipboard.write([new ClipboardItem({ 'image/png': resolveBlob() })]);
            showSuccessToast('Image copied to clipboard');
        } catch (err) {
            console.error('Copy image failed', err);
            showErrorToast(
                err instanceof Error && err.message === INVALID_IMAGE_COPY_ERROR
                    ? INVALID_IMAGE_COPY_ERROR
                    : 'Failed to copy image',
            );
        } finally {
            setCopying(false);
        }
    }, []);

    const exportImageAs = useCallback(async (imageUrl: string, imageName: string, format: ExportImageFormat) => {
        if (!imageUrl) return;

        setExporting(true);
        try {
            const blob = await appMediaApi.downloadBlob(imageUrl);
            const objectUrl = window.URL.createObjectURL(blob);

            const img = await new Promise<HTMLImageElement>((resolve, reject) => {
                const image = new Image();

                image.onload = () => resolve(image);
                image.onerror = () => reject(new Error('Failed to load image'));
                image.src = objectUrl;
            });

            window.URL.revokeObjectURL(objectUrl);

            const canvas = document.createElement('canvas');

            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                showErrorToast('Export failed');

                return;
            }
            ctx.drawImage(img, 0, 0);

            const mime = MIME_BY_FORMAT[format];
            const ext = EXT_BY_FORMAT[format];
            const quality = format === 'png' ? undefined : 0.92;

            const outBlob = await new Promise<Blob | null>((res) => {
                canvas.toBlob(res, mime, quality);
            });

            if (!outBlob) {
                showErrorToast(`Export as ${format.toUpperCase()} is not supported in this browser`);

                return;
            }

            const filename = makeSafeDownloadFilename(imageName, {
                extension: ext,
                fallbackBaseName: 'image',
            });

            triggerDownload(outBlob, filename);
            showSuccessToast(`Saved as ${filename}`);
        } catch (err) {
            console.error('Export image failed', err);
            showErrorToast('Failed to export image');
        } finally {
            setExporting(false);
        }
    }, []);

    return {
        copyImage,
        exportImageAs,
        copying,
        exporting,
    };
};

export default useImageCopyExport;
