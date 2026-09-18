import { useCallback, useState } from 'react';

import { appMediaApi } from '@/lib/api/app/media';
import { showErrorToast, showSuccessToast } from '@/utils';
import { makeSafeDownloadFilename } from '@/utils/download-filename';

const useDownloadMedia = () => {
    const [downloading, setDownloading] = useState(false);

    const downloadMedia = useCallback(async (url: string, filename: string, isVideoFile: boolean = false) => {
        const mediaLabel = isVideoFile ? 'video' : 'image';

        try {
            setDownloading(true);
            const blob = await appMediaApi.downloadBlob(url);
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');

            link.href = downloadUrl;

            link.download = makeSafeDownloadFilename(filename, {
                extension: isVideoFile ? 'mp4' : 'png',
                fallbackBaseName: isVideoFile ? 'video' : 'image',
            });
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(downloadUrl);

            showSuccessToast(`${mediaLabel === 'video' ? 'Video' : 'Image'} downloaded`);
        } catch (error) {
            console.error(`Error downloading ${mediaLabel}:`, error);
            showErrorToast(`Failed to download ${mediaLabel}. Please try again later.`);
        } finally {
            setDownloading(false);
        }
    }, []);

    return { downloadMedia, downloading };
};

export default useDownloadMedia;
