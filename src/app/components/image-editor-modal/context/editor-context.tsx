import React, { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';

import { DEFAULT_CROP_STATE, DEFAULT_ZOOM_STATE } from '../constants';
import type { Adjustments, CropState, ZoomState } from '../types';
import { defaultAdjustments } from '../utils/adjustment-utils';

export interface EditorContextValue {
    cropState: CropState;
    setCropState: React.Dispatch<React.SetStateAction<CropState>>;
    updateCropState: (updates: Partial<CropState>) => void;
    resetCropState: () => void;

    zoomState: ZoomState;
    setZoomState: React.Dispatch<React.SetStateAction<ZoomState>>;
    updateZoomState: (updates: Partial<ZoomState>) => void;
    resetZoomState: () => void;

    adjustments: Adjustments;
    setAdjustments: React.Dispatch<React.SetStateAction<Adjustments>>;
    updateAdjustments: (updates: Partial<Adjustments>) => void;
    resetAdjustments: () => void;
    adjustmentsEnabled: boolean;
    setAdjustmentsEnabled: React.Dispatch<React.SetStateAction<boolean>>;
    toggleAdjustmentsEnabled: () => void;

    selectedFilterId: string | null;
    setSelectedFilterId: React.Dispatch<React.SetStateAction<string | null>>;
    filterIntensity: number;
    setFilterIntensity: React.Dispatch<React.SetStateAction<number>>;
    filterEnabled: boolean;
    setFilterEnabled: React.Dispatch<React.SetStateAction<boolean>>;
    updateFilterState: (updates: {
        selectedFilterId?: string | null;
        filterIntensity?: number;
        filterEnabled?: boolean;
    }) => void;
    resetFilterState: () => void;
    toggleFilterEnabled: () => void;
}

const EditorContext = createContext<EditorContextValue | undefined>(undefined);

export interface EditorProviderProps {
    children: ReactNode;
    initialCropState?: CropState;
    initialZoomState?: ZoomState;
    initialAdjustments?: Adjustments;
    initialAdjustmentsEnabled?: boolean;
    initialSelectedFilterId?: string | null;
    initialFilterIntensity?: number;
    initialFilterEnabled?: boolean;
}

export const EditorProvider = (props: EditorProviderProps) => {
    const {
        children,
        initialCropState = DEFAULT_CROP_STATE,
        initialZoomState = DEFAULT_ZOOM_STATE,
        initialAdjustments = defaultAdjustments,
        initialAdjustmentsEnabled = true,
        initialSelectedFilterId = null,
        initialFilterIntensity = 100,
        initialFilterEnabled = true,
    } = props;
    const [cropState, setCropState] = useState<CropState>(initialCropState);
    const [zoomState, setZoomState] = useState<ZoomState>(initialZoomState);
    const [adjustments, setAdjustments] = useState<Adjustments>(initialAdjustments);
    const [adjustmentsEnabled, setAdjustmentsEnabled] = useState(initialAdjustmentsEnabled);
    const [selectedFilterId, setSelectedFilterId] = useState<string | null>(initialSelectedFilterId);
    const [filterIntensity, setFilterIntensity] = useState(initialFilterIntensity);
    const [filterEnabled, setFilterEnabled] = useState(initialFilterEnabled);

    const updateCropState = useCallback((updates: Partial<CropState>) => {
        setCropState((prev) => ({ ...prev, ...updates }));
    }, []);

    const resetCropState = useCallback(() => {
        setCropState(DEFAULT_CROP_STATE);
    }, []);

    const updateZoomState = useCallback((updates: Partial<ZoomState>) => {
        setZoomState((prev) => ({ ...prev, ...updates }));
    }, []);

    const resetZoomState = useCallback(() => {
        setZoomState(DEFAULT_ZOOM_STATE);
    }, []);

    const updateAdjustments = useCallback((updates: Partial<Adjustments>) => {
        setAdjustments((prev) => ({ ...prev, ...updates }));
    }, []);

    const resetAdjustments = useCallback(() => {
        setAdjustments({ ...defaultAdjustments });
    }, []);

    const toggleAdjustmentsEnabled = useCallback(() => {
        setAdjustmentsEnabled((prev) => !prev);
    }, []);

    const updateFilterState = useCallback(
        (updates: { selectedFilterId?: string | null; filterIntensity?: number; filterEnabled?: boolean }) => {
            if (updates.selectedFilterId !== undefined) {
                setSelectedFilterId(updates.selectedFilterId);
            }
            if (updates.filterIntensity !== undefined) {
                setFilterIntensity(updates.filterIntensity);
            }
            if (updates.filterEnabled !== undefined) {
                setFilterEnabled(updates.filterEnabled);
            }
        },
        [],
    );

    const resetFilterState = useCallback(() => {
        setSelectedFilterId(null);
        setFilterIntensity(100);
        setFilterEnabled(true);
    }, []);

    const toggleFilterEnabled = useCallback(() => {
        setFilterEnabled((prev) => !prev);
    }, []);

    const value = useMemo(
        () => ({
            cropState,
            setCropState,
            updateCropState,
            resetCropState,
            zoomState,
            setZoomState,
            updateZoomState,
            resetZoomState,
            adjustments,
            setAdjustments,
            updateAdjustments,
            resetAdjustments,
            adjustmentsEnabled,
            setAdjustmentsEnabled,
            toggleAdjustmentsEnabled,
            selectedFilterId,
            setSelectedFilterId,
            filterIntensity,
            setFilterIntensity,
            filterEnabled,
            setFilterEnabled,
            updateFilterState,
            resetFilterState,
            toggleFilterEnabled,
        }),
        [
            cropState,
            updateCropState,
            resetCropState,
            zoomState,
            updateZoomState,
            resetZoomState,
            adjustments,
            updateAdjustments,
            resetAdjustments,
            adjustmentsEnabled,
            toggleAdjustmentsEnabled,
            selectedFilterId,
            filterIntensity,
            filterEnabled,
            updateFilterState,
            resetFilterState,
            toggleFilterEnabled,
        ],
    );

    return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
};

export const useEditorContext = (): EditorContextValue => {
    const context = useContext(EditorContext);

    if (!context) {
        throw new Error('useEditorContext must be used within EditorProvider');
    }

    return context;
};
