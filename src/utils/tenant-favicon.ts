const FAVICON_LIGHT_ID = 'tenant-favicon-light';
const FAVICON_DARK_ID = 'tenant-favicon-dark';
const FAVICON_ID = 'tenant-favicon';

const DEFAULT_LOGO = '/assets/logo.png';

let removeColorSchemeListener: (() => void) | undefined;

function faviconMimeType(href: string): string {
    if (/\.svg(\?|#|$)/i.test(href)) return 'image/svg+xml';
    if (/\.ico(\?|#|$)/i.test(href)) return 'image/x-icon';

    return 'image/png';
}

/**
 * Sets document favicons for light vs dark UI: logoBrand (light) and logoWhite (dark),
 * using prefers-color-scheme so the browser picks the correct icon for the system theme.
 */
export function syncTenantFavicons(logoBrand: string, logoWhite: string): void {
    const lightHref = logoBrand || DEFAULT_LOGO;
    const darkHref = logoWhite || DEFAULT_LOGO;

    const ensure = (id: string): HTMLLinkElement => {
        let el = document.getElementById(id) as HTMLLinkElement | null;

        if (!el) {
            el = document.createElement('link');
            el.id = id;
            el.rel = 'icon';
            document.head.appendChild(el);
        }

        return el;
    };

    const light = ensure(FAVICON_LIGHT_ID);

    light.rel = 'icon';
    light.media = '(prefers-color-scheme: light)';
    light.href = lightHref;
    light.type = faviconMimeType(lightHref);

    const dark = ensure(FAVICON_DARK_ID);

    dark.rel = 'icon';
    dark.media = '(prefers-color-scheme: dark)';
    dark.href = darkHref;
    dark.type = faviconMimeType(darkHref);

    const active = ensure(FAVICON_ID);
    const darkSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const syncActiveFavicon = () => {
        const activeHref = darkSchemeQuery.matches ? darkHref : lightHref;

        active.rel = 'icon';
        active.removeAttribute('media');
        active.href = activeHref;
        active.type = faviconMimeType(activeHref);
    };

    removeColorSchemeListener?.();
    darkSchemeQuery.addEventListener('change', syncActiveFavicon);
    removeColorSchemeListener = () => darkSchemeQuery.removeEventListener('change', syncActiveFavicon);

    syncActiveFavicon();
}
