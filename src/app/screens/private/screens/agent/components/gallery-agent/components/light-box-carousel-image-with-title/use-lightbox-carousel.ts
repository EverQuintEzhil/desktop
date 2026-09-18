import { useState, useRef, useEffect, useCallback } from 'react';

import type { CarouselApi } from '@/components/ui/carousel';
import type { GeneratedItem } from '@/types/gallery';

const LOAD_MORE_RANGE = 4;

export interface UseLightboxCarouselProps {
    startIndex?: number;
    isOpen: boolean;
    history?: GeneratedItem[];
    isFetching?: boolean;
    onShowMore?: () => void;
    pages?: number;
    page?: number;
    isVideo: boolean;
}

export interface UseLightboxCarouselResult {
    api: CarouselApi;
    setApi: (api: CarouselApi) => void;
    currentIndex: number;
    isPreviousClickable: boolean;
    isNextClickable: boolean;
    goToPrevImage: () => void;
    goToNextImage: () => void;
    activeVideoRef: React.RefObject<HTMLVideoElement | null>;
}

const useLightboxCarousel = ({
    startIndex,
    isOpen,
    history,
    isFetching = false,
    onShowMore,
    pages = 0,
    page = 0,
    isVideo,
}: UseLightboxCarouselProps): UseLightboxCarouselResult => {
    const [api, setApi] = useState<CarouselApi>();
    const [currentIndex, setCurrentIndex] = useState(Math.max(0, startIndex ?? 0));
    const [isPreviousClickable, setIsPreviousClickable] = useState(false);
    const [isNextClickable, setIsNextClickable] = useState(false);
    const activeVideoRef = useRef<HTMLVideoElement | null>(null);

    const pauseActiveVideo = useCallback(() => {
        if (!isVideo) return;
        const videoEl = activeVideoRef.current;

        if (videoEl && !videoEl.paused) {
            videoEl.pause();
        }
    }, [isVideo]);

    const goToPrevImage = useCallback(() => {
        if (!api || !isPreviousClickable) return;
        pauseActiveVideo();
        api.scrollPrev();
    }, [api, isPreviousClickable, pauseActiveVideo]);

    const goToNextImage = useCallback(() => {
        if (!api || !isNextClickable || isFetching) return;
        pauseActiveVideo();
        api.scrollNext();
    }, [api, isNextClickable, isFetching, pauseActiveVideo]);

    useEffect(() => {
        if (!api) return;

        const onSelect = () => {
            const selectedIndex = api.selectedScrollSnap();

            setCurrentIndex(selectedIndex);
            setIsPreviousClickable(api.canScrollPrev());
            setIsNextClickable(api.canScrollNext());

            const historyLength = history?.length ?? 0;
            const shouldLoadMore =
                onShowMore &&
                !isFetching &&
                selectedIndex >= historyLength - LOAD_MORE_RANGE &&
                selectedIndex <= historyLength - 1 &&
                pages - page > 1;

            if (shouldLoadMore) {
                onShowMore();
            }
        };

        onSelect();
        api.on('select', onSelect);
        api.on('reInit', onSelect);

        return () => {
            api.off('select', onSelect);
            api.off('reInit', onSelect);
        };
    }, [api, history?.length, isFetching, onShowMore, page, pages]);

    useEffect(() => {
        if (!api || !isOpen) return;

        const nextIndex = Math.max(0, startIndex ?? 0);

        api.scrollTo(nextIndex, true);
        setCurrentIndex(nextIndex);
        setIsPreviousClickable(api.canScrollPrev());
        setIsNextClickable(api.canScrollNext());
    }, [api, isOpen, startIndex]);

    return {
        api,
        setApi,
        currentIndex,
        isPreviousClickable,
        isNextClickable,
        goToPrevImage,
        goToNextImage,
        activeVideoRef,
    };
};

export default useLightboxCarousel;
