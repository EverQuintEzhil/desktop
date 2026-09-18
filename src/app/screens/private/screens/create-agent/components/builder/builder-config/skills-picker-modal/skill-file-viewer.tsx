import CodeMirror from '@uiw/react-codemirror';
import {
    ChevronDownIcon,
    FileIcon,
    Loader2Icon,
    UploadIcon,
    FolderPlusIcon,
    FilePlusIcon,
    Trash2Icon,
    PencilIcon,
    FileXIcon,
} from 'lucide-react';
import React, { useRef, useEffect } from 'react';

import { FrontmatterSafeEditor } from '@/admin/screens/private/screens/admin/components/skills/components/skill-detail/components/skill-instructions/components/frontmatter-safe-editor';
import { SkillFileTree } from '@/admin/screens/private/screens/admin/components/skills/components/skill-detail/components/skill-instructions/components/skill-file-tree';
import { useSkillFiles } from '@/admin/screens/private/screens/admin/components/skills/components/skill-detail/components/skill-instructions/hooks/use-skill-files';
import type { SkillFileListItem } from '@/admin/screens/private/screens/admin/components/skills/components/skill-detail/components/skill-instructions/types';
import {
    isCodeFile,
    isEditableFile,
    isMarkdownFile,
    stripFrontmatter,
} from '@/admin/screens/private/screens/admin/components/skills/components/skill-detail/components/skill-instructions/utils';
import Markdown from '@/components/markdown/markdown';
import { MarkdownViewToggle, type MarkdownViewMode } from '@/components/markdown/markdown-view-toggle';
import { Button } from '@/components/ui/button';
import ConfirmationModal from '@/components/ui/confirmation-modal';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { cn } from '@/lib/utils';

interface SkillFileViewerProps {
    skill: { _id: string };
    readOnly?: boolean;
}

