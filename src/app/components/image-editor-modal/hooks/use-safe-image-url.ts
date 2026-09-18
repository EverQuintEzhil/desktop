import axios from 'axios';
import { useEffect, useState } from 'react';

export const useSafeImageUrl = (imageUrl: string) => {
    const [safeImageUrl, setSafeImageUrl] = useState<string>('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!imageUrl) {
            setSafeImageUrl('');
            setLoading(false);

            return;
        }

        const controller = new AbortController();
        let currentBlobUrl: string | null = null;

        const fetchImage = async () => {
            setLoading(true);
            try {
                const response = await axios.get(imageUrl, {
                    responseType: 'blob',
                    signal: controller.signal,
                    withCredentials: true,
                });

                const blobUrl = URL.createObjectURL(response.data);

                currentBlobUrl = blobUrl;
                setSafeImageUrl(blobUrl);
            } catch (error) {
                if (!axios.isCancel(error)) {
                    console.error('Error loading image:', error);
                    setSafeImageUrl(imageUrl);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };

        fetchImage();

        return () => {
            controller.abort();
            if (currentBlobUrl) {
                URL.revokeObjectURL(currentBlobUrl);
            }
        };
    }, [imageUrl]);

    return { safeImageUrl, loading };
};
