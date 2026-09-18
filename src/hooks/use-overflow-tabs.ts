import { useLayoutEffect, useRef, useState } from 'react';

// Pixels of slack so tabs collapse slightly early rather than clipping at the edge.
const SAFETY_PX = 4;
// Fallback width for the "More" trigger before it has been measured.
const MORE_FALLBACK_PX = 72;

/**
 * Priority+ ("okayNav") measurement hook.
 *
 * The caller renders every tab in an always-present hidden ghost row so widths
 * are known even for tabs that are currently collapsed (tab sets are dynamic —
 * gated by permissions/agent flags that resolve async). A ResizeObserver on the
 * parent-sized container recomputes how many tabs fit; the rest go into "More".
 */
export const useOverflowTabs = <GhostElement extends HTMLElement = HTMLUListElement>(itemCount: number) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const ghostRef = useRef<GhostElement>(null);
    const moreRef = useRef<HTMLDivElement>(null);
    // Start with everything visible — the layout effect corrects down before
    // paint, so first paint never dumps every tab into "More".
    const [visibleCount, setVisibleCount] = useState(itemCount);

    useLayoutEffect(() => {
        const container = containerRef.current;
        const ghost = ghostRef.current;

        if (!container || !ghost) return;

        const rightEdge = (el: HTMLElement) => el.offsetLeft + el.offsetWidth;

        const compute = () => {
            const available = container.clientWidth;

            // Unmeasured (width 0, e.g. first paint / hidden) → keep all visible.
            if (!available) return;

            const items = Array.from(ghost.children) as HTMLElement[];

            if (!items.length) {
                setVisibleCount(0);

                return;
            }

            const totalWidth = rightEdge(items[items.length - 1]);

            // Everything fits — no "More" button needed.
            if (totalWidth <= available - SAFETY_PX) {
                setVisibleCount(items.length);

                return;
            }

            const gap = parseFloat(getComputedStyle(ghost).columnGap || '0') || 0;
            const moreWidth = (moreRef.current?.offsetWidth || MORE_FALLBACK_PX) + gap;
            const budget = available - moreWidth - SAFETY_PX;

            let count = 0;

            while (count < items.length && rightEdge(items[count]) <= budget) {
                count++;
            }

            setVisibleCount(count);
        };

        compute();

        const resizeObserver = new ResizeObserver(compute);

        resizeObserver.observe(container);

        return () => resizeObserver.disconnect();
    }, [itemCount]);

    return {
        containerRef,
        ghostRef,
        moreRef,
        visibleCount,
    };
};
