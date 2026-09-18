import { clearSessionToken } from '@/lib/auth/session-token';
import { showInfoToast } from '@/utils';

const LAST_CHAT_DEEP_LINK_KEY = 'last_chat_deep_link';
const REDIRECT_DELAY_MS = 1200;

let redirecting = false;

const isAuthSurface = (href: string): boolean =>
    href.includes('/accounts') || href.includes('/public') || href.includes('/logout');

const hasConversationInUrl = (href: string): boolean => {
    try {
        return /\/chat\/[^/?#]+/.test(new URL(href, window.location.origin).pathname);
    } catch {
        return /\/chat\/[^/?#]+/.test(href);
    }
};

/** Persist a chat URL so mid-stream expiry can restore /chat/:id after login. */
export const rememberChatDeepLink = (href?: string): void => {
    if (typeof window === 'undefined') return;

    const value = href || window.location.href;

    if (!hasConversationInUrl(value)) return;

    try {
        sessionStorage.setItem(LAST_CHAT_DEEP_LINK_KEY, value);
    } catch {
        // ignore
    }
};

const resolveDeepLink = (href: string): string => {
    if (hasConversationInUrl(href)) return href;

    try {
        const last = sessionStorage.getItem(LAST_CHAT_DEEP_LINK_KEY);

        if (last && hasConversationInUrl(last)) return last;
    } catch {
        // ignore
    }

    return href;
};

/**
 * Persist the best deep link (falling back to a remembered chat URL) so the
 * user returns to where they left off after re-authenticating. Used by both
 * the session-expiry redirect and the app-bootstrap auth failure path.
 */
export const captureDeepLink = (href?: string): void => {
    if (typeof window === 'undefined') return;

    const value = href || window.location.href;

    if (isAuthSurface(value)) return;

    try {
        sessionStorage.setItem('deep_link', resolveDeepLink(value));
    } catch {
        // ignore
    }
};

export const handleSessionExpired = (): void => {
    if (typeof window === 'undefined' || redirecting) return;

    const { href, pathname } = window.location;

    if (isAuthSurface(href)) return;

    redirecting = true;

    const deepLink = resolveDeepLink(href);

    try {
        sessionStorage.setItem('deep_link', deepLink);
    } catch {
        // ignore
    }

    // The token is dead server-side (expired or revoked jti) — stop sending it.
    clearSessionToken();

    try {
        localStorage.removeItem('user');
    } catch {
        // ignore
    }

    showInfoToast(
        hasConversationInUrl(deepLink)
            ? 'Your session expired. Sign in to continue — your chat will be restored.'
            : 'Your session expired. Please sign in again to continue.',
    );

    if (pathname !== '/accounts' && !pathname.startsWith('/accounts/')) {
        window.setTimeout(() => {
            window.location.assign('/accounts');
        }, REDIRECT_DELAY_MS);
    }
};
