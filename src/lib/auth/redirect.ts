import { getSurface } from '@/lib/auth/surface';
import { getApiBaseUrl } from '@/lib/axios';

export type RedirectTarget = {
    value: string;
    /** The target cannot be reached with `navigate()` — assign `window.location` instead. */
    fullPageLoad: boolean;
};

const ADMIN_PATH_PREFIX = '/admin';

const getTrustedOrigin = (value: string): string | null => {
    try {
        return new URL(value).origin;
    } catch (error) {
        console.error('Invalid trusted origin', error);

        return null;
    }
};

const isAdminPath = (pathname: string): boolean =>
    pathname === ADMIN_PATH_PREFIX || pathname.startsWith(`${ADMIN_PATH_PREFIX}/`);

/**
 * The user app and the admin console are separate bundles behind separate
 * index.html files, so a route in the other one has no match in the router that
 * is currently mounted and a client-side navigate lands on its catch-all.
 */
const crossesBundleBoundary = (pathname: string): boolean => (isAdminPath(pathname) ? 'admin' : 'app') !== getSurface();

export const getRedirectTarget = (redirectValue: string): RedirectTarget | null => {
    try {
        const url = new URL(redirectValue, window.location.origin);
        const path = `${url.pathname}${url.search}${url.hash}` || '/';

        if (url.origin === window.location.origin) {
            return {
                value: path,
                fullPageLoad: crossesBundleBoundary(url.pathname),
            };
        }

        if (url.origin === getTrustedOrigin(getApiBaseUrl())) {
            return {
                value: url.href,
                fullPageLoad: true,
            };
        }
    } catch (error) {
        console.error('Invalid redirect URL', error);
    }

    return null;
};
