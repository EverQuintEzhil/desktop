import {
    extensionOf,
    isPreviewableFile,
    isVideoFile,
    type SharedFileItem,
} from '@/components/file-list/file-list-utils';

import FilePreviewDialog from './file-preview-dialog';
import { useChatFileDownload } from './use-chat-file-download';

interface Props {
    url: string;
    name: string;
    mimeType?: string;
    isOpen: boolean;
    onClose: () => void;
    onDownload: () => void;
    isDownloading?: boolean;
}

interface PreviewableFileArgs {
    url: string;
    name: string;
    mimeType?: string;
}

const isHttpUrl = (url: string): boolean => /^https?:\/\//i.test(url);

const toSharedFileItem = ({ url, name, mimeType }: PreviewableFileArgs): SharedFileItem => ({
    extension: extensionOf({ name, type: mimeType }),
    name,
    type: mimeType,
    url,
});

// Videos are excluded: LibraryPreviewContent has no video branch and would fetch the binary as
// text. A `blob:`/`data:` url cannot go through the chat transport. Images with an image mime
// type never reach this — the renderers show them inline with a lightbox — but an image-named
// part without one lands here and previews through the dialog's image branch.
export const canPreviewChatFile = (args: PreviewableFileArgs): boolean => {
    if (!isHttpUrl(args.url)) return false;

    const item = toSharedFileItem(args);

    return isPreviewableFile(item) && !isVideoFile(item);
};

export const ChatFilePreview = ({ url, name, mimeType, isOpen, onClose, onDownload, isDownloading = false }: Props) => {
    const { fetchBlob } = useChatFileDownload();

    if (!canPreviewChatFile({ url, name, mimeType })) return null;

    return (
        <FilePreviewDialog
            item={toSharedFileItem({ url, name, mimeType })}
            name={name}
            isOpen={isOpen}
            onClose={onClose}
            loadFile={fetchBlob}
            onDownload={onDownload}
            isDownloading={isDownloading}
        />
    );
};

export default ChatFilePreview;
