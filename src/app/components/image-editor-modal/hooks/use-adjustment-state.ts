import { useCallback } from 'react';

import { useEditorContext } from '../context/editor-context';
import type { Adjustments } from '../types';
import { defaultAdjustments } from '../utils/adjustment-utils';

export const useAdjustmentState = (params: { recordSnapshot: () => void }) => {
    const { recordSnapshot } = params;
    const { adjustments, setAdjustments, adjustmentsEnabled, setAdjustmentsEnabled } = useEditorContext();

    const handleResetAdjustments = useCallback(() => {
        recordSnapshot();
        setAdjustments(defaultAdjustments);
    }, [recordSnapshot, setAdjustments]);

    const handleToggleAdjustments = useCallback(() => {
        recordSnapshot();
        setAdjustmentsEnabled((prev) => !prev);
    }, [recordSnapshot, setAdjustmentsEnabled]);

    const updateAdjustment = useCallback(
        (key: keyof Adjustments, value: number) => {
            setAdjustments((prev) => ({
                ...prev,
                [key]: value,
            }));
        },
        [setAdjustments],
    );

    return {
        adjustments,
        adjustmentsEnabled,
        handleResetAdjustments,
        handleToggleAdjustments,
        updateAdjustment,
    };
};
