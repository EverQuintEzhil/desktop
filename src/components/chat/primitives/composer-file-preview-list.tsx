import { useCallback, useEffect, useState } from 'react';

import {
    extensionOf,
    isImageFile,
    isPreviewableFile,
    isVideoFile,
    type SharedFileItem,
} from '@/components/file-list/file-list-utils';
import FilePreviewLightbox from '@/components/file-preview-lightbox';
import FilePreviewItem from '@/components/file-upload/file-preview-item';
import type { FileType } from '@/types/chat';

import FilePreviewDialog from './file-preview-dialog';
import { useChatFileDownload } from './use-chat-file-download';

interface Props {
    files: FileType[];
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    onRemove: (index: number) => void;
    onRetry?: (tempId: string) => void;
}

const getFileKey = (file: FileType, index: number): string => file.tempId || file._id || `${file.name}-${index}`;

// Chat attachments never carry an `extension` (use-chat-files does not set one), so derive it from
// the name the way the file-list predicates already do — CodeMirror language selection reads it.
const toSharedFileItem = (file: FileType): SharedFileItem => ({
    extension: extensionOf(file),
    name: file.name,
    type: file.type,
    url: file.url,
});

// Image chips open the lightbox instead of the dialog; the remaining accepted types are the ones
// LibraryPreviewContent can render (videos have no branch there). A staged file may carry no url
// at all (create-agent uploads on submit), and while uploading the url is a `blob:` one that axios
// resolves against the API base rather than fetching — FilePreviewItem gates that second case on
// `isUploading`.
const isImageAttachment = (file: FileType): boolean => isImageFile(toSharedFileItem(file));

const isPreviewableAttachment = (file: FileType): boolean => {
    if (!file.url) return false;

    const item = toSharedFileItem(file);

    return isImageFile(item) || (isPreviewableFile(item) && !isVideoFile(item));
};

const ComposerFilePreviewList = ({ files, fileInputRef, onRemove, onRetry }: Props) => {
    const [previewKey, setPreviewKey] = useState<string | null>(null);
    const { download, isDownloading } = useChatFileDownload({ allowMissingHost: true });

    const previewFile = files.find((file, index) => getFileKey(file, index) === previewKey) ?? null;
    const hasPreviewFile = previewFile !== null;

    const closePreview = useCallback(() => {
        setPreviewKey(null);
    }, []);

    useEffect(() => {
        if (!fileInputRef.current) return;
        fileInputRef.current.title =
            files.length > 0 ? `${files.length} file${files.length === 1 ? '' : 's'} selected` : '';
    }, [files.length, fileInputRef]);

    // A removed or replaced attachment must close the dialog through Radix rather than have it
    // unmounted underneath, which skips the exit transition and the body scroll-lock release.
    useEffect(() => {
        if (previewKey && !hasPreviewFile) closePreview();
    }, [previewKey, hasPreviewFile, closePreview]);

    const openPreview = (fileKey: string) => {
        setPreviewKey(fileKey);
    };

    const renderPreview = () => {
        if (!previewFile) return null;

        if (isImageAttachment(previewFile)) {
            return <FilePreviewLightbox src={previewFile.url} alt={previewFile.name} isOpen onClose={closePreview} />;
        }

        return (
            <FilePreviewDialog
                item={toSharedFileItem(previewFile)}
                name={previewFile.name}
                isOpen
                onClose={closePreview}
                onDownload={() => {
                    void download(previewFile.url, previewFile.name);
                }}
                isDownloading={isDownloading}
            />
        );
    };

    const renderFileList = () => {
        if (files.length === 0) return null;

        return (
            <div className="image-list scrollbar-horizontal scrollbar-controller flex w-full items-center gap-2 pt-2">
                {files.map((file, index) => {
                    const fileKey = getFileKey(file, index);

                    return (
                        <FilePreviewItem
                            key={fileKey}
                            file={file}
                            tone="dark"
                            onRemove={() => {
                                onRemove(index);
                                if (fileInputRef.current) {
                                    fileInputRef.current.value = '';
                                }
                            }}
                            onRetry={onRetry}
                            onPreview={isPreviewableAttachment(file) ? () => openPreview(fileKey) : undefined}
                        />
                    );
                })}
            </div>
        );
    };

    return (
        <>
            {renderFileList()}
            {renderPreview()}
        </>
    );
};

export default ComposerFilePreviewList;
