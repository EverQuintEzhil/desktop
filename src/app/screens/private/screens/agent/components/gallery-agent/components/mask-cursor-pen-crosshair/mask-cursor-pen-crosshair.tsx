// Unified plus paths so the center intersection is one solid shape (no rect overlap seams).
const OUTER_PLUS_PATH = 'M26 44 H74 V56 H26 Z M44 26 H56 V74 H44 Z';
const INNER_PLUS_PATH = 'M30 48 H70 V52 H30 Z M48 30 H52 V70 H48 Z';

/** Pen tool crosshair: white outer plus + black inner plus (~1px white ring at 24px). */
export const MaskCursorPenCrosshair = () => (
    <g className="mask-cursor-crosshair">
        <path className="mask-cursor-crosshair--outer" d={OUTER_PLUS_PATH} />
        <path className="mask-cursor-crosshair--inner" d={INNER_PLUS_PATH} />
    </g>
);
