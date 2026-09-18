import { useCallback, useState } from 'react';

import { useWizardDeleteFilesMutation, useWizardFilesQuery } from '@/lib/api/admin/data-stores';
import { showErrorToast, showSuccessToast } from '@/utils';

import { DELAY_AFTER_MUTATION, PAGE_SIZE } from '../constants';

export const useUploadedFiles = (dataStoreId: string) => {
    const [pageIndex, setPageIndex] = useState(0);
    const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
    const [isVerifyingDelete, setIsVerifyingDelete] = useState(false);

    const filesQuery = useWizardFilesQuery(dataStoreId, pageIndex, PAGE_SIZE);
    const deleteFileMutation = useWizardDeleteFilesMutation(dataStoreId);
    const uploadedFiles = filesQuery.data?.values ?? [];
    const refetchFiles = filesQuery.refetch;

    const delayedRefetch = useCallback(async () => {
        await new Promise<void>((resolve) => {
            setTimeout(resolve, DELAY_AFTER_MUTATION);
        });
        await refetchFiles();
    }, [refetchFiles]);

    const verifiedDelayedRefetch = useCallback(async () => {
        setIsVerifyingDelete(true);

        try {
            await delayedRefetch();
        } finally {
            setIsVerifyingDelete(false);
        }
    }, [delayedRefetch]);

    const navigateToPreviousPageIfEmptied = useCallback(
        (removedFileIds: string[]) => {
            if (pageIndex === 0 || uploadedFiles.length === 0) return;

            const removedFileIdSet = new Set(removedFileIds);
            const isCurrentPageEmptied = uploadedFiles.every((file) => removedFileIdSet.has(file._id));

            if (isCurrentPageEmptied) {
                setPageIndex((prev) => Math.max(prev - 1, 0));
            }
        },
        [pageIndex, uploadedFiles],
    );

    const resetToFirstPageAfterUpload = useCallback(() => {
        setPageIndex(0);
        void delayedRefetch();
    }, [delayedRefetch]);

    const handleDeleteUploadedFile = useCallback(
        async (fileId: string) => {
            try {
                await deleteFileMutation.mutateAsync([fileId]);
                showSuccessToast('File deleted.');
                navigateToPreviousPageIfEmptied([fileId]);
                setSelectedFileIds((prev) => {
                    const next = new Set(prev);

                    next.delete(fileId);

                    return next;
                });
                void verifiedDelayedRefetch();
            } catch {
                showErrorToast('Failed to delete file. Please try again.');
            }
        },
        [deleteFileMutation, navigateToPreviousPageIfEmptied, verifiedDelayedRefetch],
    );

    const toggleSelectFile = useCallback((id: string, checked: boolean) => {
        setSelectedFileIds((prev) => {
            const next = new Set(prev);

            if (checked) {
                next.add(id);
            } else {
                next.delete(id);
            }

            return next;
        });
    }, []);

    const selectAllFiles = useCallback(() => {
        setSelectedFileIds(new Set(uploadedFiles.map((record) => record._id)));
    }, [uploadedFiles]);

    const handleDeleteSelected = useCallback(async () => {
        if (selectedFileIds.size === 0) return;

        const ids = [...selectedFileIds];

        try {
            await deleteFileMutation.mutateAsync(ids);
            showSuccessToast(`${ids.length} file${ids.length === 1 ? '' : 's'} deleted.`);
            navigateToPreviousPageIfEmptied(ids);
            setSelectedFileIds(new Set());
            void verifiedDelayedRefetch();
        } catch {
            showErrorToast('Failed to delete selected files. Please try again.');
        }
    }, [selectedFileIds, deleteFileMutation, navigateToPreviousPageIfEmptied, verifiedDelayedRefetch]);

    const isFileMutating = deleteFileMutation.isPending || isVerifyingDelete;

    return {
        filesQuery,
        uploadedFiles,
        pageIndex,
        setPageIndex,
        deleteFileMutation,
        resetToFirstPageAfterUpload,
        handleDeleteUploadedFile,
        handleDeleteSelected,
        selectedFileIds,
        setSelectedFileIds,
        toggleSelectFile,
        selectAllFiles,
        isFileMutating,
    };
};
