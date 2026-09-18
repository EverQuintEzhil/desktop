import {
    FolderIcon,
    FileIcon,
    ChevronRightIcon,
    ChevronDownIcon,
    PencilIcon,
    Trash2Icon,
    Loader2Icon,
    CheckIcon,
    XIcon,
} from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import type { SkillFileListItem } from '../types';
import { getDisplayNameFromPath } from '../utils';

interface SkillFileTreeProps {
    items: SkillFileListItem[];
    depth: number;
    currentPath: string;
    selectedFile: string | null;
    expandedFolders: Set<string>;
    loadingFolders: Set<string>;
    isRootLoading: boolean;
    renamingListPath: string | null;
    isRenamingFile: boolean;
    isDeletingFile: boolean;
    onToggleFolder: (path: string) => void;
    onItemClick: (item: SkillFileListItem) => void;
    onRenameClick: (path: string, e: React.MouseEvent) => void;
    onDeleteClick: (path: string) => void;
    onRenameListValueChange?: (val: string) => void;
    onRenameListSave?: (path: string, isFolder: boolean) => void;
    onRenameListCancel?: () => void;
    getFolderItems: (folderPath: string) => SkillFileListItem[];
    // Adding inline
    addingInline?: { parentPath: string; mode: 'file' | 'folder' } | null;
    newFileName?: string;
    onNewFileNameChange?: (val: string) => void;
    onSaveAdd?: () => void;
    onCancelAdd?: () => void;
    isAddingFileOrFolder?: boolean;
    currentFolderPath?: string;
    readOnly?: boolean;
}

export const SkillFileTree: React.FC<SkillFileTreeProps> = ({
    items,
    depth,
    currentPath,
    selectedFile,
    expandedFolders,
    loadingFolders,
    isRootLoading,
    renamingListPath,
    isRenamingFile,
    isDeletingFile,
    onToggleFolder,
    onItemClick,
    onRenameClick,
    onDeleteClick,
    onRenameListValueChange,
    onRenameListSave,
    onRenameListCancel,
    getFolderItems,
    addingInline,
    newFileName,
    onNewFileNameChange,
    onSaveAdd,
    onCancelAdd,
    isAddingFileOrFolder,
    currentFolderPath = '',
    readOnly = false,
}) => {
    if (isRootLoading) {
        return (
            <div className="flex flex-col gap-0.5 px-4 py-1">
                {['w-3/4', 'w-1/2', 'w-2/3', 'w-5/6'].map((w) => (
                    <div key={w} className="flex items-center gap-2 px-2 py-1.5">
                        <Skeleton className="size-4 shrink-0 rounded-sm" />
                        <Skeleton className={`h-3 rounded ${w}`} />
                    </div>
                ))}
            </div>
        );
    }

    if (items.length === 0 && depth === 0) {
        return <div className="px-3 py-4 text-center text-xs text-text-secondary">No files yet</div>;
    }

    return (
        <>
            {items.map((item) => (
                <React.Fragment key={item.path}>
                    <SkillFileTreeRow
                        item={item}
                        depth={depth}
                        currentPath={currentPath}
                        selectedFile={selectedFile}
                        expandedFolders={expandedFolders}
                        loadingFolders={loadingFolders}
                        renamingListPath={renamingListPath}
                        isRenamingFile={isRenamingFile}
                        isDeletingFile={isDeletingFile}
                        onToggleFolder={onToggleFolder}
                        onItemClick={onItemClick}
                        onRenameClick={onRenameClick}
                        onDeleteClick={onDeleteClick || (() => {})}
                        onRenameListValueChange={onRenameListValueChange || (() => {})}
                        onRenameListSave={onRenameListSave || (() => {})}
                        onRenameListCancel={onRenameListCancel || (() => {})}
                        readOnly={readOnly}
                    />
                    {item.isFolder &&
                        expandedFolders.has(item.path) &&
                        (loadingFolders.has(item.path) && getFolderItems(item.path).length === 0 ? (
                            <div
                                className="flex items-center gap-2 py-1.5 pr-2 text-xs text-text-secondary"
                                style={{ paddingLeft: `${8 + (depth + 1) * 16}px` }}
                            >
                                <Loader2Icon size={12} className="shrink-0 animate-spin" />
                                Loading...
                            </div>
                        ) : (
                            <SkillFileTree
                                items={getFolderItems(item.path)}
                                depth={depth + 1}
                                currentPath={currentPath}
                                selectedFile={selectedFile}
                                expandedFolders={expandedFolders}
                                loadingFolders={loadingFolders}
                                isRootLoading={false}
                                renamingListPath={renamingListPath}
                                isRenamingFile={isRenamingFile}
                                isDeletingFile={isDeletingFile}
                                onToggleFolder={onToggleFolder}
                                onItemClick={onItemClick}
                                onRenameClick={onRenameClick}
                                onDeleteClick={onDeleteClick}
                                onRenameListValueChange={onRenameListValueChange}
                                onRenameListSave={onRenameListSave}
                                onRenameListCancel={onRenameListCancel}
                                getFolderItems={getFolderItems}
                                addingInline={addingInline}
                                newFileName={newFileName}
                                onNewFileNameChange={onNewFileNameChange}
                                onSaveAdd={onSaveAdd}
                                onCancelAdd={onCancelAdd}
                                isAddingFileOrFolder={isAddingFileOrFolder}
                                currentFolderPath={item.path}
                                readOnly={readOnly}
                            />
                        ))}
                </React.Fragment>
            ))}
            {addingInline?.parentPath === currentFolderPath && (
                <SkillFileTreeAddRow
                    depth={depth}
                    mode={addingInline.mode}
                    value={newFileName || ''}
                    onChange={onNewFileNameChange || (() => {})}
                    onSave={onSaveAdd || (() => {})}
                    onCancel={onCancelAdd || (() => {})}
                    isSaving={isAddingFileOrFolder || false}
                />
            )}
        </>
    );
};

