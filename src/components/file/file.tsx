import {
    CloudUploadIcon,
    SquarePenIcon,
    FileArchiveIcon,
    FileHeadphoneIcon,
    FileIcon,
    ImageIcon,
    LoaderCircleIcon,
    PencilIcon,
    type LucideIcon,
    PresentationIcon,
    FileSpreadsheetIcon,
    FileTextIcon,
    FilePlayIcon,
    XIcon,
} from 'lucide-react';
import React, { useState, useEffect, useRef, useImperativeHandle } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { acceptValidFiles, acceptValidFilesFromInput } from '@/utils';

import Avatar from '../ui/avatar';

import './file.scss';

export type FileProps = {
    accept: string;
    disabled?: boolean;
    id?: string;
    name?: string;
    onChange?: (url: File) => void;
    styles?: string;
    thumbnail?: string;
    uploading?: boolean;
    isErrored?: boolean;
    ref?: React.Ref<FileRef>;
};

export interface FileRef {
    element: HTMLImageElement | null;
}

const File: React.FC<FileProps> = (props) => {
    const {
        accept,
        disabled = false,
        id = 'file',
        name = 'file',
        onChange: onChangeProp,
        thumbnail: thumbnailProp = '',
        uploading,
        isErrored,
        ref,
    } = props;

    const [thumbnail, setThumbnail] = useState(thumbnailProp || '');
    const imageRef = useRef<HTMLImageElement>(null);

    useImperativeHandle(ref as React.Ref<FileRef>, () => ({
        element: imageRef.current,
    }));

    const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.persist();
        // Re-validate file type (extension + MIME); toasts + resets input on rejection.
        const [file] = acceptValidFilesFromInput(e);

        if (file) {
            setThumbnail(URL.createObjectURL(file));
            onChangeProp?.(file);
        }
    };

    useEffect(() => {
        if (thumbnail && imageRef.current) {
            imageRef.current.src = '';
            imageRef.current.src = thumbnail;
        }
    }, [thumbnail]);

    const isDisabled = () => {
        if (uploading || disabled) {
            return true;
        }

        return false;
    };

    const renderAvatarThumbnail = () => {
        if (!thumbnail) {
            return null;
        }

        return (
            <Avatar
                src={thumbnail}
                alt=""
                srcSet=""
                ref={imageRef}
                className={cn('pointer-events-none absolute inset-0 z-0 size-full! shrink-0 rounded-full')}
            />
        );
    };

    return (
        <div className={cn('avatar-label-wrapper', isErrored ? 'has-error' : '')}>
            <label
                className={cn(
                    'avatar-label file-avatar rounded-full',
                    !thumbnail ? 'flex items-end justify-end' : 'relative block',
                    uploading ? 'uploading-file' : '',
                    isDisabled() ? 'disabled' : '',
                )}
                htmlFor={id}
            >
                {renderAvatarThumbnail()}
                <Button size="icon-sm" variant="default" className="rounded-full" disabled={disabled}>
                    <SquarePenIcon />
                </Button>
                {!thumbnail ? <ImageIcon className="size-4" /> : null}
                <input
                    onChange={(e) => onChange(e)}
                    type="file"
                    id={id}
                    disabled={disabled}
                    name={name}
                    accept={accept}
                    className="file-input"
                />
            </label>
        </div>
    );
};

File.displayName = '@dls/File';
export default File;

export type FileUploadProps = {
    accept?: string;
    disabled?: boolean;
    id?: string;
    name?: string;
    onChange?: (file: File) => void;
    onRemove?: () => void;
    fileName?: string;
    uploading?: boolean;
    isErrored?: boolean;
    hint?: string;
    multiple?: boolean;
    isEditMode?: boolean;
    initialFileUrl?: string;
};

const getFileIcon = (file: File): LucideIcon => {
    const { type } = file;

    if (type.includes('pdf')) return FileTextIcon;
    if (type.includes('word') || type.includes('document')) return FileTextIcon;
    if (type.includes('excel') || type.includes('spreadsheet')) return FileSpreadsheetIcon;
    if (type.includes('powerpoint') || type.includes('presentation')) return PresentationIcon;
    if (type.startsWith('audio/')) return FileHeadphoneIcon;
    if (type.startsWith('video/')) return FilePlayIcon;
    if (type.includes('zip') || type.includes('compressed') || type.includes('archive')) return FileArchiveIcon;

    return FileIcon;
};

const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;

    return `${(bytes / 1_048_576).toFixed(1)} MB`;
};

const isImageUrl = (url: string): boolean => /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?.*)?$/i.test(url);

