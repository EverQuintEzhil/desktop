import { CoinsIcon, CropIcon, DownloadIcon, GlobeIcon, ShieldIcon, TrashIcon, XIcon } from 'lucide-react';

import Like from '@/app/components/like';
import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import Spinner from '@/components/ui/spinner';
import Switch from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { GeneratedItem } from '@/types/gallery';

import { TokenUsageDialog } from '../../../../token-usage-dialog';

import { LightboxHeaderMenu } from './lightbox-header-menu';

export interface LightboxHeaderProps {
    isMyItem: boolean;
    currentItem: GeneratedItem | null;
    isVideo: boolean;
    downloadName?: string;
    showCloseButton?: boolean;
    renderHeaderLeft?: () => React.ReactNode;
    showComparisonTabs?: boolean;
    activeTab?: 'original' | 'edited' | 'comparison';
    onActiveTabChange?: (tab: 'original' | 'edited' | 'comparison') => void;
    showRemixInput: boolean;
    setShowRemixInput: (v: boolean) => void;
    isPublic: boolean;
    isPublicLoading: boolean;
    handlePublicChange: (val: boolean) => void;
    onLikeItemClicked?: (item: GeneratedItem) => void;
    handleLikeItemClicked: (likesCount: number, isLikedByThisUser: boolean) => void;
    canSeeUsage: boolean;
    tokenUsageOpen: boolean;
    setTokenUsageOpen: (open: boolean) => void;
    downloading: boolean;
    exporting: boolean;
    copying: boolean;
    downloadMedia: (url: string, name: string, isVideo?: boolean) => void;
    copyImage: (url: string) => void;
    exportImageAs: (url: string, name: string, format: 'jpeg' | 'png' | 'webp') => void;
    handleDownloadClicked: (e: React.MouseEvent) => void;
    onDeleteItemAsyncClicked?: (item: GeneratedItem) => Promise<GeneratedItem[]>;
    onDeleteClicked: (item: GeneratedItem) => void;
    onClose: () => void;
    ellipsisMenuOpen: boolean;
    setEllipsisMenuOpen: (open: boolean) => void;
    setExportMenuOpen: (open: boolean) => void;
}

