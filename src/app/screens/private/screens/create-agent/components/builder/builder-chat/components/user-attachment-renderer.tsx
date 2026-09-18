import { useAuiState } from '@assistant-ui/react';
import type { FC } from 'react';

import { UserLightboxImage } from '@/components/chat/primitives/user-file-parts';
import FileTypeIcon from '@/components/file-type-icon';
import { appAgentApi } from '@/lib/api/app/agent';
import { showErrorToast } from '@/utils';

const UserAttachmentRenderer: FC = () => {
    const attachment = useAuiState((s) => s.attachment);
    const imagePart = attachment.content?.find((part) => part.type === 'image') as
        | { type: 'image'; image: string }
        | undefined;
    const filePart = attachment.content?.find((part) => part.type === 'file') as
        | { type: 'file'; data: string }
        | undefined;

    const handleDownload = async () => {
        const url = filePart?.data;

        if (!url) return;

        try {
            const blob = await appAgentApi.downloadBlob(url);
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');

            link.href = downloadUrl;
            link.download = attachment.name || 'file';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(downloadUrl);
        } catch {
            showErrorToast('Failed to download file. Please try again later.');
        }
    };

    if (attachment.type === 'image' && imagePart?.image) {
        return (
            <UserLightboxImage
                src={imagePart.image}
                alt={attachment.name || 'image'}
                className="max-h-40 max-w-[240px] cursor-pointer rounded-lg object-contain"
            />
        );
    }

    return (
        <div
            className="flex max-w-[240px] cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-[13px] hover:bg-muted"
            onClick={handleDownload}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    void handleDownload();
                }
            }}
            aria-label={`Download ${attachment.name || 'file'}`}
        >
            <FileTypeIcon file={{ name: attachment.name, type: attachment.contentType }} />
            <span className="truncate">{attachment.name || filePart?.data || 'file'}</span>
        </div>
    );
};

export default UserAttachmentRenderer;
