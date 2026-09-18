import { useCallback, useState } from 'react';

import type { DataStoreFileRecord } from '@/lib/api/admin/data-stores';
import { uiAxios } from '@/lib/axios';
import { showErrorToast } from '@/utils';

export const useFileDownload = () => {
    const [downloadingFileIds, setDownloadingFileIds] = useState<Set<string>>(new Set());

    const handleDownloadFile = useCallback(async (record: DataStoreFileRecord) => {
        setDownloadingFileIds((prev) => new Set(prev).add(record._id));

        try {
            const response = await uiAxios.get<Blob>(record.url, { responseType: 'blob' });
            const downloadUrl = window.URL.createObjectURL(response.data);
            const link = document.createElement('a');

            link.href = downloadUrl;
            link.download = record.name || 'file';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(downloadUrl);
        } catch {
            showErrorToast('Failed to download file. Please try again.');
        } finally {
            setDownloadingFileIds((prev) => {
                const next = new Set(prev);

                next.delete(record._id);

                return next;
            });
        }
    }, []);

    return { downloadingFileIds, handleDownloadFile };
};
