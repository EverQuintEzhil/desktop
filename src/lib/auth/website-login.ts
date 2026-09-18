import { getApiBaseUrl } from '@/lib/axios';

/**
 * "Sign in with website" contract shared with the web app and the Tauri shell.
 *
 * The desktop opens `<website>/desktop-auth?state=<nonce>` in the SYSTEM browser,
 * the user signs in on the website with their existing cookie session (IdP or
 * otherwise), and the website redirects the browser to
 * `fluentmind-desktop://auth?token=…&expires_at=…&state=<nonce>`. The OS routes
 * that URL to this app via the deep-link plugin; the token is the same
 * revocable `type: 'jwt'` bearer session the OTP flow used to mint.
 *
 * Keep the scheme in sync with `src-tauri/tauri.conf.json` (plugins.deep-link)
 * and the web app's `/desktop-auth` screen.
 */
export const DESKTOP_AUTH_SCHEME = 'fluentmind-desktop';

/** Host part of the callback URL: `fluentmind-desktop://auth`. */
const CALLBACK_HOST = 'auth';

/** Route on the WEBSITE that performs the token handoff. */
const WEBSITE_LOGIN_PATH = '/desktop-auth';

/**
 * The nonce survives only for the tab-lifetime of one sign-in attempt; a
 * callback that does not echo it is not an answer to a request this app made.
 */
const STATE_STORAGE_KEY = 'desktop_auth_state';

export interface WebsiteCallback {
    token: string;
    expiresAt?: string;
    state: string;
}

/**
 * The website shares the API's registrable domain: the API lives at
 * `https://api.<host>` (see `getApiBaseUrl`), the website at `https://<host>`.
 * Deriving one from the other keeps dev overrides (VITE_API_BASE_URL) working
 * without a second env var.
 */
export const getWebsiteBaseUrl = (): string => {
    try {
        const api = new URL(getApiBaseUrl());

        return `${api.protocol}//${api.host.replace(/^api\./, '')}`;
    } catch (error) {
        console.error('Could not derive the website origin from the API base URL', error);

        return '';
    }
};

/**
 * `port` is the app's 127.0.0.1 loopback listener (see src-tauri/auth_server.rs).
 * When present, the website delivers the token there FIRST — the custom scheme
 * cannot work in a macOS dev build, where the scheme is never registered.
 */
export const buildWebsiteLoginUrl = (state: string, port?: number): string => {
    const params = new URLSearchParams({ state });

    if (port !== undefined) {
        params.set('port', String(port));
    }

    return `${getWebsiteBaseUrl()}${WEBSITE_LOGIN_PATH}?${params.toString()}`;
};

export const createLoginState = (): string => {
    // randomUUID is available in every webview this app ships in; the fallback
    // only exists for older jsdom/test environments.
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

export const storeLoginState = (state: string): void => {
    try {
        sessionStorage.setItem(STATE_STORAGE_KEY, state);
    } catch {
        // Storage blocked — the mismatch handler will ask the user to retry.
    }
};

export const readStoredLoginState = (): string | null => {
    try {
        return sessionStorage.getItem(STATE_STORAGE_KEY);
    } catch {
        return null;
    }
};

export const clearStoredLoginState = (): void => {
    try {
        sessionStorage.removeItem(STATE_STORAGE_KEY);
    } catch {
        // ignore
    }
};

/**
 * Parses one callback URL, or null when the URL is not a sign-in callback
 * (wrong scheme/host) or is missing the token/state pair. Accepts BOTH
 * delivery paths: the `fluentmind-desktop://auth` deep link and the app's own
 * `http://127.0.0.1:<port>/auth` loopback listener (src-tauri/auth_server.rs).
 * The caller still has to check `state` against `readStoredLoginState()`.
 */
export const parseWebsiteCallback = (url: string): WebsiteCallback | null => {
    let parsed: URL;

    try {
        parsed = new URL(url);
    } catch {
        return null;
    }

    const isDeepLink = parsed.protocol === `${DESKTOP_AUTH_SCHEME}:`;
    // Only the app's own loopback listener qualifies — never a remote http URL.
    const isLoopback =
        parsed.protocol === 'http:' && (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost');

    if (!isDeepLink && !isLoopback) {
        return null;
    }

    // Deep link: the OS delivers `scheme://auth?…` (host) or `scheme:auth?…`
    // (pathname) depending on the platform. Loopback: the path is always `/auth`.
    const target = isDeepLink
        ? parsed.host || parsed.pathname.replace(/^\/+/, '')
        : parsed.pathname.replace(/^\/+/, '');

    if (target !== CALLBACK_HOST) {
        return null;
    }

    const token = parsed.searchParams.get('token');
    const state = parsed.searchParams.get('state');

    if (!token || !state) {
        return null;
    }

    return {
        token,
        state,
        expiresAt: parsed.searchParams.get('expires_at') ?? undefined,
    };
};
