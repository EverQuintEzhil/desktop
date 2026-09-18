import {
    FilePlusIcon,
    FolderPlusIcon,
    FileIcon,
    ChevronRightIcon,
    PencilIcon,
    Trash2Icon,
    Loader2Icon,
    UploadIcon,
} from 'lucide-react';
import React, { useEffect, useRef } from 'react';

import Dropzone from '@/components/dropzone';
import { MarkdownViewToggle, type MarkdownViewMode } from '@/components/markdown/markdown-view-toggle';
import { Button } from '@/components/ui/button';
import ConfirmationModal from '@/components/ui/confirmation-modal';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { cn } from '@/lib/utils';

import { SkillFileEditor } from './components/skill-file-editor';
import { SkillFileTree } from './components/skill-file-tree';
import { useSkillFiles } from './hooks/use-skill-files';
import type { SkillInstructionsProps, SkillFileListItem } from './types';
import { isEditableFile, isMarkdownFile } from './utils';
import './skill-instructions.scss';

const SkillInstructions: React.FC<SkillInstructionsProps> = ({
    skill,
    headerContent,
    footerContent,
    readOnly = false,
}) => {
    const {
        selectedFile,
        fileContent,
        handleContentChange,
        isLoadingFile,
        isDirty,
        currentPath,
        setCurrentPath,
        expandedFolders,
        toggleFolderExpanded,
        loadingFolders,
        isRenamingInline,
        setIsRenamingInline,
        setInlineRenameValue,
        handleSaveRename,
        renamingListPath,
        setRenamingListPath,
        setListRenameValue,
        handleSaveListRename,
        handleCancelListRename,
        isRenamingFile,
        deleteModalState,
        setDeleteModalState,
        handleConfirmDelete,
        isDeletingFile,
        mobileView,
        setMobileView,
        addingInline,
        setAddingInline,
        handleStartAdd,
        handleSaveAdd,
        isAddingFileOrFolder,
        newFileName,
        setNewFileName,
        isFetchingRoot,
        rootItems,
        getFolderItems,
        isSelectedFileProtected,
        isSavingFileContent,
        isUploadingFile,
        handleFileChange,
        expandAncestorFolders,
        handleSelectFile,
    } = useSkillFiles(skill);

    const [mdViewMode, setMdViewMode] = React.useState<MarkdownViewMode>('rendered');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const inlineRenameRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        setMdViewMode('rendered');
    }, [selectedFile]);

    useEffect(() => {
        if (isRenamingInline && inlineRenameRef.current) {
            inlineRenameRef.current.focus();
            const range = document.createRange();

            range.selectNodeContents(inlineRenameRef.current);
            const sel = window.getSelection();

            sel?.removeAllRanges();
            sel?.addRange(range);
        }
    }, [isRenamingInline]);

    const handleUploadFile = () => {
        fileInputRef.current?.click();
    };

    const handleAddFile = () => {
        void handleStartAdd('file');
    };

    const handleAddFolder = () => {
        void handleStartAdd('folder');
    };

    const handleRenameFileClick = () => {
        if (!selectedFile) return;
        if (isSelectedFileProtected) return;

        const currentName = selectedFile.split('/').pop() || selectedFile;

        setInlineRenameValue(currentName);
        setIsRenamingInline(true);
    };

    const handleDeleteSelectedFileClick = () => {
        if (!selectedFile) return;
        setDeleteModalState({ isOpen: true, path: selectedFile });
    };

    const handleItemClick = async (f: SkillFileListItem) => {
        if (f.isFolder) {
            setCurrentPath(f.path);
            if (!expandedFolders.has(f.path)) {
                await toggleFolderExpanded(f.path);
            }

            return;
        }

        const parentPath = f.path.split('/').slice(0, -1).join('/');

        setCurrentPath(parentPath);
        setMobileView('content');
        await expandAncestorFolders(f.path);
        await handleSelectFile(f);
    };

    const handleRenameListClick = (path: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setListRenameValue(path.split('/').pop() || path);
        setRenamingListPath(path);
    };

    const renderSaveStatus = () => {
        if (isSavingFileContent) {
            return (
                <span className="flex w-16 items-center justify-end gap-1 text-right">
                    <Loader2Icon size={12} className="animate-spin" />
                    Saving...
                </span>
            );
        }

        if (isDirty) {
            return (
                <span className="flex w-16 items-center justify-end gap-1 text-right">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    Unsaved
                </span>
            );
        }

        return <span className="text-text-tertiary flex w-16 justify-end text-right">Saved</span>;
    };

    return (
        <Dropzone
            multiple
            global
            accept=""
            onChange={handleFileChange}
            uploading={isUploadingFile}
            disabled={readOnly}
            className="h-full"
        >
            <div className="flex h-full w-full flex-col">
                {headerContent}

                {/* Action bar */}
                {!readOnly && (
                    <div className="flex shrink-0 items-center justify-end gap-1.5 border-b border-border-secondary bg-card px-4 py-2">
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleFileChange}
                            disabled={isUploadingFile}
                        />
                        <Button variant="ghost" size="xs" onClick={handleUploadFile} disabled={isUploadingFile}>
                            {isUploadingFile ? (
                                <Loader2Icon size={14} className="animate-spin" />
                            ) : (
                                <UploadIcon size={14} />
                            )}
                            Upload File
                        </Button>
                        <Button variant="outline" size="xs" onClick={handleAddFolder}>
                            <FolderPlusIcon size={14} />
                            Add Folder
                        </Button>
                        <Button size="xs" onClick={handleAddFile}>
                            <FilePlusIcon size={14} />
                            Add File
                        </Button>
                    </div>
                )}

                {/* Explorer + editor */}
                <div className="relative min-h-0 flex-1 overflow-hidden md:flex">
                    {/* Explorer panel */}
                    <div
                        className={cn(
                            'flex flex-col border-border-secondary bg-card',
                            'absolute inset-0 z-10 transition-transform duration-300 ease-in-out',
                            mobileView === 'content' ? '-translate-x-full' : 'translate-x-0',
                            'md:relative md:inset-auto md:z-auto md:w-[240px] md:shrink-0 md:translate-x-0 md:border-r md:transition-none',
                        )}
                    >
                        <div className="flex min-h-[41px] shrink-0 items-center border-b border-border-secondary px-3 py-2">
                            <span className="text-[12px] font-medium tracking-wide text-text-secondary uppercase">
                                Explorer
                            </span>
                        </div>
                        <div
                            className="scrollbar-controller scrollbar-vertical flex-1 pb-4"
                            onClick={(e) => {
                                const target = e.target as HTMLElement;

                                if (!target.closest('.skill-file-row')) {
                                    setCurrentPath('');
                                }
                            }}
                        >
                            <SkillFileTree
                                items={rootItems}
                                depth={0}
                                currentPath={currentPath}
                                selectedFile={selectedFile}
                                expandedFolders={expandedFolders}
                                loadingFolders={loadingFolders}
                                isRootLoading={isFetchingRoot && rootItems.length === 0}
                                renamingListPath={renamingListPath}
                                isRenamingFile={isRenamingFile}
                                isDeletingFile={isDeletingFile}
                                onToggleFolder={toggleFolderExpanded}
                                onItemClick={handleItemClick}
                                onRenameClick={handleRenameListClick}
                                onDeleteClick={(path) => void handleConfirmDelete(path)}
                                onRenameListValueChange={setListRenameValue}
                                onRenameListSave={handleSaveListRename}
                                onRenameListCancel={handleCancelListRename}
                                getFolderItems={getFolderItems}
                                addingInline={addingInline}
                                newFileName={newFileName}
                                onNewFileNameChange={setNewFileName}
                                onSaveAdd={() => void handleSaveAdd()}
                                onCancelAdd={() => {
                                    setAddingInline(null);
                                    setNewFileName('');
                                }}
                                isAddingFileOrFolder={isAddingFileOrFolder}
                                readOnly={readOnly}
                            />
                        </div>
                    </div>

                    {/* File content panel */}
                    <div
                        className={cn(
                            'file-content-panel flex flex-col',
                            'absolute inset-0 transition-transform duration-300 ease-in-out',
                            mobileView === 'explorer' ? 'translate-x-full' : 'translate-x-0',
                            'md:relative md:inset-auto md:min-h-0 md:min-w-0 md:flex-1 md:translate-x-0 md:transition-none',
                        )}
                    >
                        {selectedFile ? (
                            <>
                                {/* File header */}
                                <div className="file-header flex h-[41px] shrink-0 items-center justify-between gap-2 border-b border-border-secondary bg-card px-4 py-2">
                                    <span className="text-text-primary flex min-w-0 flex-1 items-center gap-1.5 text-sm font-medium">
                                        <Button
                                            variant="ghost"
                                            size="icon-xs"
                                            className="-ml-1 shrink-0 text-text-secondary md:hidden"
                                            aria-label="Back to explorer"
                                            onClick={() => setMobileView('explorer')}
                                        >
                                            <ChevronRightIcon size={15} className="rotate-180" />
                                        </Button>
                                        <FileIcon size={13} className="shrink-0 text-text-secondary" />
                                        <span
                                            ref={inlineRenameRef}
                                            contentEditable={isRenamingInline}
                                            suppressContentEditableWarning
                                            className="truncate outline-none"
                                            onInput={(e) => setInlineRenameValue(e.currentTarget.textContent || '')}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    void handleSaveRename();
                                                } else if (e.key === 'Escape') {
                                                    e.preventDefault();
                                                    setIsRenamingInline(false);
                                                    setInlineRenameValue('');
                                                }
                                            }}
                                            onBlur={() => {
                                                if (isRenamingInline) {
                                                    void handleSaveRename();
                                                }
                                            }}
                                        >
                                            {isRenamingInline
                                                ? selectedFile.split('/').pop() || selectedFile
                                                : selectedFile}
                                        </span>
                                        {!readOnly && !isSelectedFileProtected && !isRenamingInline && (
                                            <SimpleTooltip content="Rename File">
                                                <Button
                                                    variant="ghost"
                                                    size="icon-xs"
                                                    className="shrink-0 text-text-secondary"
                                                    onClick={handleRenameFileClick}
                                                    disabled={isLoadingFile}
                                                >
                                                    <PencilIcon size={13} />
                                                </Button>
                                            </SimpleTooltip>
                                        )}
                                    </span>
                                    <div className="flex shrink-0 items-center gap-2">
                                        {isMarkdownFile(selectedFile) && !isRenamingInline && (
                                            <MarkdownViewToggle mode={mdViewMode} onModeChange={setMdViewMode} />
                                        )}
                                        {!readOnly && isEditableFile(selectedFile) && (
                                            <span className="text-xs text-text-secondary">{renderSaveStatus()}</span>
                                        )}
                                        {!readOnly && !isSelectedFileProtected && !isRenamingInline && (
                                            <SimpleTooltip content="Delete File">
                                                <Button
                                                    variant="ghost"
                                                    size="icon-xs"
                                                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                    onClick={handleDeleteSelectedFileClick}
                                                    disabled={isLoadingFile}
                                                >
                                                    <Trash2Icon size={13} />
                                                </Button>
                                            </SimpleTooltip>
                                        )}
                                    </div>
                                </div>
                                {/* Editor fills remaining height */}
                                <div className="file-editor flex min-h-0 flex-1 flex-col overflow-hidden p-4">
                                    <SkillFileEditor
                                        selectedFile={selectedFile}
                                        isLoadingFile={isLoadingFile}
                                        fileContent={fileContent}
                                        onContentChange={handleContentChange}
                                        readOnly={readOnly}
                                        mdViewMode={mdViewMode}
                                    />
                                </div>
                            </>
                        ) : (
                            <div className="flex h-full flex-col items-center justify-center gap-1 text-sm text-text-secondary">
                                <span className="text-text-primary font-medium">Select a file to view or edit</span>
                                <span>Or drag and drop files here to upload</span>
                            </div>
                        )}
                    </div>
                </div>

                <ConfirmationModal
                    isOpen={deleteModalState.isOpen}
                    onClose={() => setDeleteModalState((prev) => ({ ...prev, isOpen: false }))}
                    title="Delete File"
                    message={`Are you sure you want to delete ${deleteModalState.path}? This action cannot be undone.`}
                    onConfirm={handleConfirmDelete}
                    confirmButtonText={isDeletingFile ? 'Deleting' : 'Delete'}
                    cancelButtonText="Cancel"
                    isButtonLoading={isDeletingFile}
                />

                {footerContent}
            </div>
        </Dropzone>
    );
};

export default SkillInstructions;
