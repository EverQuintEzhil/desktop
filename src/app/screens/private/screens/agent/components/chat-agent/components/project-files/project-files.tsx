import {
    DownloadIcon,
    FileIcon,
    Loader2Icon,
    MoreVerticalIcon,
    PlusIcon,
    RotateCcwIcon,
    TrashIcon,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';

import { useInfiniteScroll } from '@/app/hooks';
import type { LibraryItem } from '@/components/agent-chat/hooks/use-media-library';
import { useProject } from '@/components/agent-chat/hooks/use-projects';
import DeleteConfirmationModal from '@/components/agent-chat/view/delete-confirmation-modal';
import {
    EmbeddingStatusBadge,
    FileRowsSkeleton,
    FileThumb as SharedFileThumb,
    BORDER_HOVER_CLASS_NAME,
    SURFACE_HOVER_CLASS_NAME,
    formatFileDate,
    formatFileSize,
    type StagedFileStatus,
    useFileDropzone,
    FilePreviewDetails,
    FilePreviewActions,
    StagedUploadRow,
} from '@/components/file-list';
import LibraryPreviewContent from '@/components/file-list/library-preview-content';
import FilePreviewLightbox from '@/components/file-preview-lightbox';
import InfiniteScrollTrigger from '@/components/infinite-scroll-trigger';
import SearchInput from '@/components/search-input';
import { Button } from '@/components/ui/button';
import {
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRoot,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { selectUser } from '@/store/selectors';
import type { ChatAgentType } from '@/types/admin';
import type { ProjectFileType } from '@/types/project';
import { acceptValidFilesFromInput } from '@/utils';

import {
    isImageFile as libIsImageFile,
    isVideoFile as libIsVideoFile,
    isPdfFile as libIsPdfFile,
    isPreviewable as libIsPreviewable,
    fileMeta,
} from '../library/file-preview';
import { STICKY_TAB_SEARCH_CLASS_NAME } from '../project-detail/constants';
import { ACCEPTED_FILE_TYPES } from '../project-detail/file-upload';
import { useProjectFileActions } from '../project-detail/use-file-actions';

interface Props {
    agent: ChatAgentType;
    uploadingFiles?: StagedFileStatus[];
    onUploadFiles?: (files: File[]) => Promise<void>;
    onRemoveUploadingFile?: (id: string) => void;
    onRetryFailedFiles?: () => void;
}

const isImageFile = (file: ProjectFileType): boolean => libIsImageFile(file as unknown as LibraryItem);
const isPreviewable = (file: ProjectFileType): boolean => libIsPreviewable(file as unknown as LibraryItem);

const getPreviewType = (file: ProjectFileType): 'image' | 'video' | 'pdf' | 'file' => {
    const item = file as unknown as LibraryItem;

    if (libIsImageFile(item)) return 'image';
    if (libIsVideoFile(item)) return 'video';
    if (libIsPdfFile(item)) return 'pdf';

    return 'file';
};

const FileThumb = ({ file }: { file: ProjectFileType }) => (
    <SharedFileThumb
        thumbnailUrl={file.thumbnailUrl}
        extension={file.extension}
        fileName={file.name}
        isImage={isImageFile(file)}
    />
);

const ProjectFiles = ({ agent, uploadingFiles, onUploadFiles, onRemoveUploadingFile, onRetryFailedFiles }: Props) => {
    const params = useParams();
    const user = useSelector(selectUser);
    const projectId = params.projectId;

    const [search, setSearch] = useState('');
    const trimmedSearch = search.trim();

    const {
        isError,
        project,
        files,
        actions,
        isFilesLoading,
        hasNextFilesPage,
        isFetchingNextFilesPage,
        fetchNextFilesPage,
    } = useProject(agent._id, projectId, { filesSearch: trimmedSearch });

    const { loadMoreRef } = useInfiniteScroll({
        loading: isFilesLoading,
        showMoreLoading: isFetchingNextFilesPage,
        hasMore: hasNextFilesPage,
        itemsLength: files.length,
        onLoadMore: fetchNextFilesPage,
    });

    const localActions = useProjectFileActions(actions);
    const { downloadingFileId, removingFileId, downloadFile, removeFile } = localActions;

    const actualUploadingFiles = uploadingFiles ?? localActions.uploadingFiles;
    const actualOnUploadFiles = onUploadFiles ?? localActions.uploadFiles;
    const actualOnRemoveUploadingFile = onRemoveUploadingFile ?? localActions.removeUploadingFile;
    const actualOnRetryFailedFiles = onRetryFailedFiles ?? localActions.retryFailedFiles;

    const myRole = project?.members.find((member) => member._id === user._id)?.role;
    const canEdit = Boolean(project) && myRole !== 'viewer';

    const { isDragging, dropzoneProps } = useFileDropzone({
        enabled: canEdit && !onUploadFiles,
        onFiles: actualOnUploadFiles,
        accept: ACCEPTED_FILE_TYPES,
    });

    const [lightboxFile, setLightboxFile] = useState<ProjectFileType | null>(null);
    const [fileToDelete, setFileToDelete] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const onFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
        // Re-validate file type (extension + MIME); toasts + resets input on rejection.
        const selected = acceptValidFilesFromInput(event);

        if (fileInputRef.current) fileInputRef.current.value = '';
        if (selected.length > 0) void actualOnUploadFiles(selected);
    };

    if (isError && !project) {
        return (
            <div className="flex min-h-[60svh] w-full flex-col items-center justify-center gap-4">
                <span className="text-sm text-text-secondary">Couldn&apos;t load this space</span>
                <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
                    Retry
                </Button>
            </div>
        );
    }

    if (!project) {
        return <div className="min-h-[60svh] w-full" />;
    }

    // Staged rows cover in-flight *and* failed uploads, so a list holding only failed rows
    // still counts as non-empty — otherwise the retry affordance would be hidden behind the
    // empty state.
    const hasStagedFiles = actualUploadingFiles.length > 0;
    const isFilesEmpty = files.length === 0 && !hasStagedFiles;

    // An empty library has nothing to search, so the box only earns its place once there is
    // something in the list — staged uploads included, since they are what the user just added.
    // The active term keeps it mounted regardless: a search matching nothing must not remove the
    // input the user is still typing in.
    const showSearch = Boolean(trimmedSearch) || !isFilesEmpty;

    const renderSearch = () => (
        <div className={cn('project-files-search', STICKY_TAB_SEARCH_CLASS_NAME)}>
            <SearchInput
                search={search}
                onChange={setSearch}
                searchOnChange
                debounceWait={400}
                autoFocus={false}
                placeholder="Search knowledge"
                inputClassName="rounded-2xl border-0 shadow-surface h-11"
            />
        </div>
    );

    const renderEmptyState = () => (
        <div className="project-files-empty flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-2xl border border-border-secondary bg-card p-6 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <FileIcon className="size-6" />
            </span>
            <span className="text-sm font-medium">{trimmedSearch ? 'No matching files' : 'No knowledge yet'}</span>
            <span className="max-w-sm text-sm text-text-secondary">
                {trimmedSearch
                    ? `No references in this space match "${trimmedSearch}".`
                    : 'Add PDFs, images, documents, or spreadsheets as references for this space.'}
            </span>
        </div>
    );

    return (
        <div className="relative flex min-h-[60svh] w-full flex-col" {...dropzoneProps}>
            {isDragging ? (
                <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl bg-background/85 text-center">
                    <img src="/assets/images/file-illustration.svg" alt="" className="shared-drag-illustration" />
                    <p className="text-xl font-bold">Drop Here</p>
                </div>
            ) : null}
            <div className="flex flex-col gap-4">
                {canEdit ? (
                    <div className="flex flex-col gap-4">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => fileInputRef.current?.click()}
                            className={cn(
                                'group h-auto w-full justify-start gap-3 rounded-2xl border border-dashed border-border-secondary bg-card px-4 py-4',
                                'text-left text-foreground transition-colors duration-140 disabled:opacity-60',
                                SURFACE_HOVER_CLASS_NAME,
                                BORDER_HOVER_CLASS_NAME,
                            )}
                        >
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <PlusIcon className="size-5" />
                            </span>
                            <span className="flex min-w-0 flex-col">
                                <span className="text-sm font-medium transition-colors group-hover:text-primary">
                                    Add reference
                                </span>
                                <span className="text-xs text-text-secondary">
                                    or drag &amp; drop documents into this area
                                </span>
                            </span>
                        </Button>
                        {actualUploadingFiles.some((f) => f.hasError) && (
                            <div className="flex items-center justify-end">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={actualOnRetryFailedFiles}
                                    className="shrink-0"
                                >
                                    <RotateCcwIcon className="size-3.5" />
                                    {`Retry failed (${actualUploadingFiles.filter((f) => f.hasError).length})`}
                                </Button>
                            </div>
                        )}
                    </div>
                ) : null}

                {showSearch ? renderSearch() : null}

                {/* A new search term starts a fresh query with no rows yet. Without this branch the
                    empty state flashes "No matching files" before the results land. Staged rows are
                    local state, so they keep the list mounted rather than hide behind the skeleton. */}
                {isFilesLoading && !hasStagedFiles ? <FileRowsSkeleton /> : null}

                {!isFilesLoading && isFilesEmpty ? renderEmptyState() : null}

                {hasStagedFiles || (!isFilesLoading && !isFilesEmpty) ? (
                    <ul className="flex flex-col overflow-hidden rounded-2xl border border-border-secondary bg-card">
                        {actualUploadingFiles.map((staged) => (
                            <StagedUploadRow key={staged.id} staged={staged} onRemove={actualOnRemoveUploadingFile} />
                        ))}
                        {files.map((file) => {
                            const meta = [
                                fileMeta(file.extension).label,
                                formatFileSize(file.size),
                                formatFileDate(file.createdAt),
                                file.creatorName,
                            ]
                                .filter(Boolean)
                                .join(' · ');
                            const previewable = isPreviewable(file);

                            return (
                                <li
                                    key={file._id}
                                    className={cn(
                                        'group flex items-center gap-3 border-t border-border-secondary px-4 py-3 first:border-t-0',
                                        'transition-colors duration-140',
                                        SURFACE_HOVER_CLASS_NAME,
                                        previewable && 'cursor-pointer',
                                    )}
                                    role={previewable ? 'button' : undefined}
                                    tabIndex={previewable ? 0 : undefined}
                                    onClick={previewable ? () => setLightboxFile(file) : undefined}
                                    onKeyDown={
                                        previewable
                                            ? (e) => {
                                                  if (e.key === 'Enter' || e.key === ' ') {
                                                      e.preventDefault();
                                                      setLightboxFile(file);
                                                  }
                                              }
                                            : undefined
                                    }
                                >
                                    <FileThumb file={file} />
                                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                        <span className="line-clamp-1 text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                                            {file.name}
                                        </span>
                                        <span className="text-xs text-text-secondary">{meta}</span>
                                    </span>
                                    <EmbeddingStatusBadge status={file.embedding_status} error={file.embedding_error} />

                                    <div
                                        className={cn(
                                            'flex shrink-0 items-center opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100',
                                            (downloadingFileId === file._id || removingFileId === file._id) &&
                                                'opacity-100',
                                        )}
                                        onClick={(e) => e.stopPropagation()}
                                        role="presentation"
                                    >
                                        <DropdownMenuRoot>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    aria-label={`Actions for ${file.name}`}
                                                    className="cursor-pointer text-text-secondary hover:text-foreground"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <MoreVerticalIcon />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="min-w-[160px]">
                                                <DropdownMenuItem
                                                    className="cursor-pointer"
                                                    disabled={downloadingFileId === file._id}
                                                    onSelect={(e) => e.preventDefault()}
                                                    onClick={() => downloadFile(file)}
                                                >
                                                    {downloadingFileId === file._id ? (
                                                        <Loader2Icon className="animate-spin" />
                                                    ) : (
                                                        <DownloadIcon />
                                                    )}
                                                    <span>Download</span>
                                                </DropdownMenuItem>
                                                {canEdit ? (
                                                    <DropdownMenuItem
                                                        variant="destructive"
                                                        className="cursor-pointer"
                                                        disabled={removingFileId === file._id}
                                                        onSelect={(e) => e.preventDefault()}
                                                        onClick={() => removeFile(file._id)}
                                                    >
                                                        {removingFileId === file._id ? (
                                                            <Loader2Icon className="animate-spin" />
                                                        ) : (
                                                            <TrashIcon />
                                                        )}
                                                        <span>Delete</span>
                                                    </DropdownMenuItem>
                                                ) : null}
                                            </DropdownMenuContent>
                                        </DropdownMenuRoot>
                                    </div>
                                </li>
                            );
                        })}

                        <InfiniteScrollTrigger
                            loadMoreRef={loadMoreRef}
                            hasMore={hasNextFilesPage}
                            isLoading={isFetchingNextFilesPage}
                        />
                    </ul>
                ) : null}
            </div>

            <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                accept={ACCEPTED_FILE_TYPES}
                onChange={onFilesSelected}
            />

            {lightboxFile ? (
                <FilePreviewLightbox
                    src={lightboxFile.url}
                    alt={lightboxFile.name}
                    title={lightboxFile.name}
                    isOpen={Boolean(lightboxFile)}
                    type={getPreviewType(lightboxFile)}
                    details={
                        <FilePreviewDetails
                            chips={
                                [
                                    fileMeta(lightboxFile.extension).label,
                                    formatFileSize(lightboxFile.size),
                                    formatFileDate(lightboxFile.createdAt),
                                    lightboxFile.creatorName,
                                ].filter(Boolean) as string[]
                            }
                        />
                    }
                    actions={
                        <FilePreviewActions
                            onOpenInNewTab={
                                lightboxFile.url ? () => window.open(lightboxFile.url, '_blank', 'noopener') : undefined
                            }
                            canDelete={canEdit}
                            onDelete={() => {
                                setLightboxFile(null);
                                setFileToDelete(lightboxFile._id);
                            }}
                        />
                    }
                    onDownload={() => downloadFile(lightboxFile)}
                    isDownloading={downloadingFileId === lightboxFile._id}
                    onClose={() => setLightboxFile(null)}
                >
                    {getPreviewType(lightboxFile) === 'video' ? null : (
                        <LibraryPreviewContent item={lightboxFile as unknown as LibraryItem} />
                    )}
                </FilePreviewLightbox>
            ) : null}

            <DeleteConfirmationModal
                isOpen={Boolean(fileToDelete)}
                onClose={() => setFileToDelete(null)}
                onConfirm={async () => {
                    if (fileToDelete) {
                        await removeFile(fileToDelete);
                        setFileToDelete(null);
                    }
                }}
                title="Delete file"
                isLoading={Boolean(removingFileId && removingFileId === fileToDelete)}
            />
        </div>
    );
};

export default ProjectFiles;
