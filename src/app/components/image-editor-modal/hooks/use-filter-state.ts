import { useCallback, useEffect, useMemo, useState } from 'react';

import { BASIC_FILTERS } from '../components/filter/basic-filters';
import { LUT_FILTERS } from '../components/filter/lut-filters';
import { useEditorContext } from '../context/editor-context';
import type { DuotoneColors, LutTexture } from '../types';
import { loadLutTexture, isBasicFilter, isLutFilter } from '../utils/filter-utils';

export const useFilterState = (params: { recordSnapshot: () => void }) => {
    const { recordSnapshot } = params;
    const { selectedFilterId, setSelectedFilterId, setFilterIntensity, filterEnabled, setFilterEnabled } =
        useEditorContext();

    const [lutById, setLutById] = useState<Record<string, LutTexture>>({});
    const [lutLoadErrorById, setLutLoadErrorById] = useState<Record<string, boolean>>({});
    const [duotoneById, setDuotoneById] = useState<Record<string, DuotoneColors>>({});

    const selectedFilterInfo = useMemo(() => {
        if (!selectedFilterId) return null;

        const basic = BASIC_FILTERS.find((f) => f.id === selectedFilterId);

        if (basic) return { filter: basic, label: basic.label, isBasic: true };

        const lut = LUT_FILTERS.find((f) => f.id === selectedFilterId);

        if (lut) return { filter: lut, label: lut.label, isBasic: false };

        return null;
    }, [selectedFilterId]);

    const selectedFilterLabel = selectedFilterInfo?.label ?? null;

    const selectedLut = useMemo(
        () => (selectedFilterId ? lutById[selectedFilterId] : undefined),
        [lutById, selectedFilterId],
    );

    const selectedDuotone = useMemo(
        () => (selectedFilterId ? duotoneById[selectedFilterId] : undefined),
        [duotoneById, selectedFilterId],
    );

    const handleResetFilters = useCallback(() => {
        recordSnapshot();
        setSelectedFilterId(null);
        setFilterEnabled(true);
        setFilterIntensity(100);
    }, [recordSnapshot, setFilterIntensity, setFilterEnabled, setSelectedFilterId]);

    const handleToggleFilter = useCallback(() => {
        recordSnapshot();
        setFilterEnabled(!filterEnabled);
    }, [recordSnapshot, filterEnabled, setFilterEnabled]);

    const handleSelectFilterId = useCallback(
        (filterId: string | null) => {
            if (filterId === selectedFilterId) {
                return;
            }

            recordSnapshot();
            setSelectedFilterId(filterId);
            setFilterEnabled(true);

            if (!filterId) {
                setFilterIntensity(100);

                return;
            }

            if (isBasicFilter(filterId)) {
                setFilterIntensity(0);

                return;
            }

            if (isLutFilter(filterId)) {
                setFilterIntensity(100);

                return;
            }

            setFilterIntensity(100);
        },
        [recordSnapshot, selectedFilterId],
    );

    useEffect(() => {
        if (!selectedFilterId) return;
        if (lutById[selectedFilterId]) return;
        if (lutLoadErrorById[selectedFilterId]) return;

        const selected = LUT_FILTERS.find((filter) => filter.id === selectedFilterId);

        if (!selected) return;

        let cancelled = false;

        loadLutTexture(selected)
            .then((lutTexture: LutTexture) => {
                if (cancelled) return;
                setLutById((prev) => ({
                    ...prev,
                    [selected.id]: lutTexture,
                }));
            })
            .catch(() => {
                if (cancelled) return;
                setLutLoadErrorById((prev) => ({
                    ...prev,
                    [selected.id]: true,
                }));
            });

        return () => {
            cancelled = true;
        };
    }, [lutById, lutLoadErrorById, selectedFilterId]);

    useEffect(() => {
        if (!selectedFilterId) return;
        if (duotoneById[selectedFilterId]) return;

        const selected = BASIC_FILTERS.find((filter) => filter.id === selectedFilterId);

        if (!selected) return;

        setDuotoneById((prev) => ({
            ...prev,
            [selected.id]: selected.duotone,
        }));
    }, [duotoneById, selectedFilterId]);

    return {
        selectedFilterLabel,
        selectedLut,
        selectedDuotone,
        lutById,
        setLutById,
        duotoneById,
        setDuotoneById,
        handleResetFilters,
        handleToggleFilter,
        handleSelectFilterId,
    };
};
