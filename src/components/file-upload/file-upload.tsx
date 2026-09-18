import {
    FileArchiveIcon,
    FileCodeIcon,
    FileIcon,
    FileSpreadsheetIcon,
    FileTextIcon,
    FilePlayIcon,
    type LucideIcon,
    PanelTopIcon,
    XIcon,
} from 'lucide-react';
import React, { useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress';
import { useUploadFilesContext } from '@/context';
import useDidUpdate from '@/hooks/use-did-update';
import useUploadFiles from '@/hooks/use-upload-files';
import type { FileType } from '@/types/admin';

import { Dropzone, Image } from '../../components';

import './file-upload.scss';

interface Props {
    name: string;
    label: string;
    accept: string;
    initialFiles?: FileType[];
    multiple?: boolean;
    required?: boolean;
    disableDeleteIcon?: boolean;
    disabled?: boolean;
    tagToField?: string;
    tagToId?: string;
    handleFilesChange?: (name: string, files: FileType[]) => void;
    handleIsUploading?: (name: string, isUploading: boolean) => void;
    onUploadComplete?: (name: string, files: FileType[]) => void;
    onRemoveFiles?: (name: string, files: FileType[], removedFile: FileType) => void;
    renderHeading?: () => React.ReactNode;
}

const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getFileIconName = (fileName?: string): LucideIcon => {
    if (!fileName) return FileIcon;

    const ext = fileName.split('.').pop()?.toLowerCase();

    const mapping: Record<string, LucideIcon> = {
        pdf: FileTextIcon,
        doc: FileTextIcon,
        docx: FileTextIcon,
        xls: FileSpreadsheetIcon,
        xlsx: FileSpreadsheetIcon,
        csv: FileSpreadsheetIcon,
        ppt: PanelTopIcon,
        pptx: PanelTopIcon,
        zip: FileArchiveIcon,
        rar: FileArchiveIcon,
        '7z': FileArchiveIcon,
        tar: FileArchiveIcon,
        gz: FileArchiveIcon,
        mp3: FilePlayIcon,
        wav: FilePlayIcon,
        flac: FilePlayIcon,
        mp4: FilePlayIcon,
        mov: FilePlayIcon,
        avi: FilePlayIcon,
        mkv: FilePlayIcon,
        txt: FileTextIcon,
        md: FileTextIcon,
        json: FileCodeIcon,
        js: FileCodeIcon,
        ts: FileCodeIcon,
        jsx: FileCodeIcon,
        tsx: FileCodeIcon,
    };

    return mapping[ext || ''] || FileIcon;
};

const FileUpload = (props: Props) => {
    const {
        name,
        label,
        accept = '',
        required,
        disableDeleteIcon = false,
        multiple = false,
        initialFiles,
        disabled = false,
        tagToField,
        tagToId,
        handleFilesChange,
        handleIsUploading,
        onUploadComplete,
        onRemoveFiles,
        renderHeading,
    } = props;

    const fileInputRef = useRef<HTMLInputElement>(null);
    const hasInitializedInitialFilesRef = useRef<boolean>(false);

    const { state: uploadedFiles, actions } = useUploadFilesContext();
    const { onChangeFile } = useUploadFiles();

    useEffect(() => {
        if (fileInputRef.current) {
            if (uploadedFiles.files.length > 0) {
                fileInputRef.current.title = `${uploadedFiles.files.length} file${uploadedFiles.files.length === 1 ? '' : 's'} selected`;
            } else {
                fileInputRef.current.title = '';
            }
        }
    }, [uploadedFiles.files.length]);

    useEffect(() => {
        if (hasInitializedInitialFilesRef.current) return;
        if (!initialFiles || initialFiles.length === 0) return;

        const normalizedInitialFiles = initialFiles.map((file) => ({
            ...file,
            groupName: file.groupName || name,
            isUploading: false,
            uploadProgress: file.uploadProgress ?? 100,
        }));

        actions.setFiles(normalizedInitialFiles);
        hasInitializedInitialFilesRef.current = true;
    }, [actions.setFiles, initialFiles, name]);

    useDidUpdate(() => {
        handleFilesChange?.(name, uploadedFiles.files);
    }, [uploadedFiles.files]);

    useDidUpdate(() => {
        handleIsUploading?.(name, uploadedFiles.isUploading);
    }, [uploadedFiles.isUploading]);

    useDidUpdate(() => {
        if (!onUploadComplete) return;

        const hasPendingUploads = uploadedFiles.files.some((file: FileType) => file.isUploading);

        if (!uploadedFiles.isUploading && uploadedFiles.files.length > 0 && !hasPendingUploads) {
            onUploadComplete(name, uploadedFiles.files);
        }
    }, [uploadedFiles.isUploading]);

    const removeFile = (index: number) => {
        const newFiles = uploadedFiles.files.filter((_: FileType, i: number) => i !== index);

        actions.setFiles(newFiles);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }

        onRemoveFiles?.(name, newFiles, uploadedFiles.files[index]);
    };

    const renderHeadingContent = () => {
        if (renderHeading) {
            return renderHeading();
        }

        return (
            <div className="flex items-center justify-between">
                <div className="section-title flex items-center gap-2">
                    {label}
                    {required && <span className="text-xs text-destructive">*</span>}
                </div>
            </div>
        );
    };

    return (
        <div>
            <div className="file-upload-section flex flex-col gap-4">
                {renderHeadingContent()}
                <Dropzone
                    inputRef={fileInputRef}
                    accept={accept}
                    multiple={multiple}
                    onChange={(e) => onChangeFile(e, name, tagToField, tagToId)}
                    disabled={disabled}
                    uploading={uploadedFiles.isUploading}
                    progress={Math.min(...uploadedFiles.files.map((file: FileType) => file.uploadProgress ?? 0))}
                    label={`Drag and drop file${multiple ? 's' : ''} here or click to upload`}
                />
            </div>
            {uploadedFiles.files.length > 0 && (
                <div className="file-uploaded mt-4 flex flex-col gap-1">
                    <span className="text-sm">
                        {multiple ? `Uploaded Files (${uploadedFiles.files.length})` : 'Uploaded File'}
                    </span>
                    <ul className="file-list flex flex-col gap-3">
                        {uploadedFiles.files.map((file: FileType, index: number) => (
                            <li
                                key={file._id ?? `${file.name}-${index}`}
                                className="file-item flex items-start justify-between gap-2"
                            >
                                <div className="file-details flex w-full max-w-[calc(100%-36px)] items-center gap-1">
                                    {(() => {
                                        const FileType = getFileIconName(file.name);

                                        return file.type?.toLowerCase() === 'image' && file.url ? (
                                            <Image
                                                src={file.url}
                                                alt={file.name}
                                                className="h-12 w-12 rounded-md object-cover"
                                            />
                                        ) : (
                                            <FileType />
                                        );
                                    })()}
                                    {file.name && <span className="text-sm">{file.name}</span>}

                                    {file.size && <span className="text-sm">{formatFileSize(file.size || 0)}</span>}
                                    {((typeof file.uploadProgress === 'number' && file.uploadProgress !== 100) ||
                                        file.isUploading ||
                                        file.uploadError) && (
                                        <div className="file-progress mt-1 flex w-full flex-col gap-1">
                                            <span className="text-sm">
                                                {file.uploadError && 'Upload failed'}
                                                {!file.uploadError && file.isUploading
                                                    ? `Uploading ${file.uploadProgress ?? 0}%`
                                                    : 'Uploaded'}
                                            </span>
                                            <ProgressBar value={`${file.uploadProgress ?? 0}%`} />
                                        </div>
                                    )}
                                </div>
                                <Button
                                    size="icon-xs"
                                    variant="ghost"
                                    className="rounded-full"
                                    disabled={disableDeleteIcon}
                                    onClick={() => removeFile(index)}
                                >
                                    <XIcon />
                                </Button>
                            </li>
                        ))}
                    </ul>
                    {multiple && (
                        <div className="send-button-section send-button flex items-center justify-end gap-3">
                            {uploadedFiles.files.length > 0 && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        actions.setFiles([]);
                                        if (fileInputRef.current) {
                                            fileInputRef.current.value = '';
                                        }
                                    }}
                                >
                                    Clear All Files
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default FileUpload;
