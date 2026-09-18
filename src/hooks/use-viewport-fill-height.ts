import { type RefObject, useEffect } from 'react';

interface UseViewportFillHeightOptions {
    /**
     * CSS custom property to set on `ref`. Consume it in CSS/Tailwind with a calc()
     * fallback, e.g. `height: var(--my-h, calc(100svh - 120px))`, so the first paint
     * (before this measures) and any offscreen state degrade gracefully.
     */
    cssVar: string;
    /**
     * Selector (within `ref`) for the element whose top defines the fill region.
     * Defaults to `ref` itself. Pass this when `ref` has padding/chrome ABOVE the
     * content being sized (e.g. a tab wrapper with top padding) so the measured top
     * is the content's top, not the wrapper's border-box top.
     */
    measureSelector?: string;
    /** px subtracted from the viewport bottom — typically the container's own bottom padding. */
    bottomGap?: number;
    /** Below this computed height the var is dropped so the CSS fallback applies (offscreen / collapsed / 0-height first frame). */
    minHeight?: number;
}

/**
 * Sets a CSS variable on `ref` equal to the space from the measured element's top
 * to the viewport bottom, so a panel fills the viewport instead of relying on a
 * hardcoded `calc(100svh - Npx)` whose offset is only correct on one layout. The
 * fixed calc stays as the CSS fallback; this just makes the live value adapt to the
 * actual chrome above the element (which differs per page).
 */
export const useViewportFillHeight = (
    ref: RefObject<HTMLElement | null>,
    { cssVar, measureSelector, bottomGap = 0, minHeight = 200 }: UseViewportFillHeightOptions,
): void => {
    useEffect(() => {
        const el = ref.current;

        if (!el) return;

        let last = -1;

        const update = () => {
            const measureEl = measureSelector ? (el.querySelector<HTMLElement>(measureSelector) ?? el) : el;
            const top = measureEl.getBoundingClientRect().top;
            const h = Math.round(window.innerHeight - top - bottomGap);

            if (h <= minHeight) {
                if (last !== -1) {
                    el.style.removeProperty(cssVar);
                    last = -1;
                }

                return;
            }

            // Guard re-writing the same value: prevents a ResizeObserver loop when
            // our own height write resizes the observed element.
            if (h !== last) {
                el.style.setProperty(cssVar, `${h}px`);
                last = h;
            }
        };

        update();

        const ro = new ResizeObserver(update);

        ro.observe(el);
        window.addEventListener('resize', update);

        return () => {
            ro.disconnect();
            window.removeEventListener('resize', update);
            el.style.removeProperty(cssVar);
        };
    }, [ref, cssVar, measureSelector, bottomGap, minHeight]);
};
