import { useCallback, useEffect, useRef, useState } from 'react';

import { type StagedFileStatus, useFileDropzone } from '@/components/file-list';
import { useWizardUploadFileMutation } from '@/lib/api/admin/data-stores';
import { showErrorToast, showInfoToast, showSuccessToast } from '@/utils';

import { SYNC_MAX_WAIT_MS, SYNC_POLL_INTERVAL_MS } from '../constants';

interface UseStagedUploadsParams {
    dataStoreId: string;
    canUserEdit: boolean;
    onUploadSuccess: () => void;
    uploadedFileIds: Set<string>;
    onSyncRefetch: () => void;
}

interface UseStagedUploadsResult {
    stagedFiles: StagedFileStatus[];
    isDragOver: boolean;
    dropzoneProps: ReturnType<typeof useFileDropzone>['dropzoneProps'];
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    addFiles: (incoming: File[]) => void;
    handleFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    openFilePicker: () => void;
    removeStaged: (id: string) => void;
    retryFailed: () => void;
    isUploadingAny: boolean;
    failedStagedCount: number;
    hasAwaitingUploads: boolean;
}

export const useStagedUploads = ({
    dataStoreId,
    canUserEdit,
    onUploadSuccess,
    uploadedFileIds,
    onSyncRefetch,
}: UseStagedUploadsParams): UseStagedUploadsResult => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [stagedFiles, setStagedFiles] = useState<StagedFileStatus[]>([]);
    const stagedFilesRef = useRef(stagedFiles);

    stagedFilesRef.current = stagedFiles;
    const uploadFileMutation = useWizardUploadFileMutation();

    const uploadBatch = useCallback(
        async (batch: StagedFileStatus[]) => {
            if (batch.length === 0) return;

            const uploadPromises = batch.map(async (staged) => {
                try {
                    const formData = new FormData();

                    formData.append('datastore_id', dataStoreId);
                    formData.append('file', staged.file);

                    const uploaded = await uploadFileMutation.mutateAsync({
                        formData,
                        onUploadProgress: (progress) => {
                            setStagedFiles((prev) => prev.map((f) => (f.id === staged.id ? { ...f, progress } : f)));
                        },
                        signal: staged.abortController?.signal,
                    });
                    const uploadedId = uploaded?.[0]?._id;

                    setStagedFiles((prev) =>
                        prev.map((f) =>
                            f.id === staged.id
                                ? {
                                      ...f,
                                      isUploading: false,
                                      isAwaitingSync: true,
                                      progress: 100,
                                      uploadedId,
                                      syncStartedAt: Date.now(),
                                  }
                                : f,
                        ),
                    );

                    return 'SUCCESS';
                } catch (error) {
                    if (error instanceof Error && error.name === 'CanceledError') return 'CANCELED';

                    setStagedFiles((prev) =>
                        prev.map((f) => (f.id === staged.id ? { ...f, isUploading: false, hasError: true } : f)),
                    );
                    throw error;
                }
            });

            const results = await Promise.allSettled(uploadPromises);
            const hasErrors = results.some((r) => r.status === 'rejected');
            const succeededCount = results.filter((r) => r.status === 'fulfilled' && r.value === 'SUCCESS').length;
            const cancelledCount = results.filter((r) => r.status === 'fulfilled' && r.value === 'CANCELED').length;

            if (hasErrors) {
                showErrorToast('Failed to upload some files. Please try again.');
            }

            if (cancelledCount > 0) {
                showInfoToast(
                    cancelledCount === 1 ? 'File upload cancelled' : `${cancelledCount} file uploads cancelled`,
                );
            }

            if (succeededCount > 0) {
                onUploadSuccess();
            }
        },
        [dataStoreId, uploadFileMutation, onUploadSuccess],
    );

    const addFiles = useCallback(
        (incoming: File[]) => {
            const next: StagedFileStatus[] = incoming.map((file) => ({
                id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
                file,
                isUploading: true,
                hasError: false,
                progress: 0,
                abortController: new AbortController(),
            }));

            setStagedFiles((prev) => [...prev, ...next]);
            void uploadBatch(next);
        },
        [uploadBatch],
    );

    const { isDragging: isDragOver, dropzoneProps } = useFileDropzone({
        enabled: canUserEdit,
        onFiles: (files) => {
            if (files.length > 0) addFiles(files);
        },
    });

    const handleFileInputChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            if (e.target.files) {
                addFiles(Array.from(e.target.files));
            }

            e.target.value = '';
        },
        [addFiles],
    );

    const openFilePicker = useCallback(() => {
        if (canUserEdit) fileInputRef.current?.click();
    }, [canUserEdit]);

    const removeStaged = useCallback((id: string) => {
        setStagedFiles((prev) => {
            const file = prev.find((f) => f.id === id);

            file?.abortController?.abort();

            return prev.filter((f) => f.id !== id);
        });
    }, []);

    const retryFailed = useCallback(() => {
        const failed = stagedFiles.filter((f) => f.hasError).map((f) => ({ ...f, isUploading: true, hasError: false }));

        if (failed.length === 0) return;

        const failedIds = new Set(failed.map((f) => f.id));

        setStagedFiles((prev) =>
            prev.map((f) => (failedIds.has(f.id) ? { ...f, isUploading: true, hasError: false } : f)),
        );

        void uploadBatch(failed);
    }, [stagedFiles, uploadBatch]);

    const hasLandedInList = useCallback(
        (staged: StagedFileStatus) => staged.uploadedId != null && uploadedFileIds.has(staged.uploadedId),
        [uploadedFileIds],
    );

    useEffect(() => {
        const landed = stagedFiles.filter((f) => f.isAwaitingSync && hasLandedInList(f));

        if (landed.length === 0) return;

        const landedIds = new Set(landed.map((f) => f.id));

        setStagedFiles((prev) => prev.filter((f) => !landedIds.has(f.id)));
        showSuccessToast(
            landed.length === 1 ? 'File uploaded successfully.' : `${landed.length} files uploaded successfully.`,
        );
    }, [stagedFiles, hasLandedInList]);

    const hasAwaitingRows = stagedFiles.some((f) => f.isAwaitingSync);

    useEffect(() => {
        if (!hasAwaitingRows) return undefined;

        const interval = setInterval(() => {
            onSyncRefetch();

            const now = Date.now();
            const timedOut = stagedFilesRef.current.filter(
                (f) => f.isAwaitingSync && f.syncStartedAt != null && now - f.syncStartedAt > SYNC_MAX_WAIT_MS,
            );

            if (timedOut.length === 0) return;

            const timedOutIds = new Set(timedOut.map((f) => f.id));

            setStagedFiles((prev) => prev.filter((f) => !timedOutIds.has(f.id)));
            showInfoToast(
                timedOut.length === 1
                    ? 'Your upload is still processing and will appear here shortly.'
                    : `${timedOut.length} uploads are still processing and will appear here shortly.`,
            );
        }, SYNC_POLL_INTERVAL_MS);

        return () => clearInterval(interval);
    }, [hasAwaitingRows, onSyncRefetch]);

    const isUploadingAny = stagedFiles.some((f) => f.isUploading);
    const failedStagedCount = stagedFiles.filter((f) => f.hasError).length;

    return {
        stagedFiles,
        isDragOver,
        dropzoneProps,
        fileInputRef,
        addFiles,
        handleFileInputChange,
        openFilePicker,
        removeStaged,
        retryFailed,
        isUploadingAny,
        failedStagedCount,
        hasAwaitingUploads: hasAwaitingRows,
    };
};