const SkillFileTreeAddRow: React.FC<{
    depth: number;
    mode: 'file' | 'folder';
    value: string;
    onChange: (val: string) => void;
    onSave: () => void;
    onCancel: () => void;
    isSaving: boolean;
}> = ({ depth, mode, value, onChange, onSave, onCancel, isSaving }) => {
    const ItemIcon = mode === 'folder' ? FolderIcon : FileIcon;
    const itemIconClassName = mode === 'folder' ? 'text-primary/70 shrink-0' : 'text-text-secondary shrink-0';
    const indentStyle = { paddingLeft: `${8 + depth * 16}px` };

    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        if (inputRef.current && !isSaving) {
            inputRef.current.focus();
        }
    }, [isSaving]);

    return (
        <div className="skill-file-row flex w-full items-center gap-1" style={indentStyle}>
            <div className="flex w-4 shrink-0 justify-center">
                <span className="inline-block w-4" aria-hidden />
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-1 text-left text-[13px]">
                <ItemIcon size={14} className={itemIconClassName} />
                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    disabled={isSaving}
                    className="min-w-0 flex-1 rounded border border-primary/40 bg-transparent px-1 py-0 text-[13px] leading-none outline-none focus:border-primary/60"
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            onSave();
                        }
                        if (e.key === 'Escape') {
                            e.preventDefault();
                            onCancel();
                        }
                    }}
                    onBlur={() => {
                        if (value.trim()) onSave();
                        else onCancel();
                    }}
                />
            </div>
            <div className="flex items-center pr-1">
                {isSaving ? (
                    <Button
                        variant="ghost"
                        size="icon-xs"
                        className="shrink-0 cursor-default text-text-secondary"
                        disabled
                    >
                        <Loader2Icon size={13} className="animate-spin" />
                    </Button>
                ) : null}
            </div>
        </div>
    );
};

interface SkillFileTreeRowProps {
    item: SkillFileListItem;
    depth: number;
    currentPath: string;
    selectedFile: string | null;
    expandedFolders: Set<string>;
    loadingFolders: Set<string>;
    renamingListPath: string | null;
    isRenamingFile: boolean;
    isDeletingFile: boolean;
    onToggleFolder: (path: string) => void;
    onItemClick: (item: SkillFileListItem) => void;
    onRenameClick: (path: string, e: React.MouseEvent) => void;
    onDeleteClick: (path: string) => void;
    onRenameListValueChange: (val: string) => void;
    onRenameListSave: (path: string, isFolder: boolean) => void;
    onRenameListCancel: () => void;
    readOnly?: boolean;
}

