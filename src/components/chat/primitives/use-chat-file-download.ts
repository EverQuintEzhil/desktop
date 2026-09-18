import { useCallback, useState } from 'react';

import { useOptionalChatHost } from '@/components/chat-host';
import { showErrorToast } from '@/utils';

interface UseChatFileDownloadResult {
    download: (url: string, filename: string) => Promise<void>;
    isDownloading: boolean;
    fetchBlob: (url: string, signal: AbortSignal) => Promise<Blob>;
}

const DOWNLOAD_ERROR = 'Failed to download file. Please try again later.';

interface UseChatFileDownloadOptions {
    /**
     * Only the composer may run without a ChatHostProvider (create-agent mounts it outside any
     * chat surface, where attachment urls are cookie-authenticated and plain fetch suffices).
     * Everything else keeps the loud missing-provider error — an SDK consumer composing a custom
     * layout without the provider must fail at mount, not silently drop its transport auth.
     */
    allowMissingHost?: boolean;
}

export const useChatFileDownload = ({
    allowMissingHost = false,
}: UseChatFileDownloadOptions = {}): UseChatFileDownloadResult => {
    const host = useOptionalChatHost();

    if (!host && !allowMissingHost) {
        throw new Error('useChatFileDownload must be used within a ChatHostProvider');
    }

    const transport = host?.transport ?? null;
    const [isDownloading, setIsDownloading] = useState(false);

    const fetchBlob = useCallback(
        async (url: string, signal: AbortSignal): Promise<Blob> => {
            const response = transport
                ? await transport.fetch(url, { credentials: transport.credentials, signal })
                : await fetch(url, { credentials: 'include', signal });

            if (!response.ok) {
                throw new Error(`Download failed: ${response.status}`);
            }

            return response.blob();
        },
        [transport],
    );

    const download = useCallback(
        async (url: string, filename: string) => {
            if (!url) {
                showErrorToast(DOWNLOAD_ERROR);

                return;
            }

            setIsDownloading(true);

            try {
                const blob = await fetchBlob(url, new AbortController().signal);
                const downloadUrl = window.URL.createObjectURL(blob);
                const link = document.createElement('a');

                link.href = downloadUrl;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(downloadUrl);
            } catch {
                showErrorToast(DOWNLOAD_ERROR);
            } finally {
                setIsDownloading(false);
            }
        },
        [fetchBlob],
    );

    return { download, isDownloading, fetchBlob };
};
