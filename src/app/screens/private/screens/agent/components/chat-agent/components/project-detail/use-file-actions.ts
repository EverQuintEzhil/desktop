import { useState } from 'react';

import type { StagedFileStatus } from '@/components/file-list';
import { uiAxios } from '@/lib/axios';
import type { ProjectFileType } from '@/types/project';
import { showErrorToast, showSuccessToast, showInfoToast } from '@/utils';

import { isAllowedFile, unsupportedFilesMessage } from './file-upload';

interface FileActions {
    uploadFiles: (
        files: File[],
        options?: {
            onProgress?: (file: File, progress: number) => void;
            onError?: (file: File) => void;
            onSuccess?: (file: File) => void;
            getSignal?: (file: File) => AbortSignal | undefined;
        },
    ) => Promise<string[]>;
    removeFile: (fileId: string) => Promise<void>;
}

/**
 * Upload / download / remove for project files, with validation, toasts, and
 * per-action loading state. Shared by the Files panel and the files page.
 */
export const useProjectFileActions = (actions: FileActions) => {
    const [uploadingFiles, setUploadingFiles] = useState<StagedFileStatus[]>([]);
    const isUploading = uploadingFiles.some((f) => f.isUploading);

    const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
    const [removingFileId, setRemovingFileId] = useState<string | null>(null);

    const performUpload = async (staged: StagedFileStatus[]) => {
        const allowed = staged.map((s) => s.file);

        try {
            const response = await actions.uploadFiles(allowed, {
                onProgress: (file, progress) => {
                    setUploadingFiles((prev) => prev.map((u) => (u.file === file ? { ...u, progress } : u)));
                },
                onError: (file) => {
                    setUploadingFiles((prev) =>
                        prev.map((u) => (u.file === file ? { ...u, hasError: true, isUploading: false } : u)),
                    );
                },
                onSuccess: (file) => {
                    setUploadingFiles((prev) =>
                        prev.map((u) => (u.file === file ? { ...u, isSuccess: true, progress: 100 } : u)),
                    );
                },
                getSignal: (file) => staged.find((s) => s.file === file)?.abortController?.signal,
            });

            const results = response || [];
            const successCount = results.filter((r) => r === 'SUCCESS').length;
            const cancelCount = results.filter((r) => r === 'CANCELED').length;

            if (successCount > 0) {
                showSuccessToast(successCount === 1 ? 'File uploaded' : `${successCount} files uploaded`);
            }

            if (cancelCount > 0) {
                showInfoToast(cancelCount === 1 ? 'File upload cancelled' : `${cancelCount} file uploads cancelled`);
            }
        } catch {
            showErrorToast('Failed to upload files');
        } finally {
            setUploadingFiles((prev) => prev.filter((f) => f.hasError));
        }
    };

    const uploadFiles = async (selected: File[]) => {
        if (selected.length === 0) return;

        const allowed = selected.filter(isAllowedFile);
        const rejected = selected.length - allowed.length;

        if (rejected > 0) showErrorToast(unsupportedFilesMessage(rejected));
        if (allowed.length === 0) return;

        const newStaged: StagedFileStatus[] = allowed.map((file) => ({
            id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
            file,
            progress: 0,
            hasError: false,
            isUploading: true,
            abortController: new AbortController(),
        }));

        setUploadingFiles((prev) => [...prev, ...newStaged]);
        await performUpload(newStaged);
    };

    const removeUploadingFile = (id: string) => {
        setUploadingFiles((prev) => {
            const target = prev.find((f) => f.id === id);

            target?.abortController?.abort();

            return prev.filter((f) => f.id !== id);
        });
    };

    const retryFailedFiles = () => {
        const failedStaged = uploadingFiles.filter((f) => f.hasError);

        if (failedStaged.length === 0) return;

        const retryingStaged = failedStaged.map((f) => ({
            ...f,
            hasError: false,
            isUploading: true,
            progress: 0,
            abortController: new AbortController(),
        }));

        setUploadingFiles((prev) =>
            prev.map((u) => {
                const retrying = retryingStaged.find((r) => r.id === u.id);

                return retrying ?? u;
            }),
        );

        void performUpload(retryingStaged);
    };

    const downloadFile = async (file: ProjectFileType) => {
        if (!file.url) return;

        setDownloadingFileId(file._id);
        try {
            const response = await uiAxios.get<Blob>(file.url, { responseType: 'blob' });
            const downloadUrl = window.URL.createObjectURL(response.data);
            const link = document.createElement('a');

            link.href = downloadUrl;
            link.download = file.name || 'file';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(downloadUrl);
            showSuccessToast('File downloaded');
        } catch {
            showErrorToast('Failed to download file');
        } finally {
            setDownloadingFileId(null);
        }
    };

    const removeFile = async (fileId: string) => {
        setRemovingFileId(fileId);
        try {
            await actions.removeFile(fileId);
            showSuccessToast('File removed');
        } catch {
            showErrorToast('Failed to remove file');
        } finally {
            setRemovingFileId(null);
        }
    };

    return {
        isUploading,
        uploadingFiles,
        downloadingFileId,
        removingFileId,
        uploadFiles,
        downloadFile,
        removeFile,
        removeUploadingFile,
        retryFailedFiles,
    };
};
