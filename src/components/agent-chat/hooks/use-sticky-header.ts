import { useState, useEffect, type RefObject } from 'react';

import { getScrollParent } from '@/utils';

type Options = {
    enterAt?: number;
    exitAt?: number;
    // Bounded-height layouts scroll an inner element instead of the window; pass it here,
    // otherwise getScrollParent walks up to an overflow-hidden ancestor that never scrolls.
    scrollRef?: RefObject<HTMLElement | null>;
};

const useStickyHeader = (containerRef: RefObject<HTMLElement | null>, options: Options = {}): boolean => {
    const { enterAt = 0, exitAt = 0, scrollRef } = options;
    const [isSticky, setIsSticky] = useState(false);

    useEffect(() => {
        const container = containerRef.current;
        const explicitScrollEl = scrollRef?.current;

        if (!container && !explicitScrollEl) return;

        const scrollEl = explicitScrollEl ?? getScrollParent(container, window);

        const handleScroll = () => {
            const scrollTop =
                scrollEl === window
                    ? (window.pageYOffset ?? document.documentElement.scrollTop)
                    : (scrollEl as HTMLElement).scrollTop;

            setIsSticky((prev) => (prev ? scrollTop > exitAt : scrollTop > enterAt));
        };

        handleScroll();
        scrollEl.addEventListener('scroll', handleScroll, { passive: true });

        return () => scrollEl.removeEventListener('scroll', handleScroll);
    }, [containerRef, scrollRef, enterAt, exitAt]);

    return isSticky;
};

export default useStickyHeader;