export const SkillFileViewer: React.FC<SkillFileViewerProps> = ({ skill, readOnly = false }) => {
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
        isFolderFilesError,
        folderFilesError,
        isLoadingRoot,
    } = useSkillFiles(skill);

    const [isExplorerOpen, setIsExplorerOpen] = React.useState(false);
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
        if (!selectedFile || isSelectedFileProtected) return;
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
        setIsExplorerOpen(false);
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
                <span className="flex w-16 items-center justify-end gap-1 text-right text-[11px] text-muted-foreground transition-opacity duration-150">
                    <Loader2Icon size={12} className="animate-spin" />
                    Saving
                </span>
            );
        }
        if (isDirty) {
            return (
                <span className="flex w-16 items-center justify-end gap-1 text-right text-[11px] text-muted-foreground transition-opacity duration-150">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    Unsaved
                </span>
            );
        }

        return (
            <span className="flex w-16 justify-end text-right text-[11px] text-muted-foreground transition-opacity duration-150">
                Saved
            </span>
        );
    };

    const getDisplayFileName = () => {
        if (!selectedFile) return isRenamingInline ? '' : 'Select a file...';

        return selectedFile.split('/').pop() || selectedFile;
    };

    const renderFileContent = () => {
        if (!selectedFile) return null;
        if (isMarkdownFile(selectedFile)) {
            if (readOnly && mdViewMode === 'code') {
                return (
                    <div className="ca-instr-editor-file scrollbar-controller scrollbar-vertical h-full min-h-0 flex-1 overflow-hidden bg-card">
                        <CodeMirror
                            value={fileContent}
                            theme="light"
                            editable={false}
                            basicSetup={{ lineNumbers: true }}
                            height="100%"
                            className="h-full"
                        />
                    </div>
                );
            }

            // Read-only rendered view: static Markdown renderer (frontmatter stripped). The TipTap
            // editor is reserved for editing, since its markdown round-trip is lossy for frontmatter.
            if (readOnly) {
                const renderedContent = stripFrontmatter(fileContent);

                return (
                    <div className="scrollbar-controller scrollbar-vertical h-full min-h-0 flex-1 overflow-hidden bg-card p-6">
                        <div className="mx-auto max-w-6xl">
                            {renderedContent.trim() ? (
                                <Markdown>{renderedContent}</Markdown>
                            ) : (
                                <div className="py-2 text-sm text-muted-foreground italic">This file is empty.</div>
                            )}
                        </div>
                    </div>
                );
            }

            return (
                <div className="h-full min-h-0 flex-1 overflow-hidden">
                    <FrontmatterSafeEditor
                        value={fileContent}
                        onChange={handleContentChange}
                        placeholder="Write markdown..."
                        enableMentions={false}
                        readOnly={isLoadingFile}
                        className="h-full"
                        contentClassName="h-full"
                        editorClassName="ca-instr-editor-file scrollbar-controller scrollbar-vertical"
                    />
                </div>
            );
        }
        if (isCodeFile(selectedFile)) {
            return (
                <div className="ca-instr-editor-file scrollbar-controller scrollbar-vertical h-full min-h-0 flex-1 overflow-hidden">
                    <CodeMirror
                        value={fileContent}
                        theme="light"
                        readOnly={isLoadingFile || readOnly}
                        onChange={handleContentChange}
                        basicSetup={{ lineNumbers: true }}
                        height="100%"
                        className="h-full"
                    />
                </div>
            );
        }

        return (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                <FileIcon className="size-8 opacity-50" />
                <p className="text-sm">Cannot preview this file type directly.</p>
            </div>
        );
    };

    if (isFolderFilesError) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-4 rounded-xl border bg-card p-6 text-center">
                <div className="bg-danger/10 flex size-12 items-center justify-center rounded-full">
                    <FileXIcon className="size-6 text-(--danger)" />
                </div>
                <div className="flex flex-col gap-1">
                    <p className="text-base font-semibold text-foreground">Failed to load skill files</p>
                    <p className="max-w-[300px] text-sm text-muted-foreground">
                        {folderFilesError?.message || 'An unexpected error occurred while fetching the files.'}
                    </p>
                </div>
            </div>
        );
    }

    if (isLoadingRoot) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border bg-card p-6 text-center">
                <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">Loading skill files...</p>
            </div>
        );
    }

    return (
        <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
            {/* Action Bar (hidden inputs) */}
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileChange}
                disabled={isUploadingFile}
            />

            {/* File header with Popover Explorer */}
            <div className="file-header flex h-[41px] shrink-0 items-center justify-between gap-2 border-b border-border-secondary bg-card px-4 py-2">
                <Popover open={isExplorerOpen} onOpenChange={setIsExplorerOpen} modal={true}>
                    <PopoverTrigger asChild>
                        <button
                            type="button"
                            className={cn(
                                'text-text-primary flex min-w-0 items-center gap-1.5 text-sm font-medium hover:bg-muted',
                                'cursor-pointer rounded-md px-2 py-1 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            )}
                        >
                            <FileIcon size={14} className="shrink-0 text-text-secondary" />
                            <span
                                ref={inlineRenameRef}
                                contentEditable={isRenamingInline}
                                suppressContentEditableWarning
                                className="max-w-[200px] truncate outline-none"
                                onClick={(e) => {
                                    if (isRenamingInline) {
                                        e.stopPropagation();
                                        e.preventDefault();
                                    }
                                }}
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
                                {getDisplayFileName()}
                            </span>
                            {!isRenamingInline && (
                                <ChevronDownIcon size={14} className="ml-0.5 shrink-0 text-text-secondary opacity-70" />
                            )}
                        </button>
                    </PopoverTrigger>

                    <PopoverContent
                        align="start"
                        className="flex h-[400px] w-xs flex-col overflow-hidden rounded-xl border border-border-secondary p-0 shadow-lg"
                    >
                        <div className="flex min-h-[41px] shrink-0 items-center justify-between border-b border-border-secondary bg-muted/20 px-3 py-2">
                            <span className="text-[12px] font-medium tracking-wide text-text-secondary uppercase">
                                Explorer
                            </span>
                            {!readOnly && (
                                <div className="flex items-center gap-1">
                                    <SimpleTooltip content="Upload File" className="z-9999">
                                        <Button
                                            variant="ghost"
                                            size="icon-xs"
                                            onClick={handleUploadFile}
                                            disabled={isUploadingFile}
                                        >
                                            {isUploadingFile ? (
                                                <Loader2Icon size={14} className="animate-spin" />
                                            ) : (
                                                <UploadIcon size={14} />
                                            )}
                                        </Button>
                                    </SimpleTooltip>
                                    <SimpleTooltip content="Add Folder" className="z-9999">
                                        <Button variant="ghost" size="icon-xs" onClick={handleAddFolder}>
                                            <FolderPlusIcon size={14} />
                                        </Button>
                                    </SimpleTooltip>
                                    <SimpleTooltip content="Add File" className="z-9999">
                                        <Button variant="ghost" size="icon-xs" onClick={handleAddFile}>
                                            <FilePlusIcon size={14} />
                                        </Button>
                                    </SimpleTooltip>
                                </div>
                            )}
                        </div>
                        <div
                            className="scrollbar-controller scrollbar-vertical flex-1 py-2"
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
                    </PopoverContent>
                </Popover>

                <div className="flex shrink-0 items-center gap-2">
                    {readOnly && selectedFile && isMarkdownFile(selectedFile) && (
                        <MarkdownViewToggle mode={mdViewMode} onModeChange={setMdViewMode} />
                    )}
                    {!readOnly && selectedFile && isEditableFile(selectedFile) && renderSaveStatus()}
                    {!readOnly && selectedFile && !isSelectedFileProtected && !isRenamingInline && (
                        <>
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
                        </>
                    )}
                </div>
            </div>

            {/* Main File Viewer/Editor Area */}
            {selectedFile ? (
                <div className="relative min-h-0 flex-1 overflow-hidden">
                    {isLoadingFile && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50">
                            <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
                        </div>
                    )}
                    {renderFileContent()}
                </div>
            ) : (
                <div className="flex min-h-0 flex-1 items-center justify-center">
                    <p className="text-sm text-muted-foreground">
                        {readOnly ? 'Select a file to view' : 'Select a file to view or edit'}
                    </p>
                </div>
            )}

            {/* Modals */}
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
        </div>
    );
};
