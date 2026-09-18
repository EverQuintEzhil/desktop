import { getDataStoreFileDownloadUrl } from '@/lib/axios';

import type { AdminDataStoreFile } from '../types';
import { isAdminDataStoreImageFile } from '../utils/file-type-helpers';

import { AttachmentFileItem } from './attachment-file-item';

export interface DataStoreFileItemProps {
    file: AdminDataStoreFile;
}

export const DataStoreFileItem = ({ file }: DataStoreFileItemProps) => (
    <AttachmentFileItem
        name={file.name}
        fileUrl={getDataStoreFileDownloadUrl(file.storeId, file.fileId)}
        isImage={isAdminDataStoreImageFile(file)}
        type={file.mediaType}
    />
);
