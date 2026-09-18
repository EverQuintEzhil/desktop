import {
    SquareArrowOutUpRightIcon,
    ClipboardIcon,
    CopyIcon,
    DownloadIcon,
    GlobeIcon,
    ImageIcon,
    LinkIcon,
    PencilIcon,
    TrashIcon,
    CropIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import ImageEditorModal from '@/app/components/image-editor-modal';
import Like from '@/app/components/like';
import { useDownloadMedia, useImageCopyExport } from '@/app/hooks';
import AppImage from '@/components/image';
import { Button } from '@/components/ui/button';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from '@/components/ui/context-menu';
import Spinner from '@/components/ui/spinner';
import { getFilesBaseUrl } from '@/lib/axios';
import type { GalleryAgentType } from '@/types/admin';
import type { GalleryItemActionHandlers, GeneratedItem } from '@/types/gallery';
import { showSuccessToast, makeSafeDownloadFilename } from '@/utils';

import type { GalleryTab } from '../../hooks/use-gallery-media-state';

import './gallery-image.scss';

interface Props extends GalleryItemActionHandlers {
    item: GeneratedItem;
    onImageClicked?: () => void;
    currentTab?: GalleryTab;
    agent: GalleryAgentType;
}

const GalleryImage = (props: Props) => {
    const {
        item,
        onDeleteItemClicked,
        onEditItemClicked,
        onViewItemClicked,
        onLikeItemClicked,
        onImageClicked,
        currentTab,
        agent,
    } = props;

    const [showCropExportModal, setShowCropExportModal] = useState(false);
    const { copyImage, exportImageAs, exporting } = useImageCopyExport();
    const { downloadMedia } = useDownloadMedia();
    const aspectRatio = item.meta?.aspect_ratio && item.meta.aspect_ratio > 0 ? item.meta.aspect_ratio : 1;

    const handleOpenCropExportModal = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setShowCropExportModal(true);
    };

    const handleDownloadImage = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (item.url) {
            exportImageAs(
                item.url,
                makeSafeDownloadFilename(null, {
                    agentName: agent.name,
                    createdAt: item.created_at,
                    promptSummary: item.ai?.arguments?.prompt || item.title,
                }),
                'png',
            );
        }
    };

    const handleCopyPrompt = () => {
        const prompt = item.ai?.arguments?.prompt;

        if (prompt) {
            navigator.clipboard.writeText(prompt);
            showSuccessToast('Prompt copied to clipboard');
        }
    };

    const handleCopyImage = () => {
        if (item.url) {
            copyImage(item.url);
        }
    };

    const handleCopyLink = () => {
        const basePath = window.location.pathname.replace(/\/$/, '');
        const shareUrl = `${window.location.origin}${basePath}/${item._id}`;

        navigator.clipboard.writeText(shareUrl);
        showSuccessToast('Link copied to clipboard');
    };

    const relatedFileId = item.related_file_ids?.[0];
    const filesBaseUrl = getFilesBaseUrl();
    const originalImageUrl = relatedFileId && filesBaseUrl ? `${filesBaseUrl}/download/${relatedFileId}` : undefined;

    const handleDownloadOriginal = () => {
        if (originalImageUrl) {
            downloadMedia(
                originalImageUrl,
                `original-${makeSafeDownloadFilename(null, {
                    agentName: agent.name,
                    createdAt: item.created_at,
                    promptSummary: item.ai?.arguments?.prompt || item.title,
                })}`,
            );
        }
    };

    const handleLikeItemClicked = (likesCount: number, isLikedByThisUser: boolean) => {
        onLikeItemClicked?.({ ...item, isLikedByThisUser, likes_count: likesCount });
    };

    if (item.isRunning || !item.url) {
        return (
            <div
                className="gallery-image-wrapper h-full w-full cursor-pointer"
                style={{ aspectRatio }}
                role="button"
                tabIndex={0}
                onClick={onImageClicked}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onImageClicked?.();
                    }
                }}
            >
                <div className="flex h-full w-full items-center justify-center bg-card">
                    <Spinner className="scale-[1.5]" />
                </div>
                {item.ai?.arguments?.prompt ? (
                    <div className="prompt-text flex items-center justify-center p-3 text-center">
                        <span className="text-sm text-(--white)">{item.ai.arguments?.prompt}</span>
                    </div>
                ) : null}
            </div>
        );
    }

    return (
        <>
            <ContextMenu>
                <ContextMenuTrigger asChild>
                    <div
                        className="gallery-image-wrapper h-full w-full"
                        style={{ aspectRatio }}
                        role="button"
                        tabIndex={0}
                        onClick={onImageClicked}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onImageClicked?.();
                            }
                        }}
                    >
                        <AppImage
                            src={`${item.url}?thumbnail=true`}
                            alt={item.title}
                            placeholder={'/assets/images/broken-image.svg'}
                            className="gallery-image-styled"
                        />
                        {item.ai?.arguments?.prompt ? (
                            <>
                                <div className="actions-top flex items-center justify-end gap-2 p-2">
                                    {item?.isMyItem && onViewItemClicked ? (
                                        <Button
                                            variant="black"
                                            size="icon-sm"
                                            tabIndex={-1}
                                            className="view-button rounded-full"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                onViewItemClicked(item);
                                            }}
                                        >
                                            <SquareArrowOutUpRightIcon />
                                        </Button>
                                    ) : null}
                                    {onEditItemClicked ? (
                                        <Button
                                            variant="black"
                                            size="icon-sm"
                                            tabIndex={-1}
                                            className="edit-button rounded-full"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                onEditItemClicked(item);
                                            }}
                                        >
                                            <PencilIcon />
                                        </Button>
                                    ) : null}

                                    <Button
                                        variant="black"
                                        size="icon-sm"
                                        tabIndex={-1}
                                        className="download-button rounded-full"
                                        disabled={exporting}
                                        onClick={handleDownloadImage}
                                    >
                                        {exporting ? <Spinner className="size-4" /> : <DownloadIcon />}
                                    </Button>

                                    <Button
                                        variant="black"
                                        size="icon-sm"
                                        tabIndex={-1}
                                        className="download-button rounded-full"
                                        onClick={handleOpenCropExportModal}
                                    >
                                        <CropIcon />
                                    </Button>

                                    {onDeleteItemClicked && item.isMyItem ? (
                                        <Button
                                            variant="black"
                                            size="icon-sm"
                                            tabIndex={-1}
                                            className="delete-button rounded-full"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                onDeleteItemClicked(item);
                                            }}
                                        >
                                            <TrashIcon />
                                        </Button>
                                    ) : null}
                                </div>
                                <div className="prompt-text flex items-center justify-center">
                                    <span className="line-clamp-5 text-sm text-(--white)">
                                        {item.ai.arguments?.prompt}
                                    </span>
                                </div>
                            </>
                        ) : null}
                        <div className="actions-bottom flex items-center justify-between gap-1 p-3">
                            {item.creator_name ? (
                                <RouterLink
                                    to={`/agent/${agent.slug}/user/${item.creator_id}`}
                                    className="cursor-pointer truncate text-sm font-medium text-(--white) hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {item.creator_name}
                                </RouterLink>
                            ) : null}
                            <div className="flex items-center justify-center gap-1">
                                {currentTab === 'my' && item.is_public && <GlobeIcon className="size-4 text-white" />}
                                {onLikeItemClicked ? (
                                    <Like
                                        className="ml-auto"
                                        key={item._id}
                                        likesCount={item.likes_count || 0}
                                        isLikedByThisUser={item.isLikedByThisUser || false}
                                        itemId={item._id}
                                        itemType="files"
                                        onLikeItemClicked={handleLikeItemClicked}
                                        countVisible={currentTab === 'my' ? false : true}
                                    />
                                ) : null}
                            </div>
                        </div>
                    </div>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-48">
                    {item.ai?.arguments?.prompt ? (
                        <ContextMenuItem onClick={handleCopyPrompt}>
                            <ClipboardIcon className="size-4" />
                            <span>Copy Prompt</span>
                        </ContextMenuItem>
                    ) : null}
                    {item.url ? (
                        <ContextMenuItem onClick={handleCopyImage}>
                            <CopyIcon className="size-4" />
                            <span>Copy Image</span>
                        </ContextMenuItem>
                    ) : null}
                    <ContextMenuItem onClick={handleCopyLink}>
                        <LinkIcon className="size-4" />
                        <span>Copy Link</span>
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={() => setShowCropExportModal(true)}>
                        <CropIcon className="size-4" />
                        <span>Crop</span>
                    </ContextMenuItem>
                    {originalImageUrl ? (
                        <ContextMenuItem onClick={handleDownloadOriginal}>
                            <ImageIcon className="size-4" />
                            <span>Download Original</span>
                        </ContextMenuItem>
                    ) : null}
                    {onEditItemClicked ? (
                        <ContextMenuItem onClick={() => onEditItemClicked(item)}>
                            <PencilIcon className="size-4" />
                            <span>Edit</span>
                        </ContextMenuItem>
                    ) : null}
                    {item?.isMyItem && onViewItemClicked ? (
                        <ContextMenuItem onClick={() => onViewItemClicked(item)}>
                            <SquareArrowOutUpRightIcon className="size-4" />
                            <span>Open</span>
                        </ContextMenuItem>
                    ) : null}
                    {onDeleteItemClicked && item.isMyItem ? (
                        <>
                            <ContextMenuSeparator />
                            <ContextMenuItem variant="destructive" onClick={() => onDeleteItemClicked(item)}>
                                <TrashIcon className="size-4" />
                                <span>Delete</span>
                            </ContextMenuItem>
                        </>
                    ) : null}
                </ContextMenuContent>
            </ContextMenu>
            {showCropExportModal ? (
                <ImageEditorModal
                    imageUrl={item.url}
                    imageName={makeSafeDownloadFilename(null, {
                        agentName: agent.name,
                        createdAt: item.created_at,
                        promptSummary: item.ai?.arguments?.prompt || item.title,
                    })}
                    isOpen={true}
                    onClose={() => setShowCropExportModal(false)}
                />
            ) : null}
        </>
    );
};

export default GalleryImage;
