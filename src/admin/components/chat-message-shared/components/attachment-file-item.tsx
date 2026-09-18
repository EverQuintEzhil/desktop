import { DownloadIcon } from 'lucide-react';

import { UserLightboxImage } from '@/components/chat/primitives/user-file-parts';
import FileTypeIcon from '@/components/file-type-icon';
import { Button } from '@/components/ui/button';
import { appAgentApi } from '@/lib/api/app/agent';
import { showErrorToast } from '@/utils';

import '../chat-message-shared.scss';

export interface AttachmentFileItemProps {
    name: string;
    fileUrl: string;
    isImage: boolean;
    extension?: string;
    type?: string;
}

export const AttachmentFileItem = ({ name, fileUrl, isImage, extension, type }: AttachmentFileItemProps) => {
    const handleDownload = async () => {
        try {
            const blob = await appAgentApi.downloadBlob(fileUrl);
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');

            link.href = downloadUrl;
            link.download = name || 'file';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(downloadUrl);
        } catch {
            showErrorToast('Failed to download file. Please try again later.');
        }
    };

    const renderImageFile = () => (
        <div className="image-list-item">
            <figure className="message-image-item relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border-secondary bg-card">
                <UserLightboxImage src={fileUrl} alt={name || 'image'} className="h-[150px] w-[150px] object-cover" />
                <Button
                    size="icon-xs"
                    variant="ghost"
                    className="message-image-download-btn"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void handleDownload();
                    }}
                    aria-label={`Download ${name || 'image'}`}
                >
                    <DownloadIcon />
                </Button>
            </figure>
        </div>
    );

    const renderDocumentFile = () => (
        <div
            className="thumbnail-wrapper custom-thumbnail-wrapper ask-here flex w-full max-w-[240px] cursor-pointer items-center rounded-lg py-1"
            onClick={handleDownload}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    void handleDownload();
                }
            }}
            aria-label={`Download ${name || 'file'}`}
        >
            <div className="thumbnail flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden">
                {/* `extensionOf` lets an empty-string extension win over the name, so drop a blank one. */}
                <FileTypeIcon file={{ extension: extension || undefined, name, type }} />
            </div>
            <span className="pr-3 text-xs font-medium">{name || 'file'}</span>
        </div>
    );

    const renderFileContent = () => {
        if (isImage) return renderImageFile();

        return renderDocumentFile();
    };

    return renderFileContent();
};
