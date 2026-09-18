import { useCallback, useEffect, useState } from 'react';

import type { BasicFilterOption } from '../components/filter/basic-filters';
import type { LutFilterOption } from '../components/filter/lut-filters';
import type { LutTexture } from '../types';
import { loadLutTexture } from '../utils/filter-utils';
import { generateDuotoneThumbnail, generateLutThumbnail } from '../utils/generate-filter-thumbnail';

const thumbnailCache = new Map<string, string>();

const getCacheKey = (imageUrl: string, filterId: string): string => {
    return `${imageUrl}|${filterId}`;
};

const lutCache = new Map<string, LutTexture>();

interface ThumbnailState {
    url: string | null;
    loading: boolean;
    error: Error | null;
}

export interface FilterThumbnailsResult {
    getThumbnailUrl: (filterId: string) => string | null;
    isLoading: (filterId: string) => boolean;
    hasError: (filterId: string) => boolean;
    allBasicLoaded: boolean;
}

export const useFilterThumbnails = (
    imageUrl: string | null,
    basicFilters: BasicFilterOption[],
    lutFilters: LutFilterOption[],
): FilterThumbnailsResult => {
    const [thumbnailStates, setThumbnailStates] = useState<Map<string, ThumbnailState>>(new Map());

    const generateBasicThumbnail = useCallback(async (filter: BasicFilterOption, imgUrl: string) => {
        const filterId = filter.id;
        const cacheKey = getCacheKey(imgUrl, filterId);

        if (thumbnailCache.has(cacheKey)) {
            setThumbnailStates((prev) => {
                const next = new Map(prev);

                next.set(filterId, {
                    url: thumbnailCache.get(cacheKey) || null,
                    loading: false,
                    error: null,
                });

                return next;
            });

            return;
        }

        setThumbnailStates((prev) => {
            const next = new Map(prev);

            next.set(filterId, { url: null, loading: true, error: null });

            return next;
        });

        try {
            const thumbnailUrl = await generateDuotoneThumbnail(imgUrl, filter.duotone);

            thumbnailCache.set(cacheKey, thumbnailUrl);

            setThumbnailStates((prev) => {
                const next = new Map(prev);

                next.set(filterId, { url: thumbnailUrl, loading: false, error: null });

                return next;
            });
        } catch (error) {
            console.error(`Error generating thumbnail for ${filterId}:`, error);
            setThumbnailStates((prev) => {
                const next = new Map(prev);

                next.set(filterId, {
                    url: null,
                    loading: false,
                    error: error instanceof Error ? error : new Error('Unknown error'),
                });

                return next;
            });
        }
    }, []);

    const generateLutThumbnailAsync = useCallback(async (filter: LutFilterOption, imgUrl: string) => {
        const filterId = filter.id;
        const cacheKey = getCacheKey(imgUrl, filterId);

        if (thumbnailCache.has(cacheKey)) {
            setThumbnailStates((prev) => {
                const next = new Map(prev);

                next.set(filterId, {
                    url: thumbnailCache.get(cacheKey) || null,
                    loading: false,
                    error: null,
                });

                return next;
            });

            return;
        }

        setThumbnailStates((prev) => {
            const next = new Map(prev);

            next.set(filterId, { url: null, loading: true, error: null });

            return next;
        });

        try {
            let lut = lutCache.get(filterId);

            if (!lut) {
                lut = await loadLutTexture(filter);
                lutCache.set(filterId, lut);
            }

            const thumbnailUrl = await generateLutThumbnail(imgUrl, lut);

            thumbnailCache.set(cacheKey, thumbnailUrl);

            setThumbnailStates((prev) => {
                const next = new Map(prev);

                next.set(filterId, { url: thumbnailUrl, loading: false, error: null });

                return next;
            });
        } catch (error) {
            console.error(`Error generating thumbnail for ${filterId}:`, error);
            setThumbnailStates((prev) => {
                const next = new Map(prev);

                next.set(filterId, {
                    url: null,
                    loading: false,
                    error: error instanceof Error ? error : new Error('Unknown error'),
                });

                return next;
            });
        }
    }, []);

    useEffect(() => {
        setThumbnailStates(new Map());
    }, [imageUrl]);

    useEffect(() => {
        if (!imageUrl) return;

        basicFilters.forEach((filter) => {
            generateBasicThumbnail(filter, imageUrl);
        });

        let cancelled = false;

        const generateLutThumbnails = async () => {
            for (const filter of lutFilters) {
                if (cancelled) break;
                await generateLutThumbnailAsync(filter, imageUrl);
                await new Promise((resolve) => setTimeout(resolve, 50));
            }
        };

        generateLutThumbnails();

        return () => {
            cancelled = true;
        };
    }, [imageUrl, basicFilters, lutFilters, generateBasicThumbnail, generateLutThumbnailAsync]);

    const getThumbnailUrl = useCallback(
        (filterId: string): string | null => {
            return thumbnailStates.get(filterId)?.url || null;
        },
        [thumbnailStates],
    );

    const isLoading = useCallback(
        (filterId: string): boolean => {
            return thumbnailStates.get(filterId)?.loading || false;
        },
        [thumbnailStates],
    );

    const hasError = useCallback(
        (filterId: string): boolean => {
            return !!thumbnailStates.get(filterId)?.error;
        },
        [thumbnailStates],
    );

    const allBasicLoaded = basicFilters.every((filter) => {
        const state = thumbnailStates.get(filter.id);

        return state && !state.loading && state.url !== null;
    });

    return {
        getThumbnailUrl,
        isLoading,
        hasError,
        allBasicLoaded,
    };
};
