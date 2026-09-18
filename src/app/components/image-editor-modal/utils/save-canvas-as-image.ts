export const triggerBrowserDownloadFromBlob = (blob: Blob, filename: string): void => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
};

export const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> => {
    return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (!blob) {
                    reject(new Error('Failed to create blob from canvas'));

                    return;
                }
                resolve(blob);
            },
            type,
            quality,
        );
    });
};

export const saveCanvasAsImage = async (
    canvas: HTMLCanvasElement,
    filename: string,
    type: string = 'image/png',
    quality?: number,
): Promise<void> => {
    const blob = await canvasToBlob(canvas, type, quality);

    triggerBrowserDownloadFromBlob(blob, filename);
};
