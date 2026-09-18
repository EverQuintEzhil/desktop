import { FileThumb as SharedFileThumb, isImageFile } from '@/components/file-list';
import type { DataStoreFileRecord } from '@/lib/api/admin/data-stores';

export interface Props {
    record: DataStoreFileRecord;
}

const FileThumb = ({ record }: Props) => (
    <SharedFileThumb
        thumbnailUrl={record.thumbnail_url}
        extension={record.extension}
        fileName={record.name}
        isImage={isImageFile(record)}
    />
);

export default FileThumb;
