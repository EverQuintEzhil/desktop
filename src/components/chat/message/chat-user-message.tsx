import { AttachmentPrimitive, MessagePrimitive, useAuiState } from '@assistant-ui/react';
import { type ComponentType, useState } from 'react';

import { useChatClassNames } from '@/components/chat-host';
import ChatFilePreview, { canPreviewChatFile } from '@/components/chat/primitives/chat-file-preview';
import { useChatFileDownload } from '@/components/chat/primitives/use-chat-file-download';
import { UserLightboxImage } from '@/components/chat/primitives/user-file-parts';
import FileTypeIcon from '@/components/file-type-icon';
import { cn } from '@/lib/utils';

import type { ChatUserMessageProps } from './types';

export const UserAttachmentRenderer = () => {
    const attachment = useAuiState((s) => s.attachment);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const { download, isDownloading } = useChatFileDownload();
    const imagePart = attachment.content?.find((part) => part.type === 'image') as
        | { type: 'image'; image: string }
        | undefined;
    const filePart = attachment.content?.find((part) => part.type === 'file') as
        | { type: 'file'; data: string }
        | undefined;
    const name = attachment.name || 'file';
    const url = filePart?.data ?? '';

    const canPreview = canPreviewChatFile({ url, name, mimeType: attachment.contentType });

    const handleChipClick = () => {
        if (!url) return;
        if (canPreview) {
            setIsPreviewOpen(true);

            return;
        }
        void download(url, name);
    };

    if (attachment.type === 'image' && imagePart?.image) {
        return (
            <figure className="image-list-item message-image-item relative flex items-center justify-center rounded-2xl">
                <UserLightboxImage src={imagePart.image} alt={attachment.name || 'image'} />
            </figure>
        );
    }

    return (
        <>
            <div
                className="thumbnail-wrapper custom-thumbnail-wrapper ask-here flex w-full max-w-[240px] cursor-pointer items-center rounded-lg py-1"
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
                <div className="thumbnail flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden">
                    <FileTypeIcon file={{ name: attachment.name, type: attachment.contentType }} />
                </div>
                <span className="pr-3 text-xs font-medium">{attachment.name || filePart?.data || 'file'}</span>
            </div>
            <ChatFilePreview
                url={url}
                name={name}
                mimeType={attachment.contentType}
                isOpen={isPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
                onDownload={() => {
                    void download(url, name);
                }}
                isDownloading={isDownloading}
            />
        </>
    );
};

interface UserMessageAttachmentsListProps {
    Renderer?: ComponentType;
}

export const UserMessageAttachmentsList = ({ Renderer = UserAttachmentRenderer }: UserMessageAttachmentsListProps) => (
    <MessagePrimitive.Attachments>
        {({ attachment }) => (
            <AttachmentPrimitive.Root
                className={attachment.type === 'image' ? 'order-first' : 'order-last flex w-full justify-end'}
            >
                <Renderer />
            </AttachmentPrimitive.Root>
        )}
    </MessagePrimitive.Attachments>
);

export const ChatUserMessage = ({
    Text,
    File,
    Image,
    wrapParts,
    hideBubble,
    beforeBubble,
    actions,
    afterContent,
    AttachmentRenderer,
    attachmentsMode = 'always',
    rootClassName = 'message-list-item question-list-item flex flex-col pt-3',
    bubbleClassName = 'message-question rounded-lg py-2 px-4 bg-card ml-auto max-w-[480px]',
    attachmentsWrapperClassName = 'image-list flex flex-wrap justify-end w-full gap-2 pb-3',
}: ChatUserMessageProps) => {
    const attachmentsCount = useAuiState((s) => s.message.attachments?.length ?? 0);
    const showAttachments = attachmentsMode === 'always' || attachmentsCount > 0;
    const classNames = useChatClassNames();

    const parts = (
        <MessagePrimitive.Parts
            components={{
                Text,
                File,
                Image,
            }}
        />
    );

    return (
        <MessagePrimitive.Root
            className={cn(rootClassName, classNames.message, classNames.userMessage)}
            data-role="user"
        >
            <div className="message group relative flex flex-col gap-2">
                {showAttachments && (
                    <div className={attachmentsWrapperClassName}>
                        <UserMessageAttachmentsList Renderer={AttachmentRenderer} />
                    </div>
                )}
                {beforeBubble}
                {!hideBubble && <div className={bubbleClassName}>{wrapParts ? wrapParts(parts) : parts}</div>}
                {actions}
            </div>
            {afterContent}
        </MessagePrimitive.Root>
    );
};
