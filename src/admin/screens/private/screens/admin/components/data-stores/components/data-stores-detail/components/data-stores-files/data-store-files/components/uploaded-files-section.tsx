import { FilesIcon } from 'lucide-react';

import { Pagination } from '@/components/table/components';
import type { DataStoreFileRecord } from '@/lib/api/admin/data-stores';

import { DataStoreFilesListSkeletonOnly } from '../../data-store-files-skeleton';
import type { useUploadedFiles } from '../hooks/use-uploaded-files';

import UploadedFileRow from './uploaded-file-row';
import UploadedFilesHeader from './uploaded-files-header';

export interface Props {
    canUserEdit: boolean;
    uploadedFilesState: ReturnType<typeof useUploadedFiles>;
    isAwaitingUploads: boolean;
    downloadingFileIds: Set<string>;
    deletingFileId: string | null;
    onPreview: (record: DataStoreFileRecord) => void;
    onDownload: (record: DataStoreFileRecord) => void;
    onDeleteRequest: (record: DataStoreFileRecord) => void;
}

const renderLoadingState = (canUserEdit: boolean) => <DataStoreFilesListSkeletonOnly canUserEdit={canUserEdit} />;

const renderErrorState = () => (
    <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-2xl border border-border-secondary bg-card p-6 text-center">
        <span className="text-sm text-destructive">Failed to load uploaded files.</span>
    </div>
);

const renderEmptyState = (canUserEdit: boolean) => (
    <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-2xl border border-border-secondary bg-card p-6 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <FilesIcon className="size-6" />
        </span>
        <span className="text-sm font-medium">No files uploaded yet</span>
        <span className="max-w-sm text-sm text-text-secondary">
            {canUserEdit
                ? 'Drag and drop files above, or click "Add file" to upload. Your files will appear here once added.'
                : 'Files added to this data store will appear here.'}
        </span>
    </div>
);

const UploadedFilesSection = ({
    canUserEdit,
    uploadedFilesState,
    isAwaitingUploads,
    downloadingFileIds,
    deletingFileId,
    onPreview,
    onDownload,
    onDeleteRequest,
}: Props) => {
    const {
        filesQuery,
        uploadedFiles: uploaded,
        pageIndex,
        setPageIndex,
        deleteFileMutation,
        selectedFileIds,
        setSelectedFileIds,
        toggleSelectFile,
        selectAllFiles,
        handleDeleteSelected,
        isFileMutating,
    } = uploadedFilesState;

    if (filesQuery.isLoading) return renderLoadingState(canUserEdit);
    if (filesQuery.isError) return renderErrorState();

    const pageInfo = filesQuery.data?.page_info;
    const totalPages = pageInfo?.total_pages ?? 0;
    const totalCount = pageInfo?.total_count ?? uploaded.length;

    if (uploaded.length === 0 && pageIndex === 0) {
        return renderEmptyState(canUserEdit);
    }

    const allSelected = uploaded.length > 0 && uploaded.every((r) => selectedFileIds.has(r._id));
    const someSelected = !allSelected && uploaded.some((r) => selectedFileIds.has(r._id));

    const handleSelectAllChange = (checked: boolean) => {
        if (checked) {
            selectAllFiles();
        } else {
            setSelectedFileIds(new Set());
        }
    };

    const handlePageChange = (page: number) => {
        setPageIndex(page - 1);
        setSelectedFileIds(new Set());
    };

    return (
        <div className="data-store-files-uploaded flex flex-col gap-3">
            <UploadedFilesHeader
                canUserEdit={canUserEdit}
                allSelected={allSelected}
                someSelected={someSelected}
                isFileMutating={isFileMutating}
                isDeletingSelected={deleteFileMutation.isPending}
                totalCount={totalCount}
                selectedCount={selectedFileIds.size}
                onSelectAllChange={handleSelectAllChange}
                onDeleteSelected={() => {
                    void handleDeleteSelected();
                }}
            />

            <ul className="data-store-files-uploaded-list flex flex-col overflow-hidden rounded-2xl border border-border-secondary bg-card">
                {uploaded.map((record) => (
                    <UploadedFileRow
                        key={record._id}
                        record={record}
                        canUserEdit={canUserEdit}
                        isSelected={selectedFileIds.has(record._id)}
                        isFileMutating={isFileMutating}
                        isDownloading={downloadingFileIds.has(record._id)}
                        isDeleting={deletingFileId === record._id}
                        onToggleSelect={toggleSelectFile}
                        onPreview={onPreview}
                        onDownload={onDownload}
                        onDeleteRequest={onDeleteRequest}
                    />
                ))}
            </ul>

            {totalPages > 1 && (
                <div className="flex justify-center">
                    <Pagination
                        count={totalPages}
                        page={pageIndex + 1}
                        onChange={handlePageChange}
                        disabled={filesQuery.isFetching || isFileMutating || isAwaitingUploads}
                    />
                </div>
            )}
        </div>
    );
};

export default UploadedFilesSection;
