import { CheckIcon, DownloadIcon, Loader2Icon, MessageSquareIcon, PlayIcon, TrashIcon } from 'lucide-react';

import Like from '@/app/components/like';
import type { LibraryItem } from '@/components/agent-chat/hooks/use-media-library';
import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { cn } from '@/lib/utils';

import {
    FileIconTile,
    FileThumb,
    LibraryAttribution,
    LibraryBadges,
    LibraryEmbeddingStatusBadge,
    fileMeta,
    formatFileDate,
    formatFileSize,
    hasProminentEmbeddingStatus,
    isImageFile,
    isVideoFile,
} from './file-preview';

const SURFACE_HOVER_CLASS_NAME = 'hover:bg-(--surface-hover) hover:shadow-(--shadow-surface)';

interface Props {
    item: LibraryItem;
    onOpenLightbox: (item: LibraryItem) => void;
    onOpenChat?: (item: LibraryItem) => void;
    onLike: (item: LibraryItem) => void;
    onDelete: (item: LibraryItem) => void;
    onDownload: (item: LibraryItem) => void;
    downloadingId: string | null;
    selectable?: boolean;
    selected?: boolean;
    selectionActive?: boolean;
    onToggleSelect?: () => void;
    showAgentLink?: boolean;
}

const LibraryFileCard = (props: Props) => {
    const {
        item,
        onOpenLightbox,
        onOpenChat,
        onLike,
        onDelete,
        onDownload,
        downloadingId,
        selectable = false,
        selected = false,
        selectionActive = false,
        onToggleSelect,
        showAgentLink = true,
    } = props;
    const { label, Icon } = fileMeta(item.extension);
    const previewLabel = isImageFile(item) && item.extension ? item.extension.replace(/^\./, '').toUpperCase() : label;
    const showThumb =
        (isImageFile(item) && (item.thumbnailUrl || item.url)) || (isVideoFile(item) && item.thumbnailUrl);
    const canOpen = Boolean(item.url);
    const canOpenChat = Boolean(onOpenChat) && item.isMyItem && Boolean(item.conversationId);
    const showProminentEmbeddingStatus = hasProminentEmbeddingStatus(item);
    const meta = [previewLabel, formatFileSize(item.size), formatFileDate(item.createdAt)].filter(Boolean).join(' · ');

    const handleOpen = () => {
        if (selectionActive) {
            onToggleSelect?.();

            return;
        }
        if (canOpen) onOpenLightbox(item);
    };

    const handleToggleSelect = (event: React.MouseEvent) => {
        event.stopPropagation();
        onToggleSelect?.();
    };

    const renderSelectToggle = () => {
        if (!selectable) return null;

        return (
            <Button
                variant="black"
                size="icon-sm"
                type="button"
                onClick={handleToggleSelect}
                aria-label={selected ? `Deselect ${item.name}` : `Select ${item.name}`}
                aria-pressed={selected}
                className={cn(
                    'library-file-card-select absolute top-4 left-4 z-10 rounded-full shadow-sm backdrop-blur-sm',
                    'opacity-100 transition-opacity focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100',
                    selected
                        ? 'border-primary bg-primary text-primary-foreground opacity-100 hover:bg-primary/80 lg:opacity-100'
                        : 'border-white/60 bg-black/45 text-white hover:border-white hover:bg-black/65',
                    selectionActive && 'opacity-100 lg:opacity-100',
                )}
            >
                {selected ? <CheckIcon className="size-4" /> : null}
            </Button>
        );
    };

    const renderPreview = () => {
        if (showThumb) {
            return (
                <>
                    <FileThumb
                        item={item}
                        Icon={Icon}
                        className="size-full object-cover"
                        fallback={<FileIconTile Icon={Icon} />}
                    />
                    {isVideoFile(item) ? (
                        <span className="absolute inset-0 flex items-center justify-center">
                            <span className="flex size-10 items-center justify-center rounded-full bg-black/50 text-white">
                                <PlayIcon className="size-5" />
                            </span>
                        </span>
                    ) : null}
                </>
            );
        }

        return <FileIconTile Icon={Icon} />;
    };

    const canInteract = selectionActive || canOpen;

    return (
        <div
            className={cn(
                'library-file-card group relative flex h-full flex-col overflow-hidden rounded-2xl bg-card transition-[background-color,box-shadow] duration-140',
                SURFACE_HOVER_CLASS_NAME,
                selected && 'border-primary bg-primary/5 ring-2 ring-primary/15',
            )}
        >
            {renderSelectToggle()}
            <button
                type="button"
                onClick={handleOpen}
                aria-label={selectionActive ? `Select ${item.name}` : `Open ${item.name}`}
                className={cn(
                    'relative flex aspect-video w-full items-center justify-center overflow-hidden bg-background',
                    'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                    canInteract ? 'cursor-pointer' : 'cursor-default',
                )}
            >
                {renderPreview()}
                {showProminentEmbeddingStatus ? (
                    <LibraryEmbeddingStatusBadge
                        item={item}
                        className="absolute bottom-3 left-1/2 z-10 max-w-[calc(100%-1.5rem)] -translate-x-1/2 justify-center"
                    />
                ) : null}
            </button>

            <div
                className={cn(
                    'library-file-card-actions absolute top-4 right-4 flex items-center gap-1 rounded-full bg-black/45 p-0.5',
                    'opacity-100 transition-opacity focus-within:opacity-100 lg:opacity-0 lg:group-hover:opacity-100',
                    selectionActive && 'hidden',
                )}
            >
                <Like
                    key={item._id}
                    likesCount={item.likesCount}
                    isLikedByThisUser={item.isLikedByThisUser}
                    itemId={item._id}
                    itemType="files"
                    countVisible={false}
                    onLikeItemClicked={(count, liked) =>
                        onLike({ ...item, likesCount: count, isLikedByThisUser: liked })
                    }
                />
                {canOpenChat ? (
                    <SimpleTooltip content="Open chat" side="bottom">
                        <Button
                            variant="black"
                            size="icon-sm"
                            className="rounded-full"
                            aria-label={`Open chat for ${item.name}`}
                            onClick={() => onOpenChat?.(item)}
                        >
                            <MessageSquareIcon />
                        </Button>
                    </SimpleTooltip>
                ) : null}
                <SimpleTooltip content="Download" side="bottom">
                    <Button
                        variant="black"
                        size="icon-sm"
                        className="rounded-full"
                        aria-label={`Download ${item.name}`}
                        disabled={downloadingId === item._id}
                        onClick={() => onDownload(item)}
                    >
                        {downloadingId === item._id ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />}
                    </Button>
                </SimpleTooltip>
                {item.isMyItem ? (
                    <SimpleTooltip content="Delete" side="bottom">
                        <Button
                            variant="black"
                            size="icon-sm"
                            className="rounded-full"
                            aria-label={`Delete ${item.name}`}
                            onClick={() => onDelete(item)}
                        >
                            <TrashIcon />
                        </Button>
                    </SimpleTooltip>
                ) : null}
            </div>

            <div className="library-file-card-content flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                    <h4 className="truncate leading-5 font-medium text-foreground transition-colors group-hover:text-primary">
                        {item.name}
                    </h4>
                    <LibraryBadges
                        item={item}
                        className="shrink-0"
                        showEmbeddingStatus={!showProminentEmbeddingStatus}
                    />
                </div>
                <span className="line-clamp-1 text-xs text-text-secondary">{meta}</span>
                <LibraryAttribution
                    item={item}
                    showAgentLink={showAgentLink}
                    nowrap
                    avatarClassName="border-0"
                    className="mt-1.5"
                />
            </div>
        </div>
    );
};

export default LibraryFileCard;
