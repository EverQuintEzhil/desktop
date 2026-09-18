import {
    ArrowDownToLineIcon,
    CircleEllipsisIcon,
    CircleDollarSign,
    CopyIcon,
    CropIcon,
    HeartIcon,
    LinkIcon,
    TrashIcon,
} from 'lucide-react';

import Like from '@/app/components/like';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import type { GeneratedItem } from '@/types/gallery';
import { showSuccessToast } from '@/utils';

export interface LightboxHeaderMenuProps {
    isMyItem: boolean;
    currentItem: GeneratedItem | null;
    isVideo: boolean;
    downloadName?: string;
    mediaUrl: string | undefined;
    showRemixInput: boolean;
    isPublicLoading: boolean;
    onLikeItemClicked?: (item: GeneratedItem) => void;
    handleLikeItemClicked: (likesCount: number, isLikedByThisUser: boolean) => void;
    exporting: boolean;
    copying: boolean;
    copyImage: (url: string) => void;
    exportImageAs: (url: string, name: string, format: 'jpeg' | 'png' | 'webp') => void;
    handleDownloadClicked: (e: React.MouseEvent) => void;
    onDeleteItemAsyncClicked?: (item: GeneratedItem) => Promise<GeneratedItem[]>;
    onDeleteClicked: (item: GeneratedItem) => void;
    canSeeUsage: boolean;
    setTokenUsageOpen: (open: boolean) => void;
    ellipsisMenuOpen: boolean;
    setEllipsisMenuOpen: (open: boolean) => void;
    setExportMenuOpen: (open: boolean) => void;
}

