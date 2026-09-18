import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BASIC_FILTERS } from '../components/filter/basic-filters';
import { LUT_FILTERS } from '../components/filter/lut-filters';
import { EditorProvider, useEditorContext } from '../context/editor-context';

import { useFilterState } from './use-filter-state';

// jsdom has neither Canvas nor WebGL, so the real `loadLutTexture` can only ever
// reject. Stubbing just that one export is what makes the *difference* between a
// resolved and a rejected load observable.
vi.mock('../utils/filter-utils', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../utils/filter-utils')>()),
    loadLutTexture: vi.fn(),
}));

const { loadLutTexture } = await import('../utils/filter-utils');

const BASIC_ID = BASIC_FILTERS[0].id;
const LUT_ID = LUT_FILTERS[0].id;

const TEXTURE = {
    pixels: new Uint8ClampedArray(4),
    width: 1,
    height: 1,
    tilesX: 1,
    tilesY: 1,
    lutSize: 1,
};

const wrapper = ({ children }: { children: ReactNode }) => <EditorProvider>{children}</EditorProvider>;

const renderProbe = () => {
    const recordSnapshot = vi.fn();
    const view = renderHook(
        () => ({
            editor: useEditorContext(),
            filters: useFilterState({ recordSnapshot }),
        }),
        { wrapper },
    );

    return { ...view, recordSnapshot };
};

describe('useFilterState', () => {
    beforeEach(() => {
        vi.mocked(loadLutTexture).mockResolvedValue(TEXTURE);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('reports no selection initially', () => {
        const { result } = renderProbe();

        expect(result.current.filters.selectedFilterLabel).toBeNull();
        expect(result.current.filters.selectedLut).toBeUndefined();
        expect(result.current.filters.selectedDuotone).toBeUndefined();
    });

    it('selecting a basic filter records a snapshot and zeroes the intensity', () => {
        const { result, recordSnapshot } = renderProbe();

        act(() => result.current.filters.handleSelectFilterId(BASIC_ID));

        expect(recordSnapshot).toHaveBeenCalledTimes(1);
        expect(result.current.editor.selectedFilterId).toBe(BASIC_ID);
        expect(result.current.editor.filterIntensity).toBe(0);
        expect(result.current.editor.filterEnabled).toBe(true);
        expect(result.current.filters.selectedFilterLabel).toBe(BASIC_FILTERS[0].label);
    });

    it('selecting a LUT filter keeps the intensity at full', () => {
        const { result } = renderProbe();

        act(() => result.current.filters.handleSelectFilterId(LUT_ID));

        expect(result.current.editor.filterIntensity).toBe(100);
        expect(result.current.filters.selectedFilterLabel).toBe(LUT_FILTERS[0].label);
    });

    it('selecting an unknown filter id falls back to full intensity and no label', () => {
        const { result } = renderProbe();

        act(() => result.current.filters.handleSelectFilterId('filter.unknown'));

        expect(result.current.editor.filterIntensity).toBe(100);
        expect(result.current.filters.selectedFilterLabel).toBeNull();
    });

    it('clearing the selection restores full intensity', () => {
        const { result } = renderProbe();

        act(() => result.current.filters.handleSelectFilterId(BASIC_ID));
        act(() => result.current.filters.handleSelectFilterId(null));

        expect(result.current.editor.selectedFilterId).toBeNull();
        expect(result.current.editor.filterIntensity).toBe(100);
    });

    it('re-selecting the active filter is a no-op and records nothing', () => {
        const { result, recordSnapshot } = renderProbe();

        act(() => result.current.filters.handleSelectFilterId(BASIC_ID));
        recordSnapshot.mockClear();
        act(() => result.current.filters.handleSelectFilterId(BASIC_ID));

        expect(recordSnapshot).not.toHaveBeenCalled();
    });

    it('caches the duotone colours of the selected basic filter', async () => {
        const { result } = renderProbe();

        act(() => result.current.filters.handleSelectFilterId(BASIC_ID));

        await waitFor(() => {
            expect(result.current.filters.selectedDuotone).toEqual(BASIC_FILTERS[0].duotone);
        });
        expect(result.current.filters.duotoneById[BASIC_ID]).toBeDefined();
    });

    it('loads and exposes the LUT texture for the selected filter', async () => {
        const { result } = renderProbe();

        act(() => result.current.filters.handleSelectFilterId(LUT_ID));

        await waitFor(() => {
            expect(result.current.filters.selectedLut).toBe(TEXTURE);
        });
        expect(loadLutTexture).toHaveBeenCalledTimes(1);
    });

    it('records the LUT load failure so it is not retried', async () => {
        vi.mocked(loadLutTexture).mockRejectedValue(new Error('no webgl'));

        const { result } = renderProbe();

        act(() => result.current.filters.handleSelectFilterId(LUT_ID));

        await waitFor(() => {
            expect(loadLutTexture).toHaveBeenCalledTimes(1);
        });

        // Deselecting and re-selecting re-runs the load effect. The recorded
        // failure has to short-circuit it, so the call count must not move.
        act(() => result.current.filters.handleSelectFilterId(null));
        act(() => result.current.filters.handleSelectFilterId(LUT_ID));

        await act(async () => {
            await Promise.resolve();
        });

        expect(loadLutTexture).toHaveBeenCalledTimes(1);
        expect(result.current.filters.selectedLut).toBeUndefined();
        expect(result.current.filters.lutById).toEqual({});
    });

    it('exposes an externally supplied LUT for the selected filter', () => {
        // Keep the background load pending so it cannot overwrite the value the
        // caller pushed in.
        vi.mocked(loadLutTexture).mockReturnValue(new Promise(() => {}));

        const { result } = renderProbe();
        const texture = {
            pixels: new Uint8ClampedArray(4),
            width: 1,
            height: 1,
            tilesX: 1,
            tilesY: 1,
            lutSize: 1,
        };

        act(() => result.current.filters.handleSelectFilterId(LUT_ID));
        act(() => result.current.filters.setLutById({ [LUT_ID]: texture }));

        expect(result.current.filters.selectedLut).toBe(texture);
    });

    it('toggles the filter on and off, recording each flip', () => {
        const { result, recordSnapshot } = renderProbe();

        act(() => result.current.filters.handleToggleFilter());

        expect(result.current.editor.filterEnabled).toBe(false);

        act(() => result.current.filters.handleToggleFilter());

        expect(result.current.editor.filterEnabled).toBe(true);
        expect(recordSnapshot).toHaveBeenCalledTimes(2);
    });

    it('resets the selection, the toggle and the intensity together', () => {
        const { result, recordSnapshot } = renderProbe();

        act(() => result.current.filters.handleSelectFilterId(BASIC_ID));
        act(() => result.current.filters.handleToggleFilter());
        recordSnapshot.mockClear();

        act(() => result.current.filters.handleResetFilters());

        expect(recordSnapshot).toHaveBeenCalledTimes(1);
        expect(result.current.editor.selectedFilterId).toBeNull();
        expect(result.current.editor.filterEnabled).toBe(true);
        expect(result.current.editor.filterIntensity).toBe(100);
    });
});
