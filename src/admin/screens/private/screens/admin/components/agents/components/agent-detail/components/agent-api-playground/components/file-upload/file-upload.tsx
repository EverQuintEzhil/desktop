import { XIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { Dropzone } from '@/components';
import { Button } from '@/components/ui/button';
import { useUploadFilesContext } from '@/context';
import { useUploadFiles, useDidUpdate } from '@/hooks';

import type { FileType } from '../../agent-api-playground';

import './file-upload.scss';

interface Props {
    name: string;
    label: string;
    accept: string;
    multiple?: boolean;
    required?: boolean;
    disableDeleteIcon?: boolean;
    disabled?: boolean;
    handleFilesChange: (name: string, files: FileType[]) => void;
    handleIsUploading: (name: string, isUploading: boolean) => void;
}

// Helper function to format file size
const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const FileUpload = (props: Props) => {
    const {
        name,
        label,
        accept = '',
        required,
        disableDeleteIcon = false,
        multiple = false,
        disabled = false,
        handleFilesChange,
        handleIsUploading,
    } = props;

    const fileInputRef = useRef<HTMLInputElement>(null);

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

    useDidUpdate(() => {
        handleFilesChange(name, uploadedFiles.files);
    }, [uploadedFiles.files]);

    useDidUpdate(() => {
        handleIsUploading(name, uploadedFiles.isUploading);
    }, [uploadedFiles.isUploading]);

    const removeFile = (index: number) => {
        const newFiles = uploadedFiles.files.filter((_, i) => i !== index);

        actions.setFiles(newFiles);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div>
            <div className="file-upload-section flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div className="section-title flex items-center gap-2">
                        {label}
                        {required && <span className="text-xs text-destructive">*</span>}
                    </div>
                </div>
                {accept && <span className="text-sm">Acceptable File Types : {accept}</span>}
                <Dropzone
                    inputRef={fileInputRef}
                    accept={accept}
                    multiple={multiple}
                    onChange={(e) => onChangeFile(e, name)}
                    disabled={disabled}
                    uploading={uploadedFiles.isUploading}
                    label="Drag and drop files here or click to upload"
                />
            </div>
            {uploadedFiles.files.length > 0 && (
                <div className="file-uploaded mt-4 flex-col gap-4">
                    <span className="text-sm">Uploaded Files ({uploadedFiles.files.length})</span>
                    <ul className="file-list flex-col gap-3">
                        {uploadedFiles.files.map((file, index) => (
                            <li
                                key={file._id ?? `${file.name}-${index}`}
                                className="file-item flex items-center justify-between gap-2 px-4 py-3"
                            >
                                <div className="file-details flex flex-1 flex-col gap-1">
                                    <span className="text-sm">{file.name}</span>
                                    <span className="text-sm">{formatFileSize(file.size || 0)}</span>
                                </div>
                                <Button
                                    size="icon-sm"
                                    variant="outline"
                                    disabled={disableDeleteIcon}
                                    onClick={() => removeFile(index)}
                                >
                                    <XIcon />
                                </Button>
                            </li>
                        ))}
                    </ul>
                    <div className="send-button flex items-center justify-end gap-3">
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
                </div>
            )}
        </div>
    );
};

export default FileUpload;
