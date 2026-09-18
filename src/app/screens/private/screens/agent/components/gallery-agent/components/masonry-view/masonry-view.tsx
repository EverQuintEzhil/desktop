import throttle from 'lodash/throttle';
import { FrownIcon, Loader2Icon, TriangleAlertIcon } from 'lucide-react';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';

import './masonry-view.scss';

import { useInfiniteScroll } from '@/app/hooks';
import InfiniteScrollTrigger from '@/components/infinite-scroll-trigger';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { GalleryAgentType, FileType } from '@/types/admin';
import type { GalleryItemActionHandlers, GalleryState, GeneratedItem } from '@/types/gallery';

import type { GalleryTab } from '../../hooks/use-gallery-media-state';
import GalleryImage from '../gallery-image';
import GalleryVideo from '../gallery-video';
import LightBoxCarouselImageWithTitle from '../light-box-carousel-image-with-title';
import type { RemixInputPlusOptions } from '../remix-input';

import { measureLayoutWidth } from './masonry-view.utils';

interface Props extends GalleryItemActionHandlers {
    agent: GalleryAgentType;
    state: GalleryState;
    className?: string;
    isFetching?: boolean;
    onDeleteItemAsyncClicked?: (item: GeneratedItem) => Promise<GeneratedItem[]>;
    onItemChange?: (item: GeneratedItem) => void;
    onShowMore: () => void;
    onRetry: () => Promise<void>;
    isVideo?: boolean;
    onRemix?: (prompt: string, lightboxImage: GeneratedItem, maskUrl?: string, editedFile?: FileType) => void;
    onEditPromptSubmit?: (prompt: string) => void;
    query?: string;
    setQuery?: (value: string) => void;
    plusOptions?: RemixInputPlusOptions;
    currentTab?: GalleryTab;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    onChangeFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
    renderFiles: () => React.ReactNode;
    fileInputDisabled: boolean;
}

const defaultQuotes = [
    "There is no favorable wind for the sailor who doesn't know where to go - Seneca",
    'Luck is what happens when readiness meets opportunity.',
    'They who are brave are free.',
    'No one was ever wise by chance.',
    'Even the smallest person can change the course of history. - Galadriel',
    'A wizard is never late. Nor are they early. They arrive precisely when they mean to. - Gandalf',
    'Let there be light.',
];

function getQuote(quotes?: string[]): string {
    const list = quotes?.length ? quotes : defaultQuotes;
    const randomIndex = Math.floor(Math.random() * list.length);

    return list[randomIndex];
}

const BREAKPOINTS = {
    xs: 575,
    sm: 1023,
    md: 1366,
    lg: 1920,
    '2xl': 2561,
} as const;

const SKELETON_ITEMS_PER_GROUP = 2;
const MASONRY_GAP = 12;

const getColumns = (width: number): number => {
    if (width >= BREAKPOINTS['2xl']) return 6; // 2xl: ≥2561
    if (width >= BREAKPOINTS.lg + 1) return 5; // xl: 1921–2560
    if (width > BREAKPOINTS.md) return 4; // lg: 1367–1920
    if (width > BREAKPOINTS.sm) return 3; // md: 1024–1366
    if (width > BREAKPOINTS.xs) return 2; // sm: 576–1023

    return 1; // xs: <576
};

const getItemKey = (item: GeneratedItem): string => item.uniqueId || item._id;

const getAspectRatio = (item: GeneratedItem): number =>
    item.meta?.aspect_ratio && item.meta.aspect_ratio > 0 ? item.meta.aspect_ratio : 1;

