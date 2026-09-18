import { getFilesDownloadUrl } from '@/lib/axios';

import type { AdminMessageFile } from '../types';
import { isAdminMessageImageFile } from '../utils/file-type-helpers';

import { AttachmentFileItem } from './attachment-file-item';

export interface MessageFileItemProps {
    file: AdminMessageFile;
}

export const MessageFileItem = ({ file }: MessageFileItemProps) => (
    <AttachmentFileItem
        name={file.name}
        fileUrl={getFilesDownloadUrl(file._id)}
        isImage={isAdminMessageImageFile(file)}
        extension={file.extension}
        type={file.type}
    />
);