const getFilenameFromUrl = (url: string): string => {
    try {
        const path = new URL(url).pathname;

        return path.split('/').pop() || url;
    } catch {
        return url.split('/').pop() || url;
    }
};

export const FileUpload = (props: FileUploadProps) => {
    const {
        accept,
        disabled = false,
        id = 'file-upload',
        name = 'file-upload',
        onChange: onChangeProp,
        onRemove,
        fileName: fileNameProp = '',
        uploading = false,
        isErrored = false,
        hint,
        multiple = false,
        isEditMode = false,
        initialFileUrl = '',
    } = props;

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [preview, setPreview] = useState('');
    const [hostedUrl, setHostedUrl] = useState(initialFileUrl);
    const [isDragging, setIsDragging] = useState(false);
    const dragCounter = useRef(0);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditMode) setHostedUrl(initialFileUrl);
    }, [initialFileUrl, isEditMode]);

    const handleFile = (file: File) => {
        setSelectedFile(file);
        setPreview(file.type.startsWith('image/') ? URL.createObjectURL(file) : '');
        onChangeProp?.(file);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Re-validate file type (extension + MIME); toasts + resets input on rejection.
        const [file] = acceptValidFilesFromInput(e);

        if (file) handleFile(file);
    };

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        dragCounter.current += 1;
        if (!disabled && !uploading) setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        dragCounter.current -= 1;
        if (dragCounter.current === 0) setIsDragging(false);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        dragCounter.current = 0;
        setIsDragging(false);
        if (disabled || uploading) return;

        const [file] = acceptValidFiles(e.dataTransfer.files, accept);

        if (file) handleFile(file);
    };

    const handleRemove = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setSelectedFile(null);
        setPreview('');
        setHostedUrl('');
        if (inputRef.current) inputRef.current.value = '';
        onRemove?.();
    };

    const openPicker = () => {
        if (!disabled && !uploading) inputRef.current?.click();
    };

    const displayName = selectedFile?.name || fileNameProp || (hostedUrl ? getFilenameFromUrl(hostedUrl) : '');
    const activePreview = preview || (hostedUrl && isImageUrl(hostedUrl) ? hostedUrl : '');
    const hasFile = !!displayName || !!hostedUrl;
    const isDisabled = disabled || uploading;

    const renderContent = () => {
        if (uploading) {
            return (
                <div className="flex flex-col items-center justify-center gap-2 py-8">
                    <LoaderCircleIcon className="file-upload-spinner size-4 animate-spin" />
                    <span className="file-upload-hint-text">Uploading…</span>
                </div>
            );
        }

        if (hasFile) {
            const FileType = selectedFile ? getFileIcon(selectedFile) : FileIcon;

            return (
                <div className="file-upload-selected flex items-center gap-3 px-4 py-3">
                    {activePreview ? (
                        <img src={activePreview} alt={displayName} className="file-upload-preview" />
                    ) : (
                        <FileType className="file-upload-file-icon" />
                    )}
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="file-upload-name">{displayName}</span>
                        {selectedFile && <span className="file-upload-size">{formatBytes(selectedFile.size)}</span>}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                        <Button size="icon-sm" variant="ghost" type="button" disabled={disabled} onClick={openPicker}>
                            <PencilIcon />
                        </Button>
                        <Button size="icon-sm" variant="ghost" type="button" disabled={disabled} onClick={handleRemove}>
                            <XIcon />
                        </Button>
                    </div>
                </div>
            );
        }

        return (
            <button
                type="button"
                className="file-upload-empty flex w-full flex-col items-center justify-center gap-2 py-8"
                onClick={openPicker}
                disabled={isDisabled}
            >
                <CloudUploadIcon className="file-upload-icon size-4" />
                <div className="flex flex-col items-center gap-1">
                    <span className="file-upload-label">
                        {'Drag & drop or '}
                        <span className="file-upload-browse">browse</span>
                    </span>
                    {(hint || accept) && <span className="file-upload-hint-text">{hint || accept}</span>}
                </div>
            </button>
        );
    };

    return (
        <div
            className={cn(
                'file-upload-zone',
                isDragging && 'is-dragging',
                isErrored && 'has-error',
                isDisabled && 'is-disabled',
                hasFile && 'has-file',
            )}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            <input
                ref={inputRef}
                type="file"
                id={id}
                name={name}
                accept={accept}
                multiple={multiple}
                disabled={isDisabled}
                onChange={handleChange}
                className="file-upload-input"
            />
            {renderContent()}
        </div>
    );
};

FileUpload.displayName = '@dls/FileUpload';
