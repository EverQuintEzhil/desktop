import { cropSvgToContent } from './crop-svg-to-content';

export const downloadPng = async (svg: string) => {
    try {
        const { svg: exportSvg, width, height } = cropSvgToContent(svg);
        const image = new Image();
        const imageUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(exportSvg)}`;

        await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve();
            image.onerror = (error) => {
                console.error('[Mermaid]', error);
                reject(new Error('Unable to prepare Mermaid diagram image.'));
            };
            image.src = imageUrl;
        });

        const scale = Math.max(window.devicePixelRatio || 1, 2);
        const canvas = document.createElement('canvas');

        canvas.width = width * scale;
        canvas.height = height * scale;

        const context = canvas.getContext('2d');

        if (!context) {
            throw new Error('Unable to create PNG canvas.');
        }

        context.scale(scale, scale);
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);

        const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((pngBlob) => {
                if (pngBlob) {
                    resolve(pngBlob);
                } else {
                    reject(new Error('Unable to export Mermaid diagram as PNG.'));
                }
            }, 'image/png');
        });
        const pngUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = pngUrl;
        link.download = 'mermaid-diagram.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(pngUrl);
    } catch (error) {
        console.error('[Mermaid]', error);
        throw new Error('Unable to export Mermaid diagram as PNG.');
    }
};
