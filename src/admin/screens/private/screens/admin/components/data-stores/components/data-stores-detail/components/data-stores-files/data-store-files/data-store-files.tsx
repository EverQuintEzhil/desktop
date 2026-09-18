import { PlusIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import DeleteConfirmationModal from '@/components/agent-chat/view/delete-confirmation-modal';
import { BORDER_HOVER_CLASS_NAME, SURFACE_HOVER_CLASS_NAME } from '@/components/file-list';
import { Button } from '@/components/ui/button';
import type { DataStoreFileRecord } from '@/lib/api/admin/data-stores';
import { cn } from '@/lib/utils';

import FilePreviewModal from './components/file-preview-modal';
import StagedFilesList from './components/staged-files-list';
import UploadedFilesSection from './components/uploaded-files-section';
import { useFileDownload, useSelectAllShortcut, useStagedUploads, useUploadedFiles } from './hooks';
import type { Props } from './types';

const DataStoreFiles = ({ dataStore, canUserEdit, renderLibraryImport }: Props) => {
    const [lightboxFile, setLightboxFile] = useState<DataStoreFileRecord | null>(null);
    const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
    const [fileToDelete, setFileToDelete] = useState<string | null>(null);

    const uploadedFilesState = useUploadedFiles(dataStore._id);
    const {
        uploadedFiles,
        selectAllFiles,
        handleDeleteUploadedFile,
        isFileMutating,
        resetToFirstPageAfterUpload,
        setPageIndex,
    } = uploadedFilesState;

    const uploadedFileIds = useMemo(() => new Set(uploadedFiles.map((r) => r._id)), [uploadedFiles]);
    const refetchUploadedFiles = uploadedFilesState.filesQuery.refetch;
    const handleSyncRefetch = useCallback(() => {
        void refetchUploadedFiles();
    }, [refetchUploadedFiles]);

    const {
        stagedFiles,
        isDragOver,
        dropzoneProps,
        fileInputRef,
        addFiles,
        handleFileInputChange,
        openFilePicker,
        removeStaged,
        retryFailed,
        hasAwaitingUploads,
    } = useStagedUploads({
        dataStoreId: dataStore._id,
        canUserEdit,
        onUploadSuccess: resetToFirstPageAfterUpload,
        uploadedFileIds,
        onSyncRefetch: handleSyncRefetch,
    });

    useEffect(() => {
        if (hasAwaitingUploads) setPageIndex(0);
    }, [hasAwaitingUploads, setPageIndex]);

    const { downloadingFileIds, handleDownloadFile } = useFileDownload();

    const isOverlayOpen = Boolean(lightboxFile) || Boolean(fileToDelete);
    const hasUploadedFiles = uploadedFiles.length > 0;

    useSelectAllShortcut({
        enabled: canUserEdit && !isOverlayOpen && !isFileMutating && hasUploadedFiles,
        onSelectAll: selectAllFiles,
    });

    const requestDelete = (record: DataStoreFileRecord) => {
        setLightboxFile(null);
        setFileToDelete(record._id);
    };

    const confirmDelete = async () => {
        if (!fileToDelete) return;

        setDeletingFileId(fileToDelete);
        await handleDeleteUploadedFile(fileToDelete).finally(() => {
            setDeletingFileId(null);
        });
        setFileToDelete(null);
    };

    const renderDragOverlay = () => {
        if (!isDragOver) return null;

        return (
            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl bg-background/85 text-center">
                <img src="/assets/images/file-illustration.svg" alt="" className="shared-drag-illustration" />
                <p className="text-xl font-bold">Drop Here</p>
            </div>
        );
    };

    const renderAddFileControls = () => {
        if (!canUserEdit) return null;

        return (
            <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                    type="button"
                    variant="ghost"
                    onClick={openFilePicker}
                    className={cn(
                        'group h-auto flex-1 justify-start gap-3 rounded-2xl border border-dashed border-border-secondary bg-card px-4 py-4',
                        'text-left text-foreground transition-colors duration-140 disabled:opacity-60',
                        SURFACE_HOVER_CLASS_NAME,
                        BORDER_HOVER_CLASS_NAME,
                    )}
                >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <PlusIcon className="size-5" />
                    </span>
                    <span className="flex min-w-0 flex-col">
                        <span className="text-sm font-medium transition-colors group-hover:text-primary">Add file</span>
                        <span className="text-xs text-text-secondary">or drag &amp; drop files here</span>
                    </span>
                </Button>
                {renderLibraryImport?.({ onImportFiles: addFiles })}
            </div>
        );
    };

    const renderLightbox = () => {
        if (!lightboxFile) return null;

        return (
            <FilePreviewModal
                file={lightboxFile}
                canUserEdit={canUserEdit}
                isDownloading={downloadingFileIds.has(lightboxFile._id)}
                onDownload={(record) => {
                    void handleDownloadFile(record);
                }}
                onClose={() => setLightboxFile(null)}
                onDeleteRequest={requestDelete}
            />
        );
    };

    return (
        <div
            className="data-store-files-container relative flex min-h-[60svh] w-full flex-col gap-4 p-4"
            {...dropzoneProps}
        >
            {renderDragOverlay()}
            {renderAddFileControls()}

            <StagedFilesList
                stagedFiles={stagedFiles}
                canUserEdit={canUserEdit}
                onRetryFailed={retryFailed}
                onRemove={removeStaged}
            />

            <UploadedFilesSection
                canUserEdit={canUserEdit}
                uploadedFilesState={uploadedFilesState}
                isAwaitingUploads={hasAwaitingUploads}
                downloadingFileIds={downloadingFileIds}
                deletingFileId={deletingFileId}
                onPreview={setLightboxFile}
                onDownload={(record) => {
                    void handleDownloadFile(record);
                }}
                onDeleteRequest={requestDelete}
            />

            <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileInputChange}
                disabled={!canUserEdit}
            />

            {renderLightbox()}

            <DeleteConfirmationModal
                isOpen={Boolean(fileToDelete)}
                onClose={() => setFileToDelete(null)}
                onConfirm={confirmDelete}
                title="Delete file"
                isLoading={Boolean(deletingFileId && deletingFileId === fileToDelete)}
            />
        </div>
    );
};

export default DataStoreFiles;
