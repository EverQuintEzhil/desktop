import { ChevronLeftIcon, ChevronRightIcon, XIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
import { cn } from '@/lib/utils';
import type { FileType } from '@/types/chat';

interface Props {
    images: FileType[];
    startIndex: number;
    isOpen: boolean;
    onClose: () => void;
}

const UploadedImagesCarousel = ({ images, startIndex, isOpen, onClose }: Props) => {
    const [api, setApi] = useState<CarouselApi>();
    const [currentIndex, setCurrentIndex] = useState(startIndex);
    const [canScrollPrev, setCanScrollPrev] = useState(false);
    const [canScrollNext, setCanScrollNext] = useState(false);

    useEffect(() => {
        if (!api || !isOpen) return;
        api.scrollTo(startIndex, true);
        setCurrentIndex(startIndex);
    }, [api, isOpen, startIndex]);

    useEffect(() => {
        if (!api) return;

        const onSelect = () => {
            setCurrentIndex(api.selectedScrollSnap());
            setCanScrollPrev(api.canScrollPrev());
            setCanScrollNext(api.canScrollNext());
        };

        onSelect();
        api.on('select', onSelect);
        api.on('reInit', onSelect);

        return () => {
            api.off('select', onSelect);
            api.off('reInit', onSelect);
        };
    }, [api]);

    useEffect(() => {
        if (!isOpen || !api) return;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                api.scrollPrev();
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                api.scrollNext();
            }
        };

        document.addEventListener('keydown', onKeyDown, true);

        return () => document.removeEventListener('keydown', onKeyDown, true);
    }, [isOpen, api]);

    if (!isOpen || images.length === 0) return null;

    return createPortal(
        <div className="fixed inset-0 z-200 flex flex-col items-center bg-black py-3" onClick={onClose}>
            <div className="flex min-h-[46px] w-full items-center justify-end px-4">
                <Button
                    variant="ghost"
                    size="icon-sm"
                    className="z-201 rounded-full text-white/75 hover:bg-white/12 hover:text-white"
                    onClick={onClose}
                    aria-label="Close preview"
                >
                    <XIcon />
                </Button>
            </div>

            <Carousel
                setApi={setApi}
                opts={{ loop: false }}
                className="h-full max-h-[calc(100svh-40px-37px-88px-48px)] min-h-0 w-full flex-1 py-6"
            >
                <CarouselContent className="ml-0!">
                    {images.map((image, idx) => (
                        <CarouselItem
                            key={`preview-carousel-${image._id ?? idx}`}
                            className="flex items-center justify-center pl-0!"
                        >
                            <div
                                className="flex max-h-[75svh] items-center justify-center px-[68px] max-md:w-full max-md:px-0"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <img
                                    src={image.url}
                                    alt={image.name}
                                    className="block max-h-[75svh] max-w-full object-contain max-md:w-full"
                                />
                            </div>
                        </CarouselItem>
                    ))}
                </CarouselContent>
            </Carousel>

            {images.length > 1 && (
                <>
                    <div
                        className="absolute top-1/2 left-4 z-201 h-11 w-11 -translate-y-1/2"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.preventDefault()}
                    >
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                                'h-11 w-11 rounded-full text-white/80',
                                'transition-[background,color,opacity] duration-200',
                                'hover:bg-white/15 hover:text-white',
                                'disabled:cursor-default disabled:opacity-25',
                            )}
                            onClick={() => api?.scrollPrev()}
                            disabled={!canScrollPrev}
                            aria-label="Previous image"
                        >
                            <ChevronLeftIcon className="size-6" />
                        </Button>
                    </div>
                    <div
                        className="absolute top-1/2 right-4 z-201 h-11 w-11 -translate-y-1/2"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.preventDefault()}
                    >
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                                'h-11 w-11 rounded-full text-white/80',
                                'transition-[background,color,opacity] duration-200',
                                'hover:bg-white/15 hover:text-white',
                                'disabled:cursor-default disabled:opacity-25',
                            )}
                            onClick={() => api?.scrollNext()}
                            disabled={!canScrollNext}
                            aria-label="Next image"
                        >
                            <ChevronRightIcon className="size-6" />
                        </Button>
                    </div>
                </>
            )}

            {images.length > 1 && (
                <div className="z-201 flex min-h-[150px] items-start" onClick={(e) => e.stopPropagation()}>
                    <div className="flex w-[50vw] flex-wrap items-center justify-center gap-1.5 max-lg:w-full max-lg:max-w-[810px] max-lg:px-4">
                        {images.map((image, idx) => (
                            <button
                                key={`preview-carousel-${image._id ?? idx}`}
                                className={cn(
                                    'h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded-lg bg-none p-0',
                                    'border border-transparent shadow-[0px_0px_1px_1px_rgba(255,255,255,0.95)]',
                                    'opacity-[0.55] transition-[opacity,border-color,transform] duration-200',
                                    idx === currentIndex ? 'scale-110 border-white opacity-100' : 'hover:opacity-85',
                                )}
                                onClick={() => api?.scrollTo(idx)}
                                aria-label={`Go to image ${idx + 1}`}
                            >
                                <img src={image.url} alt={image.name} className="block h-full w-full object-cover" />
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>,
        document.body,
    );
};

export default UploadedImagesCarousel;
