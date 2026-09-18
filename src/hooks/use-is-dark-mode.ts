import { useEffect, useState } from 'react';

const isDarkModeActive = () => document.documentElement.classList.contains('dark');

/**
 * `use-appearance` resolves the stored preference (which may be `system`) into a
 * `dark` class on <html>, so that class is the only place the active theme can be
 * read from.
 */
export const useIsDarkMode = (): boolean => {
    const [isDarkMode, setIsDarkMode] = useState(isDarkModeActive);

    useEffect(() => {
        const sync = () => setIsDarkMode(isDarkModeActive());

        sync();

        const observer = new MutationObserver(sync);

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class'],
        });

        return () => observer.disconnect();
    }, []);

    return isDarkMode;
};
