import { useCallback, useRef, useState } from 'react';

import { showErrorToast, showSuccessToast } from '@/utils';
import { makeSafeDownloadFilename } from '@/utils/download-filename';

import { useEditorContext } from '../context/editor-context';
import type { DuotoneColors, LutTexture } from '../types';
import { renderImageWithCropAndFilters2D } from '../utils/canvas2d-render-image';
import { getRotatedDimensions } from '../utils/crop-utils';
import { isWebGLSupported } from '../utils/rendering-capabilities';
import { mapCropBoxFromRotatedSpaceForRotation } from '../utils/rotation-crop-mapping';
import { canvasToBlob, saveCanvasAsImage, triggerBrowserDownloadFromBlob } from '../utils/save-canvas-as-image';
import { isQuarterTurnRotationDegrees } from '../utils/tex-transform-utils';
import { renderImageWithCropAndFilters } from '../utils/webgl-render-crop';

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

interface UseExportImageProps {
    imageUrl: string;
    imageName: string;
    selectedLut?: LutTexture;
    selectedDuotone?: DuotoneColors;
}

export const useExportImage = (props: UseExportImageProps) => {
    const { imageUrl, imageName, selectedLut, selectedDuotone } = props;
    const { filterEnabled, filterIntensity, adjustments, adjustmentsEnabled, cropState: crop } = useEditorContext();
    const [exporting, setExporting] = useState(false);
    const [copying, setCopying] = useState(false);
    const exportCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const cropped2dCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const webglSupportedRef = useRef<boolean | null>(null);

    const renderToCanvas = useCallback(async (): Promise<HTMLCanvasElement | null> => {
        if (!imageUrl) return null;

        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();

            img.crossOrigin = 'anonymous';

            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Failed to load image for export'));

            img.src = imageUrl;
        });

        // A stable canvas identity keeps webglCache from tearing down and recreating its
        // WebGL context on every export; each new canvas would otherwise hold a live context.
        if (!exportCanvasRef.current) exportCanvasRef.current = document.createElement('canvas');
        if (!cropped2dCanvasRef.current) cropped2dCanvasRef.current = document.createElement('canvas');

        const exportCanvas = exportCanvasRef.current;
        const cropped2dCanvas = cropped2dCanvasRef.current;

        if (webglSupportedRef.current === null) {
            webglSupportedRef.current = isWebGLSupported();
        }

        const isQuarterTurn = isQuarterTurnRotationDegrees(crop.rotation);
        const viewDims = getRotatedDimensions(
            { width: image.naturalWidth, height: image.naturalHeight },
            isQuarterTurn,
        );

        const cropInView = {
            x: crop.x || 0,
            y: crop.y || 0,
            width: crop.width || viewDims.width,
            height: crop.height || viewDims.height,
        };

        const cropInImageSpace = mapCropBoxFromRotatedSpaceForRotation(
            cropInView,
            image.naturalWidth,
            image.naturalHeight,
            crop.rotation,
        );

        const renderParams = {
            image,
            imageWidth: image.naturalWidth,
            imageHeight: image.naturalHeight,
            cropState: { ...crop, ...cropInImageSpace },
            isCropMode: false,
            filterEnabled,
            filterIntensity,
            selectedLut,
            selectedDuotone,
            adjustments,
            adjustmentsEnabled,
            fullCanvasOutput: exportCanvas,
            croppedCanvasOutput: cropped2dCanvas,
            isExport: true,
            originalCropState: crop,
        };

        return webglSupportedRef.current
            ? renderImageWithCropAndFilters(renderParams)
            : renderImageWithCropAndFilters2D(renderParams);
    }, [adjustments, adjustmentsEnabled, crop, filterEnabled, filterIntensity, imageUrl, selectedDuotone, selectedLut]);

    const handleExport = useCallback(async () => {
        if (!imageUrl) return;

        setExporting(true);
        try {
            const finalCanvas = await renderToCanvas();

            if (!finalCanvas) return;

            await saveCanvasAsImage(
                finalCanvas,
                makeSafeDownloadFilename(imageName, {
                    extension: 'png',
                    fallbackBaseName: 'image',
                }),
                'image/png',
            );
        } catch (error) {
            console.error('Error exporting image:', error);
            showErrorToast('Failed to export image');
        } finally {
            setExporting(false);
        }
    }, [imageUrl, imageName, renderToCanvas]);

    const handleCopy = useCallback(async () => {
        if (!imageUrl) return;

        setCopying(true);
        try {
            const resolveBlob = async (): Promise<Blob> => {
                const finalCanvas = await renderToCanvas();

                if (!finalCanvas) {
                    throw new Error('Failed to render image for clipboard');
                }

                return canvasToBlob(finalCanvas, 'image/png');
            };

            await navigator.clipboard.write([new ClipboardItem({ 'image/png': resolveBlob() })]);
            showSuccessToast('Image copied to clipboard');
        } catch (error) {
            console.error('Error copying image:', error);
            showErrorToast('Failed to copy image');
        } finally {
            setCopying(false);
        }
    }, [imageUrl, renderToCanvas]);

    const handleExportAs = useCallback(
        async (format: ExportImageFormat) => {
            if (!imageUrl) return;

            setExporting(true);
            try {
                const finalCanvas = await renderToCanvas();

                if (!finalCanvas) return;

                const mime = MIME_BY_FORMAT[format];
                const ext = EXT_BY_FORMAT[format];
                const quality = format === 'png' ? undefined : 0.92;
                const blob = await canvasToBlob(finalCanvas, mime, quality);

                const filename = makeSafeDownloadFilename(imageName, {
                    extension: ext,
                    fallbackBaseName: 'image',
                });

                triggerBrowserDownloadFromBlob(blob, filename);
                showSuccessToast(`Saved as ${filename}`);
            } catch (error) {
                console.error('Error exporting image:', error);
                showErrorToast('Failed to export image');
            } finally {
                setExporting(false);
            }
        },
        [imageUrl, imageName, renderToCanvas],
    );

    return {
        exporting,
        copying,
        handleExport,
        handleCopy,
        handleExportAs,
    };
};
