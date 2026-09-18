import type { LibraryItem } from '@/components/agent-chat/hooks/use-media-library';
import { FilePreviewActions, FilePreviewDetails, formatFileDate, formatFileSize } from '@/components/file-list';
import LibraryPreviewContent from '@/components/file-list/library-preview-content';
import FilePreviewLightbox from '@/components/file-preview-lightbox';
import type { DataStoreFileRecord } from '@/lib/api/admin/data-stores';

import { getPreviewType } from '../utils/preview';

export interface Props {
    file: DataStoreFileRecord;
    canUserEdit: boolean;
    isDownloading: boolean;
    onDownload: (record: DataStoreFileRecord) => void;
    onClose: () => void;
    onDeleteRequest: (record: DataStoreFileRecord) => void;
}

const renderPreviewDetails = (record: DataStoreFileRecord) => {
    const chips = [formatFileSize(record.meta?.size), formatFileDate(record.created_at)].filter(Boolean);

    return <FilePreviewDetails chips={chips} />;
};

const FilePreviewModal = ({ file, canUserEdit, isDownloading, onDownload, onClose, onDeleteRequest }: Props) => (
    <FilePreviewLightbox
        src={file.url}
        alt={file.name}
        title={file.name}
        isOpen
        type={getPreviewType(file)}
        details={renderPreviewDetails(file)}
        actions={
            <FilePreviewActions
                onOpenInNewTab={() => window.open(file.url, '_blank', 'noopener')}
                canDelete={canUserEdit}
                onDelete={() => onDeleteRequest(file)}
            />
        }
        onDownload={() => onDownload(file)}
        isDownloading={isDownloading}
        onClose={onClose}
    >
        {/* No children for video: LibraryPreviewContent has no video branch and would fetch the
            binary as text, while the lightbox only falls back to its own player without children. */}
        {getPreviewType(file) === 'video' ? null : <LibraryPreviewContent item={file as unknown as LibraryItem} />}
    </FilePreviewLightbox>
);

export default FilePreviewModal;
