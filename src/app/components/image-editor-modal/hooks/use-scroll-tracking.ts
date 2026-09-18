import { useEffect, useRef, useState } from 'react';

interface UseScrollTrackingParams {
    scrollAreaRef: React.RefObject<HTMLDivElement | null>;
    handleWheel: (e: WheelEvent) => void;
}

export const useScrollTracking = (params: UseScrollTrackingParams) => {
    const { scrollAreaRef, handleWheel } = params;
    const scrollPosRef = useRef<{ left: number; top: number }>({ left: 0, top: 0 });
    const [scrollVersion, setScrollVersion] = useState(0);
    const scrollRafRef = useRef<number | null>(null);

    useEffect(() => {
        const scrollArea = scrollAreaRef.current;

        if (!scrollArea) return;

        scrollArea.addEventListener('wheel', handleWheel, { passive: false });

        const handleScroll = () => {
            scrollPosRef.current = { left: scrollArea.scrollLeft, top: scrollArea.scrollTop };

            if (scrollRafRef.current !== null) return;

            scrollRafRef.current = requestAnimationFrame(() => {
                scrollRafRef.current = null;
                setScrollVersion((v) => v + 1);
            });
        };

        scrollArea.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
            scrollArea.removeEventListener('wheel', handleWheel);
            scrollArea.removeEventListener('scroll', handleScroll);
        };
    }, [handleWheel, scrollAreaRef]);

    useEffect(() => {
        return () => {
            if (scrollRafRef.current !== null) {
                cancelAnimationFrame(scrollRafRef.current);
                scrollRafRef.current = null;
            }
        };
    }, []);

    return { scrollPosRef, scrollVersion };
};
