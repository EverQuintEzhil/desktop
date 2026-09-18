/**
 * Desktop session token store. The Tauri webview (origin tauri://localhost) has no
 * first-party cookie for the API origin, so the desktop app signs in with the
 * backend's `type: 'jwt'` OTP flow and authenticates every request with
 * `Authorization: Bearer <token>` instead of the `authentication` cookie.
 *
 * The token is the same revocable session the cookie flow uses: the backend keeps
 * its `jti` live in Redis, so logout-all and admin revocation still apply.
 *
 * Kept dependency-free so axios / fetch wrappers can import it without cycles.
 * The token must never be logged.
 */

const STORAGE_KEY = 'fm_session_token';

/** Fallback when the API's expiry stamp is unparsable — matches the 24 h session JWT TTL. */
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

interface StoredSessionToken {
    token: string;
    expiresAt: number;
}

// Source of truth; localStorage only adds persistence across app restarts, so a
// blocked storage still yields a working (webview-lifetime) session.
let inMemory: StoredSessionToken | null = null;

const parseExpiry = (expiresAt: number | string | undefined): number => {
    const value = typeof expiresAt === 'string' ? Date.parse(expiresAt) : expiresAt;

    // A parsable stamp is honoured as-is — including one already in the past,
    // which simply yields an immediately-expired session. Only an absent or
    // unparsable stamp falls back to the JWT's own 24 h TTL.
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    return Date.now() + DEFAULT_TTL_MS;
};

export const setSessionToken = (token: string, expiresAt?: number | string): void => {
    const stored: StoredSessionToken = { token, expiresAt: parseExpiry(expiresAt) };

    inMemory = stored;

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {
        // Storage blocked — the in-memory copy still carries this session.
    }
};

export const clearSessionToken = (): void => {
    inMemory = null;

    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch {
        // ignore
    }
};

const readStored = (): StoredSessionToken | null => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);

        if (!raw) {
            return null;
        }

        const parsed: unknown = JSON.parse(raw);

        if (!parsed || typeof parsed !== 'object') {
            return null;
        }

        const { token, expiresAt } = parsed as Partial<StoredSessionToken>;

        if (typeof token !== 'string' || !token || typeof expiresAt !== 'number') {
            return null;
        }

        return { token, expiresAt };
    } catch {
        return null;
    }
};

/** The current session token, or null when absent/expired (expired entries are cleared). */
export const getSessionToken = (): string | null => {
    const stored = inMemory ?? readStored();

    if (!stored) {
        return null;
    }

    if (stored.expiresAt <= Date.now()) {
        clearSessionToken();

        return null;
    }

    inMemory = stored;

    return stored.token;
};
