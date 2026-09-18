import { useEffect, useState } from 'react';

const TAILWIND_XL_BREAKPOINT = 1280;

export const useIsPaneOverlay = (forceOverlay: boolean): boolean => {
    const [isOverlay, setIsOverlay] = useState(forceOverlay);

    useEffect(() => {
        if (forceOverlay) {
            setIsOverlay(true);

            return;
        }

        const sync = () => setIsOverlay(window.innerWidth < TAILWIND_XL_BREAKPOINT);

        sync();
        window.addEventListener('resize', sync);

        return () => {
            window.removeEventListener('resize', sync);
        };
    }, [forceOverlay]);

    return isOverlay;
};
