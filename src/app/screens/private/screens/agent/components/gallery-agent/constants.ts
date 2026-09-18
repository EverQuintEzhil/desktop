import type { PenSize } from './types';

export const BRUSH_SIZE_RATIO: Record<PenSize, number> = {
    sm: 0.04,
    md: 0.09,
    lg: 0.16,
};

export const PEN_SIZE_RATIO: Record<PenSize, number> = {
    sm: 0.005,
    md: 0.013,
    lg: 0.028,
};

export const PEN_CURSOR_SIZE = 24;
