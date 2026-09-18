import { handleSessionExpired } from '@/lib/auth/handle-session-expired';
import { getSessionToken } from '@/lib/auth/session-token';
import { getBrowserTimezone, TIMEZONE_HEADER } from '@/utils/browser-timezone';

const withDefaultHeaders = (init?: RequestInit): RequestInit => {
    const headers = new Headers(init?.headers);

    if (!headers.has(TIMEZONE_HEADER)) {
        headers.set(TIMEZONE_HEADER, getBrowserTimezone());
    }

    // Desktop session: chat transports and file downloads authenticate with the
    // stored bearer token — the Tauri webview has no cookie for the API origin.
    const sessionToken = getSessionToken();

    if (sessionToken && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${sessionToken}`);
    }

    return {
        ...init,
        headers,
    };
};

export const authAwareFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const response = await fetch(input, withDefaultHeaders(init));

    if (response.status === 401) {
        handleSessionExpired();
    }

    return response;
};
