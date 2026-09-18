import type { GeneratedItem } from '@/types/gallery';

export const exportMaskBlob = async (
    canvas: HTMLCanvasElement | null,
    penCanvas: HTMLCanvasElement | null,
    maskHasStrokes: boolean,
    currentItem: GeneratedItem | undefined,
): Promise<Blob | null> => {
    if (!canvas || !maskHasStrokes) return null;

    const targetWidth = currentItem?.meta?.width;
    const targetHeight = currentItem?.meta?.height;

    const outWidth = typeof targetWidth === 'number' && targetWidth > 0 ? targetWidth : canvas.width;
    const outHeight = typeof targetHeight === 'number' && targetHeight > 0 ? targetHeight : canvas.height;

    const exportCanvas = document.createElement('canvas');

    exportCanvas.width = outWidth;
    exportCanvas.height = outHeight;
    const ctx = exportCanvas.getContext('2d');

    if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
        ctx.drawImage(canvas, 0, 0, exportCanvas.width, exportCanvas.height);

        if (penCanvas) {
            ctx.drawImage(penCanvas, 0, 0, exportCanvas.width, exportCanvas.height);
        }
    }

    return await new Promise<Blob | null>((resolve) => {
        exportCanvas.toBlob((blob: Blob | null) => resolve(blob), 'image/png');
    });
};

export const exportMaskDataUrl = async (
    canvas: HTMLCanvasElement | null,
    penCanvas: HTMLCanvasElement | null,
    maskHasStrokes: boolean,
    currentItem: GeneratedItem | undefined,
): Promise<string | undefined> => {
    const blob = await exportMaskBlob(canvas, penCanvas, maskHasStrokes, currentItem);

    if (!blob) return undefined;

    return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
};

export const exportPenCompositeBlob = async (
    penCanvas: HTMLCanvasElement | null,
    maskTarget: HTMLDivElement | null,
): Promise<Blob | null> => {
    if (!penCanvas) return null;

    const imgEl = maskTarget?.querySelector<HTMLImageElement>('img');

    if (!imgEl?.src) return null;

    const naturalWidth = imgEl.naturalWidth || penCanvas.width;
    const naturalHeight = imgEl.naturalHeight || penCanvas.height;

    // Fetch the image as a blob to avoid CORS-tainted canvas
    let imgBitmap: ImageBitmap;

    try {
        const resp = await fetch(imgEl.src, { credentials: 'include' });
        const blob = await resp.blob();

        imgBitmap = await createImageBitmap(blob);
    } catch {
        return null;
    }

    const exportCanvas = document.createElement('canvas');

    exportCanvas.width = naturalWidth;
    exportCanvas.height = naturalHeight;
    const ctx = exportCanvas.getContext('2d');

    if (!ctx) return null;

    ctx.drawImage(imgBitmap, 0, 0, naturalWidth, naturalHeight);
    ctx.drawImage(penCanvas, 0, 0, naturalWidth, naturalHeight);

    return new Promise<Blob | null>((resolve) => {
        exportCanvas.toBlob((blob) => resolve(blob), 'image/png');
    });
};
