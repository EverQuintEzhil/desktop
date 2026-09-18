import React, { useEffect } from 'react';

import FilePreviewItem from '@/components/file-upload/file-preview-item';
import { useUploadFilesContext } from '@/context';
import type { FileType } from '@/types/chat';

interface Props {
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    retryUpload?: (tempId: string) => void;
}

const useUploadFileRenders = (props: Props) => {
    const { fileInputRef, retryUpload } = props;
    const { state: files, actions } = useUploadFilesContext();

    useEffect(() => {
        if (fileInputRef.current) {
            if (files.files.length > 0) {
                fileInputRef.current.title = `${files.files.length} file${files.files.length === 1 ? '' : 's'} selected`;
            } else {
                fileInputRef.current.title = '';
            }
        }
    }, [files.files.length]);

    const renderFile = (file: FileType) => <FilePreviewItem file={file} tone="light" onRetry={retryUpload} />;

    const renderFiles = (disableDeleteIcon?: boolean, groupName?: string) => {
        if (files.files.length === 0) {
            return null;
        }

        let filteredFiles = files.files;

        if (groupName) {
            filteredFiles = filteredFiles?.filter((file: FileType) => file?.groupName === groupName);
        }

        return (
            <div className="image-list scrollbar-controller scrollbar-vertical scrollbar-horizontal flex w-full items-center gap-2 pt-2">
                {filteredFiles.map((file: FileType, index: number) => (
                    <FilePreviewItem
                        key={file.tempId || file.name + index}
                        file={file}
                        tone="light"
                        disableRemove={disableDeleteIcon}
                        onRetry={retryUpload}
                        onRemove={() => {
                            actions.setFiles(files.files.filter((_: FileType, i: number) => i !== index));
                            if (fileInputRef.current) {
                                fileInputRef.current.value = '';
                            }
                        }}
                    />
                ))}
            </div>
        );
    };

    const renderIncomingFiles = (incomingFiles: FileType[], groupName?: string) => {
        if (incomingFiles.length === 0) {
            return null;
        }

        let filteredFiles = incomingFiles;

        if (groupName) {
            filteredFiles = incomingFiles?.filter((file) => file?.groupName === groupName);
        }

        return (
            <div className="image-list scrollbar-controller scrollbar-vertical scrollbar-horizontal flex w-full items-center gap-2 pt-2">
                {filteredFiles.map((file: FileType, index: number) => (
                    <FilePreviewItem
                        key={file.tempId || file.name + index}
                        file={file}
                        tone="light"
                        onRetry={retryUpload}
                        onRemove={() => {
                            actions.setFiles(incomingFiles.filter((_, i) => i !== index));
                            if (fileInputRef.current) {
                                fileInputRef.current.value = '';
                            }
                        }}
                    />
                ))}
            </div>
        );
    };

    return {
        renderFile,
        renderFiles,
        renderIncomingFiles,
    };
};

export default useUploadFileRenders;
