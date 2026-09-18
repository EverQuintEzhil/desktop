import { FilePreviewActions, FilePreviewDetails, formatFileDate, formatFileSize } from '@/components/file-list';
import LibraryPreviewContent from '@/components/file-list/library-preview-content';
import FilePreviewLightbox from '@/components/file-preview-lightbox';

import { fileMeta, useLibraryDownload } from '../../library/file-preview';

import type { ConversationFile } from './conversation-file';

interface Props {
    file: ConversationFile | null;
    onClose: () => void;
    /** Mirrors ConversationFileRow: keep the preview's chips in step with the row that opened it. */
    showCreator?: boolean;
}

const ConversationFileLightbox = ({ file, onClose, showCreator = false }: Props) => {
    const { downloadFile, downloadingId } = useLibraryDownload();

    if (!file) return null;

    const chips = [
        fileMeta(file.extension).label,
        formatFileSize(file.size),
        formatFileDate(file.createdAt),
        showCreator ? file.creatorName : null,
    ].filter(Boolean) as string[];

    return (
        <FilePreviewLightbox
            src={file.url}
            alt={file.name}
            title={file.name}
            isOpen={Boolean(file)}
            type={file.previewType}
            details={<FilePreviewDetails chips={chips} />}
            actions={
                <FilePreviewActions
                    onOpenInNewTab={file.url ? () => window.open(file.url, '_blank', 'noopener') : undefined}
                    canDelete={false}
                />
            }
            onDownload={file.url ? () => downloadFile(file.item) : undefined}
            isDownloading={downloadingId === file.id}
            onClose={onClose}
        >
            {file.previewType === 'video' ? null : <LibraryPreviewContent item={file.item} />}
        </FilePreviewLightbox>
    );
};

export default ConversationFileLightbox;