export const LightboxHeaderMenu = (props: LightboxHeaderMenuProps) => {
    const {
        isMyItem,
        currentItem,
        isVideo,
        downloadName,
        mediaUrl,
        showRemixInput,
        isPublicLoading,
        onLikeItemClicked,
        handleLikeItemClicked,
        exporting,
        copying,
        copyImage,
        exportImageAs,
        handleDownloadClicked,
        onDeleteItemAsyncClicked,
        onDeleteClicked,
        canSeeUsage,
        setTokenUsageOpen,
        ellipsisMenuOpen,
        setEllipsisMenuOpen,
        setExportMenuOpen,
    } = props;

    return (
        <Popover
            open={ellipsisMenuOpen}
            onOpenChange={(open) => {
                if (!open) setExportMenuOpen(false);
                setEllipsisMenuOpen(open);
            }}
        >
            <SimpleTooltip content="More options">
                <PopoverTrigger asChild>
                    <Button
                        variant="black"
                        size="icon-sm"
                        className={`${isVideo ? 'show-mobile-carousel' : ''} rounded-full`}
                        aria-label="More options"
                        disabled={exporting || copying || showRemixInput}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <CircleEllipsisIcon />
                    </Button>
                </PopoverTrigger>
            </SimpleTooltip>
            <PopoverContent
                align="end"
                side="bottom"
                sideOffset={4}
                className="okaynav-menu-list-content min-w-[140px] p-2"
            >
                <div
                    role="menu"
                    className="okaynav-menu-list flex flex-col"
                    onKeyDown={(e) => {
                        if (e.key === 'Tab') {
                            e.preventDefault();
                            setEllipsisMenuOpen(false);

                            return;
                        }
                        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
                        e.preventDefault();
                        const items = Array.from(
                            e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not([tabindex="-1"])'),
                        );
                        const idx = items.indexOf(document.activeElement as HTMLElement);

                        (e.key === 'ArrowDown'
                            ? (items[idx + 1] ?? items[0])
                            : (items[idx - 1] ?? items[items.length - 1])
                        )?.focus();
                    }}
                >
                    {!currentItem?.isRunning && onLikeItemClicked && currentItem && (
                        <Like
                            key={currentItem._id}
                            className="okaynav-menu-list-item cursor-pointer rounded-sm"
                            likesCount={currentItem.likes_count ?? 0}
                            isLikedByThisUser={currentItem.isLikedByThisUser ?? false}
                            itemId={currentItem._id}
                            itemType="files"
                            onLikeItemClicked={handleLikeItemClicked}
                            disabled={isPublicLoading}
                            renderWrapperContent={(
                                _countVisible,
                                likesState,
                                formattedLikeCount,
                                isDisabled,
                                handleLikeClick,
                            ) => (
                                <div
                                    key={'like'}
                                    role="menuitem"
                                    tabIndex={isDisabled ? -1 : 0}
                                    className={
                                        'okaynav-menu-list-item show-mobile-carousel cursor-pointer rounded-sm' +
                                        ` flex items-center justify-start gap-2 p-2${isDisabled ? ' is-disabled' : ''}`
                                    }
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleLikeClick(e);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            handleLikeClick(e as unknown as React.MouseEvent);
                                        }
                                    }}
                                >
                                    <HeartIcon
                                        className="size-4 text-white"
                                        fill={likesState.isLikedByThisUser ? 'currentColor' : 'none'}
                                    />
                                    <span className="text-sm text-(--white)">
                                        {likesState.totalLikes > 0 ? formattedLikeCount + ' ' : ''}
                                        Like
                                        {likesState.totalLikes > 1 ? 's' : ''}
                                    </span>
                                </div>
                            )}
                        />
                    )}
                    {!currentItem?.isRunning && mediaUrl && (
                        <div
                            key={'download'}
                            role="menuitem"
                            tabIndex={0}
                            className="okaynav-menu-list-item show-mobile-carousel flex cursor-pointer items-center justify-start gap-2 rounded-sm p-2"
                            onClick={(e) => {
                                setEllipsisMenuOpen(false);
                                handleDownloadClicked(e);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setEllipsisMenuOpen(false);
                                    handleDownloadClicked(e as unknown as React.MouseEvent);
                                }
                            }}
                        >
                            {isVideo ? (
                                <ArrowDownToLineIcon className="size-4 text-white" />
                            ) : (
                                <CropIcon className="size-4 text-white" />
                            )}
                            <span className="text-sm text-(--white)">{isVideo ? 'Download' : 'Crop Image'}</span>
                        </div>
                    )}
                    {!currentItem?.isRunning && onDeleteItemAsyncClicked && currentItem && isMyItem && (
                        <div
                            key={'delete'}
                            role="menuitem"
                            tabIndex={0}
                            className="okaynav-menu-list-item show-mobile-carousel flex cursor-pointer items-center justify-start gap-2 rounded-sm p-2"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDeleteClicked(currentItem);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    onDeleteClicked(currentItem);
                                }
                            }}
                        >
                            <TrashIcon className="size-4 text-white" />
                            <span className="text-sm text-(--white)">Delete</span>
                        </div>
                    )}
                    {!currentItem?.isRunning && !isVideo && mediaUrl && (
                        <div
                            key={'copy'}
                            role="menuitem"
                            tabIndex={0}
                            className="okaynav-menu-list-item flex cursor-pointer items-center justify-start gap-2 rounded-sm p-2"
                            onClick={() => {
                                setEllipsisMenuOpen(false);
                                copyImage(mediaUrl);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setEllipsisMenuOpen(false);
                                    copyImage(mediaUrl);
                                }
                            }}
                        >
                            <CopyIcon className="size-4 text-white" />
                            <span className="text-sm text-(--white)">Copy</span>
                        </div>
                    )}
                    {!currentItem?.isRunning && currentItem?._id && (
                        <div
                            key={'copy-link'}
                            role="menuitem"
                            tabIndex={0}
                            className="okaynav-menu-list-item flex cursor-pointer items-center justify-start gap-2 rounded-sm p-2"
                            onClick={() => {
                                const basePath = window.location.pathname.replace(/\/$/, '');
                                const shareUrl = `${window.location.origin}${basePath}/${currentItem._id}`;

                                navigator.clipboard.writeText(shareUrl);
                                showSuccessToast('Link copied to clipboard');
                                setEllipsisMenuOpen(false);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    const basePath = window.location.pathname.replace(/\/$/, '');

                                    navigator.clipboard.writeText(
                                        `${window.location.origin}${basePath}/${currentItem._id}`,
                                    );
                                    showSuccessToast('Link copied to clipboard');
                                    setEllipsisMenuOpen(false);
                                }
                            }}
                        >
                            <LinkIcon className="size-4 text-white" />
                            <span className="text-sm text-(--white)">Copy Link</span>
                        </div>
                    )}
                    {canSeeUsage && !currentItem?.isRunning && currentItem?.ai?.usage && (
                        <div
                            key={'token-usage'}
                            role="menuitem"
                            tabIndex={0}
                            className="okaynav-menu-list-item show-mobile-carousel flex cursor-pointer items-center justify-start gap-2 rounded-sm p-2"
                            onClick={() => {
                                setEllipsisMenuOpen(false);
                                setTokenUsageOpen(true);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setEllipsisMenuOpen(false);
                                    setTokenUsageOpen(true);
                                }
                            }}
                        >
                            <CircleDollarSign className="size-4 text-white" />
                            <span className="text-sm text-(--white)">AI Usage</span>
                        </div>
                    )}
                    {!currentItem?.isRunning &&
                        !isVideo &&
                        mediaUrl &&
                        (['jpeg', 'png', 'webp'] as const).map((format) => (
                            <div
                                key={format}
                                role="menuitem"
                                tabIndex={0}
                                className="okaynav-menu-list-item flex cursor-pointer items-center justify-start gap-2 rounded-sm p-2"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setEllipsisMenuOpen(false);
                                        exportImageAs(mediaUrl, downloadName || 'generated-image', format);
                                    }
                                }}
                                onClick={() => {
                                    setEllipsisMenuOpen(false);
                                    exportImageAs(mediaUrl, downloadName || 'generated-image', format);
                                }}
                            >
                                <ArrowDownToLineIcon className="size-4 text-white" />
                                <span className="text-sm text-(--white)">Export as {format.toUpperCase()}</span>
                            </div>
                        ))}
                </div>
            </PopoverContent>
        </Popover>
    );
};
