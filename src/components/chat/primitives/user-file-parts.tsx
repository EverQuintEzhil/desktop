import type { FileMessagePartComponent, ImageMessagePartComponent } from '@assistant-ui/react';
import { useState } from 'react';

import FilePreviewLightbox from '@/components/file-preview-lightbox';
import FileTypeIcon from '@/components/file-type-icon';

import ChatFilePreview, { canPreviewChatFile } from './chat-file-preview';
import { useChatFileDownload } from './use-chat-file-download';

interface UserLightboxImageProps {
    src: string;
    alt: string;
    className?: string;
}

export const UserLightboxImage = ({ src, alt, className }: UserLightboxImageProps) => {
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);

    const openLightbox = () => {
        setIsLightboxOpen(true);
    };

    return (
        <>
            <img
                src={src}
                alt={alt}
                className={className}
                role="button"
                tabIndex={0}
                aria-label={`View ${alt} in lightbox`}
                onClick={openLightbox}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openLightbox();
                    }
                }}
            />
            <FilePreviewLightbox src={src} alt={alt} isOpen={isLightboxOpen} onClose={() => setIsLightboxOpen(false)} />
        </>
    );
};

export const UserFileRenderer: FileMessagePartComponent = (props) => {
    const src = props.data;
    const isImage = props.mimeType?.startsWith('image/');
    const name = props.filename || 'file';
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const { download, isDownloading } = useChatFileDownload();
    const canPreview = canPreviewChatFile({ url: src, name, mimeType: props.mimeType });

    const handleChipClick = () => {
        if (!src) return;
        if (canPreview) {
            setIsPreviewOpen(true);

            return;
        }
        void download(src, name);
    };

    if (isImage) {
        return (
            <UserLightboxImage
                src={src}
                alt={props.filename || 'image'}
                className="max-h-40 cursor-pointer rounded object-contain"
            />
        );
    }

    return (
        <>
            <div
                className="flex cursor-pointer items-center gap-2 rounded border border-border px-3 py-2 text-sm hover:bg-muted"
                onClick={handleChipClick}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleChipClick();
                    }
                }}
                aria-label={`${canPreview ? 'Preview' : 'Download'} ${name}`}
            >
                <FileTypeIcon file={{ name: props.filename, type: props.mimeType }} />
                <span>{name}</span>
            </div>
            <ChatFilePreview
                url={src}
                name={name}
                mimeType={props.mimeType}
                isOpen={isPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
                onDownload={() => {
                    void download(src, name);
                }}
                isDownloading={isDownloading}
            />
        </>
    );
};

export const UserImageRenderer: ImageMessagePartComponent = ({ image, filename }) => (
    <UserLightboxImage
        src={image}
        alt={filename || 'Attached image'}
        className="max-h-60 max-w-full cursor-pointer rounded-lg object-contain"
    />
);