const SkillFileTreeRow: React.FC<SkillFileTreeRowProps> = ({
    item,
    depth,
    currentPath,
    selectedFile,
    expandedFolders,
    loadingFolders,
    renamingListPath,
    isRenamingFile,
    isDeletingFile,
    onToggleFolder,
    onItemClick,
    onRenameClick,
    onDeleteClick,
    onRenameListValueChange,
    onRenameListSave,
    onRenameListCancel,
    readOnly = false,
}) => {
    const ItemIcon = item.isFolder ? FolderIcon : FileIcon;
    const itemIconClassName = item.isFolder ? 'text-primary/70 shrink-0' : 'text-text-secondary shrink-0';
    const isExpanded = expandedFolders.has(item.path);
    const isFolderLoading = loadingFolders.has(item.path);
    const indentStyle = { paddingLeft: `${8 + depth * 16}px` };

    const renameRef = React.useRef<HTMLSpanElement>(null);
    const isEditing = renamingListPath === item.path && !isRenamingFile;
    const [isConfirmingDelete, setIsConfirmingDelete] = React.useState(false);

    React.useEffect(() => {
        if (isEditing && renameRef.current) {
            renameRef.current.focus();
            const range = document.createRange();

            range.selectNodeContents(renameRef.current);
            const sel = window.getSelection();

            sel?.removeAllRanges();
            sel?.addRange(range);
        }
    }, [isEditing]);

    const getFileRowClassName = (f: SkillFileListItem) =>
        cn(
            'skill-file-row flex w-full cursor-pointer items-center gap-1',
            selectedFile === f.path && 'skill-file-row--selected',
        );

    const renderFolderChevron = () => {
        if (isFolderLoading) {
            return <Loader2Icon size={14} className="animate-spin" />;
        }
        if (isExpanded) {
            return <ChevronDownIcon size={14} />;
        }

        return <ChevronRightIcon size={14} />;
    };

    const renderActions = () => {
        if ((renamingListPath === item.path && isRenamingFile) || (isDeletingFile && isConfirmingDelete)) {
            return (
                <Button variant="ghost" size="icon-xs" className="shrink-0 cursor-default text-text-secondary" disabled>
                    <Loader2Icon size={13} className="animate-spin" />
                </Button>
            );
        }

        if (isConfirmingDelete) {
            return (
                <>
                    <SimpleTooltip content="Confirm Delete" className="z-9999">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="shrink-0 text-destructive! hover:bg-destructive/10"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDeleteClick(item.path);
                            }}
                            disabled={isDeletingFile}
                        >
                            <CheckIcon size={13} />
                        </Button>
                    </SimpleTooltip>
                    <SimpleTooltip content="Cancel" className="z-9999">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="hover:text-text-primary! shrink-0 text-text-secondary! hover:bg-muted"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsConfirmingDelete(false);
                            }}
                            disabled={isDeletingFile}
                        >
                            <XIcon size={13} />
                        </Button>
                    </SimpleTooltip>
                </>
            );
        }

        if (renamingListPath !== item.path) {
            return (
                <>
                    <SimpleTooltip content={`Rename ${item.isFolder ? 'Folder' : 'File'}`} className="z-9999">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="skill-file-action-button hover:text-text-primary shrink-0 text-text-secondary"
                            onClick={(e) => onRenameClick(item.path, e)}
                            aria-label={`Rename ${getDisplayNameFromPath(item.path)}`}
                        >
                            <PencilIcon size={13} />
                        </Button>
                    </SimpleTooltip>
                    <SimpleTooltip content={`Delete ${item.isFolder ? 'Folder' : 'File'}`} className="z-9999">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="skill-file-delete-button shrink-0 text-destructive hover:text-destructive"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsConfirmingDelete(true);
                            }}
                            disabled={isDeletingFile}
                            aria-label={`Delete ${getDisplayNameFromPath(item.path)}`}
                        >
                            <Trash2Icon size={13} />
                        </Button>
                    </SimpleTooltip>
                </>
            );
        }

        return null;
    };

    return (
        <div
            className={cn(
                getFileRowClassName(item),
                item.isFolder && currentPath === item.path && 'skill-file-row--context',
            )}
            style={indentStyle}
        >
            <div className="flex w-4 shrink-0 justify-center">
                {item.isFolder ? (
                    <button
                        type="button"
                        className={cn(
                            'rounded p-0.5 text-text-secondary',
                            'hover:text-text-primary hover:bg-muted',
                            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                        )}
                        aria-expanded={isExpanded}
                        aria-label={
                            isExpanded
                                ? `Collapse ${getDisplayNameFromPath(item.path)}`
                                : `Expand ${getDisplayNameFromPath(item.path)}`
                        }
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleFolder(item.path);
                        }}
                    >
                        {renderFolderChevron()}
                    </button>
                ) : (
                    <span className="inline-block w-4" aria-hidden />
                )}
            </div>
            <div
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-1.5 pr-1 text-left text-[13px]"
                onClick={(e) => {
                    if (renamingListPath === item.path) {
                        e.stopPropagation();
                    } else {
                        onItemClick(item);
                    }
                }}
            >
                <ItemIcon size={14} className={itemIconClassName} />
                <span
                    ref={renameRef}
                    className="truncate outline-none"
                    contentEditable={isEditing}
                    suppressContentEditableWarning
                    onInput={(e) => onRenameListValueChange(e.currentTarget.textContent || '')}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            onRenameListSave(item.path, item.isFolder);
                        }
                        if (e.key === 'Escape') {
                            e.preventDefault();
                            onRenameListCancel();
                        }
                    }}
                    onBlur={() => {
                        if (renamingListPath === item.path) {
                            onRenameListSave(item.path, item.isFolder);
                        }
                    }}
                >
                    {getDisplayNameFromPath(item.path)}
                </span>
            </div>
            {!readOnly && !item.isProtected && <div className="flex items-center pr-1">{renderActions()}</div>}
        </div>
    );
};
