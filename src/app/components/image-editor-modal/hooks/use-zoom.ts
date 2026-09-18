import { useCallback } from 'react';

import type { ZoomState } from '../types';
import { getNextZoomStep, getPreviousZoomStep } from '../utils';

interface Props {
    zoomState: ZoomState;
    updateZoomState: (updates: Partial<ZoomState>) => void;
}

export const useZoom = (props: Props) => {
    const { zoomState, updateZoomState } = props;

    const handleZoomIn = useCallback(() => {
        const nextZoom = getNextZoomStep(zoomState.level);

        updateZoomState({ level: nextZoom });
    }, [zoomState.level, updateZoomState]);

    const handleZoomOut = useCallback(() => {
        const prevZoom = getPreviousZoomStep(zoomState.level);

        updateZoomState({ level: prevZoom });
    }, [zoomState.level, updateZoomState]);

    const handleZoomChange = useCallback(
        (level: number) => {
            updateZoomState({ level });
        },
        [updateZoomState],
    );

    return {
        handleZoomIn,
        handleZoomOut,
        handleZoomChange,
    };
};

export default useZoom;
