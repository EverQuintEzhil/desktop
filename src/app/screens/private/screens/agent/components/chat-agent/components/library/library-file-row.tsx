import { DownloadIcon, HeartIcon, Loader2Icon, MessageSquareIcon, MoreVerticalIcon, TrashIcon } from 'lucide-react';

import Like from '@/app/components/like';
import type { LibraryItem } from '@/components/agent-chat/hooks/use-media-library';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRoot,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

import {
    FileThumb,
    LibraryAttribution,
    LibraryBadges,
    LibraryEmbeddingStatusBadge,
    fileMeta,
    formatFileDate,
    formatFileSize,
    hasProminentEmbeddingStatus,
} from './file-preview';

export const LIBRARY_LIST_GRID_SELECTABLE =
    'grid-cols-[28px_minmax(0,1fr)_32px] sm:grid-cols-[28px_minmax(0,1fr)_128px_84px_32px]';
export const LIBRARY_LIST_GRID_PLAIN = 'grid-cols-[minmax(0,1fr)_32px] sm:grid-cols-[minmax(0,1fr)_128px_84px_32px]';

export const getLibraryListGridCols = (selectable: boolean) =>
    selectable ? LIBRARY_LIST_GRID_SELECTABLE : LIBRARY_LIST_GRID_PLAIN;

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
    allSelected?: boolean;
    isFirst?: boolean;
    isLast?: boolean;
    showAgentLink?: boolean;
}

const LibraryFileRow = (props: Props) => {
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
        allSelected = false,
        isFirst = false,
        isLast = false,
        showAgentLink = true,
    } = props;
    const { Icon } = fileMeta(item.extension);
    const canOpenChat = Boolean(onOpenChat) && item.isMyItem && Boolean(item.conversationId);
    const canOpen = Boolean(item.url);
    const canInteract = selectionActive || canOpen;
    const showProminentEmbeddingStatus = hasProminentEmbeddingStatus(item);
    const sizeLabel = formatFileSize(item.size) || '—';
    const dateLabel = formatFileDate(item.createdAt) || '—';

    const handleOpen = () => {
        if (selectionActive) {
            onToggleSelect?.();

            return;
        }
        if (canOpen) onOpenLightbox(item);
    };

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleOpen();
        }
    };

    return (
        <div
            className={cn(
                'library-file-row group grid items-center gap-3 rounded-lg px-3 py-2.5 transition-colors duration-140',
                getLibraryListGridCols(selectable),
                canInteract && 'cursor-pointer',
                selected && 'bg-primary/8',
                allSelected && 'rounded-none',
                allSelected && isFirst && 'rounded-t-lg',
                allSelected && isLast && 'rounded-b-lg',
            )}
            role={canInteract ? 'button' : undefined}
            tabIndex={canInteract ? 0 : undefined}
            onClick={canInteract ? handleOpen : undefined}
            onKeyDown={canInteract ? handleKeyDown : undefined}
        >
            {selectable ? (
                <span
                    className="flex items-center justify-center"
                    onClick={(e) => e.stopPropagation()}
                    role="presentation"
                >
                    <Checkbox
                        checked={selected}
                        aria-label={selected ? `Deselect ${item.name}` : `Select ${item.name}`}
                        onChange={() => onToggleSelect?.()}
                    />
                </span>
            ) : null}

            <div className="library-file-row-content flex min-w-0 items-center gap-3">
                <FileThumb item={item} Icon={Icon} className="size-9 shrink-0 rounded-lg object-cover" />
                <div className="library-file-row-content-name-container flex flex-col">
                    <div className="library-file-row-content-name flex items-center gap-2">
                        <span className="line-clamp-1 text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                            {item.name}
                        </span>
                        {showProminentEmbeddingStatus ? (
                            <span onClick={(e) => e.stopPropagation()} role="presentation">
                                <LibraryEmbeddingStatusBadge item={item} className="size-5 shrink-0" />
                            </span>
                        ) : null}
                        <LibraryBadges
                            item={item}
                            className="hidden shrink-0 lg:flex [&>span]:size-5"
                            showEmbeddingStatus={!showProminentEmbeddingStatus}
                        />
                    </div>
                    <LibraryAttribution item={item} showAgentLink={showAgentLink} avatarClassName="bg-card" />
                </div>
            </div>

            <span className="hidden text-sm text-text-secondary sm:block">{dateLabel}</span>
            <span className="hidden text-sm text-text-secondary sm:block">{sizeLabel}</span>

            <div
                className={cn(
                    'flex shrink-0 items-center justify-end opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100',
                    selectionActive && 'hidden',
                )}
                onClick={(e) => e.stopPropagation()}
                role="presentation"
            >
                <DropdownMenuRoot>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Actions for ${item.name}`}
                            className="cursor-pointer text-text-secondary hover:text-foreground"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <MoreVerticalIcon />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[160px]">
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
                            renderWrapperContent={(
                                _countVisible,
                                likesState,
                                _formatted,
                                isDisabled,
                                handleLikeClick,
                            ) => (
                                <DropdownMenuItem
                                    disabled={isDisabled}
                                    onSelect={(e) => e.preventDefault()}
                                    onClick={(e) => handleLikeClick(e as unknown as React.MouseEvent)}
                                    className="cursor-pointer"
                                >
                                    <HeartIcon
                                        className={cn(likesState.isLikedByThisUser && 'text-primary!')}
                                        fill={likesState.isLikedByThisUser ? 'currentColor' : 'none'}
                                    />
                                    <span>{likesState.isLikedByThisUser ? 'Unlike' : 'Like'}</span>
                                </DropdownMenuItem>
                            )}
                        />
                        {canOpenChat ? (
                            <DropdownMenuItem className="cursor-pointer" onClick={() => onOpenChat?.(item)}>
                                <MessageSquareIcon />
                                <span>Open chat</span>
                            </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuItem
                            className="cursor-pointer"
                            disabled={downloadingId === item._id}
                            onSelect={(e) => e.preventDefault()}
                            onClick={() => onDownload(item)}
                        >
                            {downloadingId === item._id ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />}
                            <span>Download</span>
                        </DropdownMenuItem>
                        {item.isMyItem ? (
                            <DropdownMenuItem
                                variant="destructive"
                                className="cursor-pointer"
                                onClick={() => onDelete(item)}
                            >
                                <TrashIcon />
                                <span>Delete</span>
                            </DropdownMenuItem>
                        ) : null}
                    </DropdownMenuContent>
                </DropdownMenuRoot>
            </div>
        </div>
    );
};

export default LibraryFileRow;
