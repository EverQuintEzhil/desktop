import {
    SquareArrowOutUpRightIcon,
    ClipboardIcon,
    DownloadIcon,
    GlobeIcon,
    ImageIcon,
    LinkIcon,
    PencilIcon,
    TrashIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import Like from '@/app/components/like';
import { useDownloadMedia } from '@/app/hooks';
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

import './gallery-video.scss';

interface Props extends GalleryItemActionHandlers {
    item: GeneratedItem;
    onImageClicked?: () => void;
    currentTab?: GalleryTab;
    agent: GalleryAgentType;
}

const GalleryVideo = (props: Props) => {
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
    const { downloadMedia, downloading } = useDownloadMedia();
    const [isHover, setIsHover] = useState(false);
    const [videoLoaded, setVideoLoaded] = useState(false);
    const [videoSrc, setVideoSrc] = useState<string | undefined>(undefined);
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const video = videoRef.current;

        if (isHover) {
            if (!videoSrc) {
                setVideoSrc(item.url);
            }
            if (video && videoSrc) {
                video.play().catch((err: Error) => {
                    if (err.name !== 'AbortError') console.error('Video play error:', err);
                });
            }
        } else if (video) {
            video.pause();
        }
    }, [isHover, videoSrc, item.url]);

    const handleDownload = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        downloadMedia(
            item.url,
            makeSafeDownloadFilename(null, {
                agentName: agent.name,
                createdAt: item.created_at,
                promptSummary: item.ai?.arguments?.prompt || item.title,
            }),
            true,
        );
    };

    const handleCopyPrompt = () => {
        const prompt = item.ai?.arguments?.prompt;

        if (prompt) {
            navigator.clipboard.writeText(prompt);
            showSuccessToast('Prompt copied to clipboard');
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
    const originalFileUrl = relatedFileId && filesBaseUrl ? `${filesBaseUrl}/download/${relatedFileId}` : undefined;

    const handleDownloadOriginal = () => {
        if (originalFileUrl) {
            downloadMedia(
                originalFileUrl,
                `original-${makeSafeDownloadFilename(null, {
                    agentName: agent.name,
                    createdAt: item.created_at,
                    promptSummary: item.ai?.arguments?.prompt || item.title,
                })}`,
                true,
            );
        }
    };

    const handleLikeItemClicked = (likesCount: number, isLikedByThisUser: boolean) => {
        onLikeItemClicked?.({ ...item, isLikedByThisUser, likes_count: likesCount });
    };

    const aspectRatio = item.meta?.aspect_ratio && item.meta.aspect_ratio > 0 ? item.meta.aspect_ratio : 1;

    if (item.isRunning || !item.url) {
        return (
            <div className="gallery-image-wrapper h-full w-full" style={{ aspectRatio }}>
                <div className="flex h-full w-full items-center justify-center bg-card">
                    <Spinner className="scale-[1.5]" />
                </div>
            </div>
        );
    }

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <div
                    className="gallery-image-wrapper video-wrapper h-full w-full"
                    style={{ aspectRatio }}
                    onMouseEnter={() => setIsHover(true)}
                    onMouseLeave={() => setIsHover(false)}
                >
                    <div className="video-with-thumbnail h-full w-full cursor-pointer" onClick={onImageClicked}>
                        <img
                            className={`gallery-image-thumbnail ${videoLoaded ? 'hidden' : 'block'}`}
                            src={`${item.url}?thumbnail=true`}
                            alt={item.title}
                        />
                        <video
                            ref={videoRef}
                            className={`gallery-video-player ${videoLoaded ? 'block' : 'hidden'}`}
                            src={videoSrc}
                            muted
                            loop
                            playsInline
                            preload="none"
                            onLoadedData={() => setVideoLoaded(true)}
                            onCanPlay={() => setVideoLoaded(true)}
                        />
                    </div>
                    <div className="actions-top flex items-center justify-end gap-2 p-2">
                        <Button
                            variant="black"
                            size="icon-sm"
                            className="on-hover download-button rounded-full"
                            disabled={downloading}
                            onClick={handleDownload}
                        >
                            {downloading ? <Spinner className="size-4" /> : <DownloadIcon />}
                        </Button>
                        {onEditItemClicked && (
                            <Button
                                variant="black"
                                size="icon-sm"
                                className="on-hover edit-button rounded-full"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onEditItemClicked(item);
                                }}
                            >
                                <PencilIcon />
                            </Button>
                        )}
                        {onViewItemClicked && (
                            <Button
                                variant="black"
                                size="icon-sm"
                                className="on-hover view-button rounded-full"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onViewItemClicked(item);
                                }}
                            >
                                <SquareArrowOutUpRightIcon />
                            </Button>
                        )}
                        {item.isMyItem && onDeleteItemClicked && (
                            <Button
                                variant="black"
                                size="icon-sm"
                                className="on-hover delete-button rounded-full"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onDeleteItemClicked(item);
                                }}
                            >
                                <TrashIcon />
                            </Button>
                        )}
                    </div>
                    {item.creator_name ? (
                        <div className="actions-bottom flex items-center justify-between gap-1 p-3">
                            <RouterLink
                                to={`/agent/${agent.slug}/user/${item.creator_id}`}
                                className="cursor-pointer truncate text-sm font-medium text-(--white) hover:underline"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {item.creator_name}
                            </RouterLink>
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
                    ) : null}
                </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-48">
                {item.ai?.arguments?.prompt ? (
                    <ContextMenuItem onClick={handleCopyPrompt}>
                        <ClipboardIcon className="size-4" />
                        <span>Copy Prompt</span>
                    </ContextMenuItem>
                ) : null}
                <ContextMenuItem onClick={handleCopyLink}>
                    <LinkIcon className="size-4" />
                    <span>Copy Link</span>
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                    disabled={downloading}
                    onClick={(e) => handleDownload(e as unknown as React.MouseEvent)}
                >
                    {downloading ? <Spinner className="size-4" /> : <DownloadIcon className="size-4" />}
                    <span>Download</span>
                </ContextMenuItem>
                {originalFileUrl ? (
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
                {onViewItemClicked ? (
                    <ContextMenuItem onClick={() => onViewItemClicked(item)}>
                        <SquareArrowOutUpRightIcon className="size-4" />
                        <span>Open</span>
                    </ContextMenuItem>
                ) : null}
                {item.isMyItem && onDeleteItemClicked ? (
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
    );
};

export default GalleryVideo;
