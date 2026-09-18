import type { RefObject } from 'react';
import { useLayoutEffect, useRef, useState } from 'react';

// Width the "+N" overflow button needs, including the gap in front of it: a
// `h-7 px-2.5 text-xs` pill is ~36px wide at two digits.
const OVERFLOW_RESERVE_WIDTH = 44;
const CHIP_GAP = 8;

// Every row ends in its own dismiss button: a `size-6` icon button plus the gap in front of it.
const DISMISS_RESERVE_WIDTH = 24 + CHIP_GAP;

export const countFittedChildren = (container: HTMLElement, children: HTMLElement[]): number => {
    const styles = window.getComputedStyle(container);
    const available =
        container.clientWidth -
        parseFloat(styles.paddingLeft) -
        parseFloat(styles.paddingRight) -
        DISMISS_RESERVE_WIDTH;
    let usedWidth = 0;
    let fittedCount = 0;

    for (let index = 0; index < children.length; index++) {
        const isLast = index === children.length - 1;
        const gap = index > 0 ? CHIP_GAP : 0;
        const needed = usedWidth + children[index].offsetWidth + gap + (isLast ? 0 : OVERFLOW_RESERVE_WIDTH);

        if (needed > available) break;

        usedWidth += children[index].offsetWidth + gap;
        fittedCount++;
    }

    return fittedCount;
};

interface CapabilityOverflow {
    measureRef: RefObject<HTMLDivElement | null>;
    visibleCount: number | null;
}

/** Each row owns its own instance: one measurement container can only describe one row. */
export const useCapabilityOverflow = <T>(items: readonly T[]): CapabilityOverflow => {
    const [visibleCount, setVisibleCount] = useState<number | null>(null);
    const measureRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const container = measureRef.current;

        if (!container || items.length === 0) return;

        const observer = new ResizeObserver(() => {
            const children = Array.from(container.children) as HTMLElement[];

            if (children.length === 0) return;

            // The first measured child is the row label, so the rest are chips. At a width
            // where not even one chip fits, the "+N" button carries all of them rather than
            // the row showing a chip cut in half.
            setVisibleCount(Math.max(0, countFittedChildren(container, children) - 1));
        });

        observer.observe(container);

        return () => observer.disconnect();
    }, [items]);

    return { measureRef, visibleCount };
};
