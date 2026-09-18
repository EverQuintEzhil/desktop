import { type RefObject, useEffect } from 'react';

/**
 * The tabs bar is `sticky top-0`, so a tab's own sticky search bar needs the bar's height to
 * pin flush underneath it. The bar is `flex-wrap` and drops the "chats are private" note onto
 * a second row on narrow viewports, so the height is measured rather than hardcoded and
 * published as `--space-tabs-h` on the region for the tab content to read.
 */
export const useStickyTabsOffset = (
    regionRef: RefObject<HTMLElement | null>,
    barRef: RefObject<HTMLElement | null>,
    // The region only mounts once the space has loaded, so gate on `ready` and keep it in the
    // deps. Without it the effect's single run happens while both refs are still null.
    ready: boolean,
): void => {
    useEffect(() => {
        if (!ready) return undefined;

        const region = regionRef.current;
        const bar = barRef.current;

        if (!region || !bar) return undefined;

        // ResizeObserver fires once on observe(), which covers the initial measurement.
        const ro = new ResizeObserver(() => {
            // Floor, not round: pinning up to 1px too high tucks the strip's edge under the
            // tabs bar (z-2, painted over it), while rounding up would leave a hairline gap
            // for list rows to scroll through.
            const height = Math.floor(bar.getBoundingClientRect().height);

            region.style.setProperty('--space-tabs-h', `${height}px`);
        });

        ro.observe(bar);

        return () => {
            ro.disconnect();
            region.style.removeProperty('--space-tabs-h');
        };
    }, [regionRef, barRef, ready]);
};
