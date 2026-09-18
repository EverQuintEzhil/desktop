export type Surface = 'app' | 'admin';

let currentSurface: Surface = 'app';

/**
 * The user app and the admin console are separate bundles, and each one client-navigates
 * across `/admin` during login, so the URL cannot say which bundle is actually loaded.
 * Every entry point declares itself instead.
 */
export const setSurface = (surface: Surface): void => {
    currentSurface = surface;
};

export const getSurface = (): Surface => currentSurface;
