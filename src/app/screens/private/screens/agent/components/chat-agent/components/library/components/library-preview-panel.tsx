import { ExternalLinkIcon, GlobeIcon, LockIcon, MessageSquareIcon, TrashIcon } from 'lucide-react';

import Like from '@/app/components/like';
import type { LibraryItem } from '@/components/agent-chat/hooks/use-media-library';
import LibraryPreviewContent from '@/components/file-list/library-preview-content';
import FilePreviewLightbox from '@/components/file-preview-lightbox';
import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import Switch from '@/components/ui/switch';

import {
    fileMeta,
    formatFileDate,
    formatFileSize,
    isCodeTextFile,
    isDocFile,
    isHtmlFile,
    isImageFile,
    isMarkdownFile,
    isPdfFile,
    isSpreadsheetFile,
    isVideoFile,
    LibraryAttribution,
} from '../file-preview';

const getPreviewType = (item: LibraryItem): 'image' | 'video' | 'pdf' | 'file' => {
    if (isImageFile(item)) return 'image';
    if (isVideoFile(item)) return 'video';
    if (isPdfFile(item)) return 'pdf';

    return 'file';
};

const hasInlinePreview = (item: LibraryItem) =>
    isImageFile(item) ||
    isPdfFile(item) ||
    isHtmlFile(item) ||
    isMarkdownFile(item) ||
    isCodeTextFile(item) ||
    isSpreadsheetFile(item) ||
    isDocFile(item);

interface Props {
    item: LibraryItem;
    agentId?: string;
    previewIndex: number;
    itemsLength: number;
    hasNextPage: boolean;
    isShowMoreLoading: boolean;
    downloadingId: string | null;
    visibilityUpdatingId: string | null;
    onOpenChat?: (item: LibraryItem) => void;
    onLike: (item: LibraryItem) => void;
    onDownload: (item: LibraryItem) => void;
    onSetVisibility: (id: string, isPublic: boolean) => void;
    onDelete: (item: LibraryItem) => void;
    onClose: () => void;
    onLeave: () => void;
    onPrev: () => void;
    onNext: () => void;
}

const LibraryPreviewPanel = (props: Props) => {
    const {
        item,
        agentId,
        previewIndex,
        itemsLength,
        hasNextPage,
        isShowMoreLoading,
        downloadingId,
        visibilityUpdatingId,
        onOpenChat,
        onLike,
        onDownload,
        onSetVisibility,
        onDelete,
        onClose,
        onLeave,
        onPrev,
        onNext,
    } = props;

    const canOpenChat = Boolean(onOpenChat) && item.isMyItem && Boolean(item.conversationId);

    const renderDetails = () => {
        const { label } = fileMeta(item.extension);
        const generatedLabel = item.modelName ? `Generated · ${item.modelName}` : 'Generated';
        const source = item.isGenerated ? generatedLabel : 'Uploaded';
        const chips = [label, formatFileSize(item.size), formatFileDate(item.createdAt), source].filter(Boolean);
        const hasAttribution = Boolean(item.creatorName || (!agentId && item.agentSlug && item.agentName));

        return (
            <div className="file-preview-details scrollbar-controller scrollbar-horizontal flex min-w-0 items-center gap-2 text-xs whitespace-nowrap text-white/60">
                <LibraryAttribution
                    item={item}
                    tone="onDark"
                    showAgentLink={!agentId}
                    nowrap
                    className="shrink-0"
                    onNavigate={onLeave}
                />
                {chips.map((chip, index) => (
                    <span key={index} className="flex shrink-0 items-center gap-2">
                        {index > 0 || hasAttribution ? (
                            <span aria-hidden className="opacity-50">
                                ·
                            </span>
                        ) : null}
                        {chip}
                    </span>
                ))}
                <span className="flex shrink-0 items-center gap-1">
                    <span aria-hidden className="opacity-50">
                        ·
                    </span>
                    {item.isPublic ? <GlobeIcon className="size-3.5" /> : <LockIcon className="size-3.5" />}
                    {item.isPublic ? 'Public' : 'Private'}
                </span>
            </div>
        );
    };

    const renderActions = () => (
        <>
            <SimpleTooltip content={item.isLikedByThisUser ? 'Unlike' : 'Like'} side="bottom" className="z-61">
                <span className="flex shrink-0">
                    <Like
                        key={item._id}
                        className="flex size-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
                        likesCount={item.likesCount}
                        isLikedByThisUser={item.isLikedByThisUser}
                        itemId={item._id}
                        itemType="files"
                        countVisible={false}
                        onLikeItemClicked={(count, liked) =>
                            onLike({ ...item, likesCount: count, isLikedByThisUser: liked })
                        }
                    />
                </span>
            </SimpleTooltip>
            {canOpenChat ? (
                <SimpleTooltip content="Open chat" side="bottom" className="z-61">
                    <Button
                        variant="black"
                        size="icon-sm"
                        className="rounded-full"
                        aria-label="Open chat"
                        onClick={() => {
                            onOpenChat?.(item);
                            onClose();
                        }}
                    >
                        <MessageSquareIcon />
                    </Button>
                </SimpleTooltip>
            ) : null}
            <SimpleTooltip content="Open in new tab" side="bottom" className="z-61">
                <Button
                    variant="black"
                    size="icon-sm"
                    className="rounded-full"
                    aria-label="Open in new tab"
                    onClick={() => window.open(item.url, '_blank', 'noopener')}
                >
                    <ExternalLinkIcon />
                </Button>
            </SimpleTooltip>
            {item.isMyItem ? (
                <Switch
                    options={[
                        { label: 'Private', icon: LockIcon },
                        { label: 'Public', icon: GlobeIcon },
                    ]}
                    activeIndex={item.isPublic ? 1 : 0}
                    onChange={(e, index) => {
                        e.stopPropagation();
                        e.preventDefault();
                        if (visibilityUpdatingId !== item._id) onSetVisibility(item._id, index === 1);
                    }}
                    isLoading={visibilityUpdatingId === item._id}
                    color="white"
                />
            ) : null}
            {item.isMyItem ? (
                <SimpleTooltip content="Delete" side="bottom" className="z-61">
                    <Button
                        variant="black"
                        size="icon-sm"
                        className="rounded-full"
                        aria-label="Delete"
                        onClick={() => {
                            onClose();
                            onDelete(item);
                        }}
                    >
                        <TrashIcon />
                    </Button>
                </SimpleTooltip>
            ) : null}
        </>
    );

    return (
        <FilePreviewLightbox
            src={item.url}
            alt={item.name}
            title={item.name}
            isOpen
            type={getPreviewType(item)}
            details={renderDetails()}
            actions={renderActions()}
            onDownload={() => onDownload(item)}
            isDownloading={downloadingId === item._id}
            onClose={onClose}
            onPrev={onPrev}
            onNext={onNext}
            hasPrev={previewIndex > 0}
            hasNext={previewIndex >= 0 && (previewIndex < itemsLength - 1 || hasNextPage)}
            isNextLoading={previewIndex === itemsLength - 1 && isShowMoreLoading}
        >
            {hasInlinePreview(item) ? <LibraryPreviewContent item={item} /> : null}
        </FilePreviewLightbox>
    );
};

export type { Props as LibraryPreviewPanelProps };
export default LibraryPreviewPanel;
