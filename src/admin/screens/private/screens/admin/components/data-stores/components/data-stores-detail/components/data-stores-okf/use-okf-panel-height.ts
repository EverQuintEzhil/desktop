import { useEffect, type RefObject } from 'react';

const BOTTOM_GAP = 24;
const MIN_HEIGHT = 320;

/**
 * Locks the OKF panel to the space between its own top edge and the viewport bottom,
 * so the explorer and the file body scroll internally instead of growing the page
 * (which otherwise leaves a page scrollbar next to the panel's own).
 *
 * The ancestor flex chain (.tab-content-area) has no bounded height and is shared by
 * every other data store tab, so the height is pinned here on the panel itself.
 * Measuring panel-top → viewport-bottom avoids a guessed chrome offset and adapts when
 * the metabar or tab row wraps. The CSS fallback only applies before the first measure.
 */
export const useOkfPanelHeight = (panelRef: RefObject<HTMLDivElement | null>): void => {
    useEffect(() => {
        const panel = panelRef.current;

        if (!panel) return;

        const update = () => {
            const available = window.innerHeight - panel.getBoundingClientRect().top - BOTTOM_GAP;

            panel.style.setProperty('--okf-panel-h', `${Math.max(MIN_HEIGHT, Math.round(available))}px`);
        };

        update();

        // Only the detail chrome above the panel can move its top edge (the metabar and
        // tab row wrap on narrow widths). Observing that instead of the panel or body
        // keeps the write-then-measure cycle from feeding back into itself.
        const header = document.querySelector<HTMLElement>('.secondary-header');
        const observer = header ? new ResizeObserver(update) : null;

        if (header && observer) observer.observe(header);
        window.addEventListener('resize', update);

        return () => {
            observer?.disconnect();
            window.removeEventListener('resize', update);
            panel.style.removeProperty('--okf-panel-h');
        };
    }, [panelRef]);
};
