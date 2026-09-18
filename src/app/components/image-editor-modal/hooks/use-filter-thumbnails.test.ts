import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { BasicFilterOption } from '../components/filter/basic-filters';
import type { LutFilterOption } from '../components/filter/lut-filters';

import { useFilterThumbnails } from './use-filter-thumbnails';

// Canvas is the boundary here: jsdom implements neither `getContext` nor WebGL,
// so the real generators can only ever produce the error path. Stubbing them is
// the only way to reach the success and cache branches.
vi.mock('../utils/generate-filter-thumbnail', () => ({
    generateDuotoneThumbnail: vi.fn(),
    generateLutThumbnail: vi.fn(),
}));

vi.mock('../utils/filter-utils', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../utils/filter-utils')>()),
    loadLutTexture: vi.fn(),
}));

const { generateDuotoneThumbnail, generateLutThumbnail } = await import('../utils/generate-filter-thumbnail');
const { loadLutTexture } = await import('../utils/filter-utils');

const basic = (id: string): BasicFilterOption =>
    ({
        id,
        label: id,
        category: 'duotone',
        duotone: { darkColor: '#000000', lightColor: '#ffffff' },
        dataCy: id,
    }) as BasicFilterOption;

const lut = (id: string): LutFilterOption => ({
    id,
    label: id,
    category: 'lut',
    lutUri: `data:image/png;base64,${id}`,
    tilesX: 8,
    tilesY: 8,
    dataCy: id,
});

const texture = {
    pixels: new Uint8ClampedArray(4),
    width: 1,
    height: 1,
    tilesX: 1,
    tilesY: 1,
    lutSize: 1,
};

const NONE_BASIC: BasicFilterOption[] = [];
const NONE_LUT: LutFilterOption[] = [];

let urlSeed = 0;
let lutSeed = 0;

/**
 * Call this once per test and hold the result: `useFilterThumbnails` keys its
 * generation effect on the url and the filter arrays, so a value computed inside
 * the render callback re-triggers the effect on every render.
 */
const uniqueUrl = () => {
    urlSeed += 1;

    return `https://files.localhost/image-${urlSeed}.png`;
};

/**
 * `lutCache` is module-level and keyed by filter id alone, so two tests sharing
 * an id would share a cache entry and make `loadLutTexture` call counts depend
 * on declaration order. A fresh id per test keeps them independent.
 */
const uniqueLut = () => {
    lutSeed += 1;

    return lut(`lut-${lutSeed}`);
};

describe('useFilterThumbnails', () => {
    beforeEach(() => {
        vi.mocked(generateDuotoneThumbnail).mockResolvedValue('blob:duotone');
        vi.mocked(generateLutThumbnail).mockResolvedValue('blob:lut');
        vi.mocked(loadLutTexture).mockResolvedValue(texture);
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        // `restoreAllMocks` only unwinds `vi.spyOn`; the `vi.fn()`s created by the
        // `vi.mock` factories above keep their call history without this.
        vi.clearAllMocks();
        vi.restoreAllMocks();
    });

    it('does nothing without an image url', () => {
        const filters = [basic('a')];
        const { result } = renderHook(() => useFilterThumbnails(null, filters, NONE_LUT));

        expect(generateDuotoneThumbnail).not.toHaveBeenCalled();
        expect(result.current.getThumbnailUrl('a')).toBeNull();
        expect(result.current.allBasicLoaded).toBe(false);
    });

    it('generates a thumbnail per basic filter and reports them all loaded', async () => {
        const filters = [basic('a'), basic('b')];
        const url = uniqueUrl();
        const { result } = renderHook(() => useFilterThumbnails(url, filters, NONE_LUT));

        await waitFor(() => {
            expect(result.current.allBasicLoaded).toBe(true);
        });
        expect(result.current.getThumbnailUrl('a')).toBe('blob:duotone');
        expect(result.current.getThumbnailUrl('b')).toBe('blob:duotone');
        expect(result.current.hasError('a')).toBe(false);
    });

    it('records a basic generation failure instead of throwing', async () => {
        vi.mocked(generateDuotoneThumbnail).mockRejectedValue(new Error('no canvas'));

        const filters = [basic('boom')];
        const url = uniqueUrl();
        const { result } = renderHook(() => useFilterThumbnails(url, filters, NONE_LUT));

        await waitFor(() => {
            expect(result.current.hasError('boom')).toBe(true);
        });
        expect(result.current.getThumbnailUrl('boom')).toBeNull();
        expect(result.current.isLoading('boom')).toBe(false);
        expect(result.current.allBasicLoaded).toBe(false);
    });

    it('loads each LUT once and reuses the texture for later images', async () => {
        const sharedLut = uniqueLut();
        const lutFilters = [sharedLut];
        const firstUrl = uniqueUrl();
        const first = renderHook(() => useFilterThumbnails(firstUrl, NONE_BASIC, lutFilters));

        await waitFor(() => {
            expect(first.result.current.getThumbnailUrl(sharedLut.id)).toBe('blob:lut');
        });
        expect(loadLutTexture).toHaveBeenCalledTimes(1);

        const secondUrl = uniqueUrl();
        const second = renderHook(() => useFilterThumbnails(secondUrl, NONE_BASIC, lutFilters));

        await waitFor(() => {
            expect(second.result.current.getThumbnailUrl(sharedLut.id)).toBe('blob:lut');
        });
        expect(loadLutTexture).toHaveBeenCalledTimes(1);
    });

    it('records a LUT failure against that filter only', async () => {
        vi.mocked(loadLutTexture).mockRejectedValue(new Error('bad lut'));

        const brokenLut = uniqueLut();
        const lutFilters = [brokenLut];
        const url = uniqueUrl();
        const { result } = renderHook(() => useFilterThumbnails(url, NONE_BASIC, lutFilters));

        await waitFor(() => {
            expect(result.current.hasError(brokenLut.id)).toBe(true);
        });
    });

    it('serves a repeat request for the same image from the cache', async () => {
        const url = uniqueUrl();
        const filters = [basic('cached')];
        const first = renderHook(() => useFilterThumbnails(url, filters, NONE_LUT));

        await waitFor(() => {
            expect(first.result.current.allBasicLoaded).toBe(true);
        });

        expect(generateDuotoneThumbnail).toHaveBeenCalledTimes(1);

        const second = renderHook(() => useFilterThumbnails(url, filters, NONE_LUT));

        await waitFor(() => {
            expect(second.result.current.getThumbnailUrl('cached')).toBe('blob:duotone');
        });
        expect(generateDuotoneThumbnail).toHaveBeenCalledTimes(1);
    });

    it('regenerates when the source image changes', async () => {
        const filters = [basic('per-image')];
        const { result, rerender } = renderHook(
            ({ url }: { url: string }) => useFilterThumbnails(url, filters, NONE_LUT),
            { initialProps: { url: uniqueUrl() } },
        );

        await waitFor(() => {
            expect(result.current.allBasicLoaded).toBe(true);
        });

        expect(generateDuotoneThumbnail).toHaveBeenCalledTimes(1);

        rerender({ url: uniqueUrl() });

        await waitFor(() => {
            expect(generateDuotoneThumbnail).toHaveBeenCalledTimes(2);
        });
    });

    it('reports unknown filter ids as absent rather than loading', () => {
        const url = uniqueUrl();
        const { result } = renderHook(() => useFilterThumbnails(url, NONE_BASIC, NONE_LUT));

        expect(result.current.getThumbnailUrl('nope')).toBeNull();
        expect(result.current.isLoading('nope')).toBe(false);
        expect(result.current.hasError('nope')).toBe(false);
    });
});