const MasonryView = (props: Props) => {
    const {
        agent,
        state,
        className,
        onShowMore,
        onRetry,
        isFetching,
        isVideo,
        onDeleteItemClicked,
        onDeleteItemAsyncClicked,
        onEditItemClicked,
        onViewItemClicked,
        onLikeItemClicked,
        onItemChange,
        onRemix,
        onEditPromptSubmit,
        query,
        setQuery,
        plusOptions,
        currentTab,
        fileInputRef,
        onChangeFile,
        renderFiles,
        fileInputDisabled,
    } = props;
    const [lightboxImage, setLightboxImage] = useState<GeneratedItem | null>(null);
    const [openLightboxInRemixMode, setOpenLightboxInRemixMode] = useState(false);
    const [quote] = useState(() => getQuote(agent.uiConfig.quotes));

    const [isRetrying, setIsRetrying] = useState(false);

    const [columns, setColumns] = useState<number>(3);
    const [containerWidth, setContainerWidth] = useState<number>(0);

    // Node state, not a ref: the grid div is not mounted in every render branch,
    // so measurement has to re-run whenever it attaches — a mount-time effect
    // would leave the grid unmeasured when the first branch shown is the error
    // or empty state.
    const [masonryNode, setMasonryNode] = useState<HTMLDivElement | null>(null);

    const { loadMoreRef } = useInfiniteScroll({
        loading: state.loading,
        showMoreLoading: state.showMoreLoading,
        hasMore: state.pages - state.page > 1,
        itemsLength: state.history.length,
        onLoadMore: onShowMore,
    });

    const updateMasonryMeasurements = useCallback((node: HTMLDivElement) => {
        // The height written back onto this node feeds the scroll container's
        // scrollbar, which feeds this width — see getLayoutWidth in
        // masonry-view.utils.ts.
        const layoutWidth = measureLayoutWidth(node);

        setContainerWidth(layoutWidth);
        setColumns(getColumns(layoutWidth));
    }, []);

    useLayoutEffect(() => {
        if (!masonryNode) return undefined;

        const throttledCalculate = throttle(() => updateMasonryMeasurements(masonryNode), 300);
        const observer = new ResizeObserver(throttledCalculate);

        observer.observe(masonryNode);
        updateMasonryMeasurements(masonryNode);

        return () => {
            observer.disconnect();
            throttledCalculate.cancel();
        };
    }, [masonryNode, updateMasonryMeasurements]);

    const masonryLayout = useMemo(() => {
        const safeColumns = Math.max(columns, 1);
        const safeContainerWidth = Math.max(containerWidth, 0);
        const columnWidth =
            safeContainerWidth > 0 ? (safeContainerWidth - MASONRY_GAP * (safeColumns - 1)) / safeColumns : 0;
        const columnHeights = Array.from({ length: safeColumns }, () => 0);
        const items = state.history.map((item, index) => {
            const columnIndex = index % safeColumns;
            const itemHeight = columnWidth / getAspectRatio(item);
            const top = columnHeights[columnIndex];
            const left = columnIndex * (columnWidth + MASONRY_GAP);

            columnHeights[columnIndex] += itemHeight + MASONRY_GAP;

            return {
                item,
                left,
                top,
                width: columnWidth,
            };
        });
        const height = state.history.length > 0 ? Math.max(...columnHeights) - MASONRY_GAP : 0;

        return {
            height,
            items,
        };
    }, [columns, containerWidth, state.history]);

    const handleRetry = async () => {
        setIsRetrying(true);
        try {
            await onRetry();
        } finally {
            setIsRetrying(false);
        }
    };

    const openLightbox = (item: GeneratedItem, openRemix = false) => {
        setOpenLightboxInRemixMode(openRemix);
        setLightboxImage(item);
    };

    const closeLightbox = () => {
        setLightboxImage(null);
        setOpenLightboxInRemixMode(false);
    };

    const handleGalleryImageEdit = (item: GeneratedItem) => {
        if (onRemix) {
            openLightbox(item, true);

            return;
        }

        onEditItemClicked?.(item);
    };

    const renderGalleryItem = (item: GeneratedItem) => {
        if (isVideo) {
            return (
                <GalleryVideo
                    item={item}
                    onDeleteItemClicked={onDeleteItemClicked}
                    onEditItemClicked={onEditItemClicked}
                    onViewItemClicked={onViewItemClicked}
                    onLikeItemClicked={onLikeItemClicked}
                    onImageClicked={() => {
                        openLightbox(item);
                    }}
                    currentTab={currentTab}
                    agent={agent}
                />
            );
        }

        return (
            <GalleryImage
                item={item}
                onDeleteItemClicked={onDeleteItemClicked}
                onEditItemClicked={handleGalleryImageEdit}
                onViewItemClicked={onViewItemClicked}
                onLikeItemClicked={onLikeItemClicked}
                onImageClicked={() => {
                    openLightbox(item);
                }}
                currentTab={currentTab}
                agent={agent}
            />
        );
    };

    if (state.loading || !state.isLoadedWithPlaceholders) {
        const skeletonItems = Array.from({ length: SKELETON_ITEMS_PER_GROUP });

        return (
            <div
                ref={setMasonryNode}
                className={['masonry-grid grid gap-3 w-full', className].filter(Boolean).join(' ')}
                style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
            >
                {Array.from({ length: columns }).map((_, colIndex) => (
                    <div key={`skeleton-col-${colIndex}`} className="masonry-column flex flex-col gap-3">
                        {skeletonItems.map((_, itemIndex) => (
                            <Skeleton
                                key={`skeleton-${colIndex}-${itemIndex}`}
                                className="h-[260px] w-full rounded-md bg-card"
                            />
                        ))}
                    </div>
                ))}
            </div>
        );
    }

    if (state.error && state.history.length === 0) {
        return (
            <div className="mx-auto flex w-full max-w-[810px] flex-1 flex-col items-center justify-center gap-4 text-center">
                <TriangleAlertIcon className="size-16 text-text-secondary" aria-hidden="true" />
                <span role="alert" className="leading-[20px] text-text-secondary">
                    {state.error}
                </span>
                <Button variant="secondary" size="sm" onClick={handleRetry} disabled={isRetrying}>
                    {isRetrying ? <Loader2Icon className="size-4 animate-spin" aria-hidden="true" /> : null}
                    Retry
                </Button>
            </div>
        );
    }

    if (state.history.length === 0) {
        return (
            <div className="mx-auto flex w-full max-w-[810px] flex-1 flex-col items-center justify-center gap-6 text-center">
                <FrownIcon className="size-16 text-primary" />
                <div className="flex w-full max-w-sm flex-col items-center justify-center gap-2">
                    <span className="leading-[20px] text-text-secondary">{quote}</span>
                </div>
            </div>
        );
    }

    const renderLightbox = () => {
        if (!lightboxImage) return null;

        return (
            <LightBoxCarouselImageWithTitle
                agent={agent}
                isVideo={isVideo}
                isOpen={lightboxImage ? true : false}
                onClose={closeLightbox}
                onRemix={
                    onRemix
                        ? (prompt: string, imageItem: GeneratedItem, maskUrl?: string, editedFile?: FileType) => {
                              if (onRemix) {
                                  onRemix(prompt, imageItem, maskUrl, editedFile);
                              }
                          }
                        : undefined
                }
                onEditPromptSubmit={onEditPromptSubmit}
                query={query}
                setQuery={setQuery}
                plusOptions={plusOptions}
                isFetching={isFetching}
                onLikeItemClicked={onLikeItemClicked}
                onDeleteItemAsyncClicked={onDeleteItemAsyncClicked}
                onItemChange={onItemChange}
                startIndex={state.history.findIndex((i) => i._id === lightboxImage?._id)}
                totalItems={state.history.length}
                history={state.history as GeneratedItem[]}
                onShowMore={onShowMore}
                pages={state.pages}
                page={state.page}
                fileInputRef={fileInputRef}
                onChangeFile={onChangeFile}
                renderFiles={renderFiles}
                fileInputDisabled={fileInputDisabled}
                openRemixOnMount={openLightboxInRemixMode}
            />
        );
    };

    const isLayoutReady = containerWidth > 0;

    return (
        <>
            <div
                ref={setMasonryNode}
                className={['masonry-grid relative w-full', className].filter(Boolean).join(' ')}
                style={{ height: masonryLayout.height }}
            >
                {isLayoutReady &&
                    masonryLayout.items.map((layoutItem, index) => (
                        <div
                            className="masonry-item absolute flex cursor-pointer items-center justify-center overflow-hidden bg-card transition-shadow duration-200 ease-[ease]"
                            key={getItemKey(layoutItem.item)}
                            style={{
                                transform: `translate3d(${layoutItem.left}px, ${layoutItem.top}px, 0)`,
                                width: layoutItem.width,
                                animationDelay: `${Math.min(index * 40, 400)}ms`,
                            }}
                        >
                            {renderGalleryItem(layoutItem.item)}
                        </div>
                    ))}
            </div>
            {renderLightbox()}
            <InfiniteScrollTrigger
                loadMoreRef={loadMoreRef}
                isLoading={state.showMoreLoading}
                hasMore={state.pages - state.page > 1}
            />
        </>
    );
};

export default MasonryView;