export const LightboxHeader = (props: LightboxHeaderProps) => {
    const {
        isMyItem,
        currentItem,
        isVideo,
        downloadName,
        showCloseButton = true,
        renderHeaderLeft,
        showComparisonTabs,
        activeTab,
        onActiveTabChange,
        showRemixInput,
        setShowRemixInput,
        isPublic,
        isPublicLoading,
        handlePublicChange,
        onLikeItemClicked,
        handleLikeItemClicked,
        canSeeUsage,
        tokenUsageOpen,
        setTokenUsageOpen,
        downloading,
        exporting,
        copying,
        downloadMedia,
        copyImage,
        exportImageAs,
        handleDownloadClicked,
        onDeleteItemAsyncClicked,
        onDeleteClicked,
        onClose,
        ellipsisMenuOpen,
        setEllipsisMenuOpen,
        setExportMenuOpen,
    } = props;

    const mediaUrl = currentItem?.url;
    const totalTokens = currentItem?.ai?.usage?.total_tokens ?? 0;

    const renderModelName = () => {
        if (!currentItem?.ai?.model_name) return null;

        return (
            <>
                <span className="model-dot h-1 w-1 shrink-0 rounded-circle bg-text-secondary" />
                <span
                    className="model-name max-w-[28ch] truncate font-medium text-(--white)"
                    title={currentItem?.ai?.model_name}
                >
                    {currentItem?.ai?.model_name}
                </span>
            </>
        );
    };

    return (
        <div className="lightbox-header grid w-full items-center justify-between gap-2 px-4">
            <div className="left-options flex items-center gap-2 max-lg:order-3 max-lg:w-full max-lg:justify-center">
                {renderHeaderLeft ? renderHeaderLeft() : null}
                {showComparisonTabs && !showRemixInput && activeTab !== undefined && onActiveTabChange ? (
                    <div className="edit-comparison-tabs flex items-center justify-start max-lg:w-full max-lg:justify-center">
                        <Switch
                            options={[{ label: 'Compare' }, { label: 'Edited' }, { label: 'Original' }]}
                            width={{
                                default: 78,
                            }}
                            activeIndex={(() => {
                                if (activeTab === 'comparison') return 0;
                                if (activeTab === 'edited') return 1;

                                return 2;
                            })()}
                            onChange={(e, index) => {
                                e.stopPropagation();
                                const tabs: Array<'comparison' | 'edited' | 'original'> = [
                                    'comparison',
                                    'edited',
                                    'original',
                                ];

                                onActiveTabChange(tabs[index]);
                            }}
                            color="white"
                        />
                    </div>
                ) : null}
            </div>
            <div className="name-modal flex flex-col items-center justify-center gap-0.5 text-center max-lg:order-1 max-lg:items-start max-lg:text-left">
                <div className="mobile-flex-col flex items-center justify-center gap-2 max-lg:flex-col max-lg:items-start max-lg:gap-0 max-lg:text-left">
                    {currentItem?.creator_name && (
                        <span
                            className="max-w-[20ch] shrink-0 cursor-pointer truncate font-medium text-(--white) hover:underline"
                            title={currentItem.creator_name ?? ''}
                            onClick={(e) => {
                                e.stopPropagation();
                                const basePath = window.location.pathname.replace(/\/$/, '');

                                window.location.href = `${basePath}/user/${currentItem.creator_id}`;
                            }}
                        >
                            {currentItem.creator_name ?? ''}
                        </span>
                    )}
                    {renderModelName()}
                </div>
                {currentItem?.created_at && (
                    <span className="date-updated text-sm font-medium text-text-secondary">
                        {new Date(currentItem.created_at || '').toLocaleDateString('en-US', {
                            month: 'short',
                            day: '2-digit',
                            year: 'numeric',
                        })}
                    </span>
                )}
            </div>
            <div
                className={`right-options flex items-center justify-end gap-2 max-lg:order-2 max-lg:flex-1 ${showRemixInput ? 'hidden' : ''}`}
            >
                <div className="flex items-center justify-center gap-2">
                    {!currentItem?.isRunning && isMyItem && !showRemixInput && (
                        <Switch
                            options={[
                                { label: 'Private', icon: ShieldIcon },
                                { label: 'Public', icon: GlobeIcon },
                            ]}
                            activeIndex={isPublic ? 1 : 0}
                            onChange={(e, index) => {
                                e.stopPropagation();
                                e.preventDefault();
                                if (!isPublicLoading) handlePublicChange(index === 1);
                            }}
                            isLoading={isPublicLoading}
                            color="white"
                            width={{
                                default: 92,
                                sm: 44,
                                xs: 36,
                            }}
                            removeLabelMobile={{
                                sm: true,
                            }}
                        />
                    )}
                    <div className="hide-mobile-carousel flex items-center justify-center gap-2">
                        {!currentItem?.isRunning && onLikeItemClicked && currentItem && !showRemixInput && (
                            <SimpleTooltip content={currentItem.isLikedByThisUser ? 'Unlike' : 'Like'}>
                                <span className="inline-flex">
                                    <Like
                                        key={currentItem._id}
                                        likesCount={currentItem.likes_count ?? 0}
                                        isLikedByThisUser={currentItem.isLikedByThisUser ?? false}
                                        itemId={currentItem._id}
                                        itemType="files"
                                        onLikeItemClicked={handleLikeItemClicked}
                                        disabled={isPublicLoading}
                                    />
                                </span>
                            </SimpleTooltip>
                        )}
                    </div>
                </div>
                <div className="lightbox-button-group flex items-center justify-center gap-3">
                    {canSeeUsage && !currentItem?.isRunning && currentItem?.ai?.usage && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="black"
                                    size="sm"
                                    className="hide-mobile-carousel shrink-0 rounded-full tabular-nums"
                                    aria-label={`View AI Usage (${totalTokens.toLocaleString()} tokens)`}
                                    disabled={showRemixInput}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setTokenUsageOpen(true);
                                    }}
                                >
                                    <CoinsIcon />
                                    {totalTokens.toLocaleString()}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>AI Usage</TooltipContent>
                        </Tooltip>
                    )}
                    {!currentItem?.isRunning && downloadName && mediaUrl && (
                        <SimpleTooltip content={isVideo ? 'Download' : 'Crop Image'}>
                            <Button
                                variant="black"
                                size="icon-sm"
                                className="hide-mobile-carousel rounded-full"
                                aria-label={isVideo ? 'Download' : 'Crop Image'}
                                disabled={downloading || showRemixInput}
                                onClick={handleDownloadClicked}
                            >
                                <CropIcon />
                            </Button>
                        </SimpleTooltip>
                    )}
                    {!currentItem?.isRunning && downloadName && mediaUrl && (
                        <SimpleTooltip content="Download">
                            <Button
                                variant="black"
                                size="icon-sm"
                                className="hide-mobile-carousel rounded-full"
                                aria-label="Download"
                                disabled={(isVideo ? downloading : exporting) || showRemixInput}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (isVideo) {
                                        downloadMedia(mediaUrl, downloadName, true);
                                    } else {
                                        exportImageAs(mediaUrl, downloadName || 'generated-image', 'png');
                                    }
                                }}
                            >
                                {(isVideo ? downloading : exporting) ? (
                                    <Spinner className="size-4" />
                                ) : (
                                    <DownloadIcon />
                                )}
                            </Button>
                        </SimpleTooltip>
                    )}
                    {!currentItem?.isRunning && onDeleteItemAsyncClicked && currentItem && isMyItem && (
                        <SimpleTooltip content="Delete">
                            <Button
                                variant="black"
                                size="icon-sm"
                                className="hide-mobile-carousel rounded-full"
                                aria-label="Delete"
                                disabled={downloading || showRemixInput}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteClicked(currentItem);
                                }}
                            >
                                <TrashIcon />
                            </Button>
                        </SimpleTooltip>
                    )}
                    <LightboxHeaderMenu
                        isMyItem={isMyItem}
                        currentItem={currentItem}
                        isVideo={isVideo}
                        downloadName={downloadName}
                        mediaUrl={mediaUrl}
                        showRemixInput={showRemixInput}
                        isPublicLoading={isPublicLoading}
                        onLikeItemClicked={onLikeItemClicked}
                        handleLikeItemClicked={handleLikeItemClicked}
                        exporting={exporting}
                        copying={copying}
                        copyImage={copyImage}
                        exportImageAs={exportImageAs}
                        handleDownloadClicked={handleDownloadClicked}
                        onDeleteItemAsyncClicked={onDeleteItemAsyncClicked}
                        onDeleteClicked={onDeleteClicked}
                        canSeeUsage={canSeeUsage}
                        setTokenUsageOpen={setTokenUsageOpen}
                        ellipsisMenuOpen={ellipsisMenuOpen}
                        setEllipsisMenuOpen={setEllipsisMenuOpen}
                        setExportMenuOpen={setExportMenuOpen}
                    />
                    {showCloseButton && (
                        <SimpleTooltip content="Close">
                            <Button
                                variant="black"
                                size="icon-sm"
                                className="rounded-full"
                                aria-label="Close"
                                disabled={showRemixInput}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onClose();
                                }}
                            >
                                <XIcon />
                            </Button>
                        </SimpleTooltip>
                    )}
                </div>
            </div>
            {showRemixInput && (
                <div className="right-options flex items-center justify-end gap-2 max-lg:order-2 max-lg:flex-1">
                    <SimpleTooltip content="Close">
                        <Button
                            variant="black"
                            size="icon-sm"
                            className="rounded-full"
                            aria-label="Close"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowRemixInput(false);
                            }}
                        >
                            <XIcon />
                        </Button>
                    </SimpleTooltip>
                </div>
            )}
            {canSeeUsage && currentItem?.ai?.usage ? (
                <TokenUsageDialog
                    open={tokenUsageOpen}
                    onOpenChange={setTokenUsageOpen}
                    usage={currentItem.ai.usage}
                    model={currentItem?.ai?.model_name}
                />
            ) : null}
        </div>
    );
};
