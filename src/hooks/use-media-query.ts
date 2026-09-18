import { useEffect, useState } from 'react';

/**
 * Subscribe to a CSS media query and return whether it currently matches.
 * Reads the initial value synchronously so the first render is already correct.
 */
export const useMediaQuery = (query: string): boolean => {
    const [matches, setMatches] = useState<boolean>(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return false;

        return window.matchMedia(query).matches;
    });

    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return undefined;

        const mql = window.matchMedia(query);
        const onChange = () => setMatches(mql.matches);

        onChange();
        mql.addEventListener('change', onChange);

        return () => mql.removeEventListener('change', onChange);
    }, [query]);

    return matches;
};

/** True below the Tailwind `md` breakpoint (< 768px). */
export const useIsMobile = (): boolean => useMediaQuery('(max-width: 767px)');

export default useMediaQuery;
