import axios, {
    AxiosHeaders,
    type AxiosError,
    type AxiosInstance,
    type AxiosRequestConfig,
    type AxiosResponse,
    type InternalAxiosRequestConfig,
} from 'axios';

import { handleSessionExpired } from '@/lib/auth/handle-session-expired';
import { getBrowserTimezone, TIMEZONE_HEADER } from '@/utils/browser-timezone';

declare module 'axios' {
    interface AxiosRequestConfig {
        skipAuthRedirect?: boolean;
    }

    interface InternalAxiosRequestConfig {
        skipAuthRedirect?: boolean;
    }
}

const isBrowser = () => typeof window !== 'undefined';

/**
 * Embedded-host overrides for the chat SDK. In a foreign host `window.location`
 * is the HOST page (e.g. hub365), so the default `api.<hostname>` derivation
 * targets the wrong origin and cookie auth is unavailable. When the SDK mounts
 * it points `apiClient` at the injected FluentMind origin, supplies a bearer
 * token, and suppresses the 401 hard-reload (which would reload the host page).
 * Defaults are null → the standalone app is completely unaffected.
 */
interface EmbeddedApiConfig {
    apiBaseUrl?: string;
    filesBaseUrl?: string;
    getToken?: () => string | Promise<string>;
    authHeader?: string;
}

let embeddedApiConfig: EmbeddedApiConfig | null = null;

// Dev only, so a stray env var can never repoint a deployed app. Excluded under
// test as well: Vitest sets DEV true and loads `.env`, so an override there would
// send MSW-mocked calls to the real backend.
const devBaseUrlOverride = (value: string | undefined): string | undefined => {
    if (!import.meta.env.DEV || import.meta.env.MODE === 'test') {
        return undefined;
    }

    if (!value) {
        return undefined;
    }

    const trimmed = value.replace(/\/+$/, '');

    if (!/^https?:\/\//.test(trimmed)) {
        console.error(`Ignoring base URL override "${value}": expected an absolute http(s) URL.`);

        return undefined;
    }

    return trimmed;
};

export const configureEmbeddedApi = (config: EmbeddedApiConfig | null): void => {
    embeddedApiConfig = config;
};

export const getApiBaseUrl = (): string => {
    if (embeddedApiConfig?.apiBaseUrl) {
        return embeddedApiConfig.apiBaseUrl;
    }

    const override = devBaseUrlOverride(import.meta.env.VITE_API_BASE_URL);

    if (override) {
        return override;
    }

    if (!isBrowser()) {
        return '';
    }

    return `https://api.${window.location.hostname.replace('www.', '')}`;
};

export const getFilesBaseUrl = (): string => {
    if (embeddedApiConfig?.filesBaseUrl) {
        return embeddedApiConfig.filesBaseUrl;
    }

    const override = devBaseUrlOverride(import.meta.env.VITE_FILES_BASE_URL);

    if (override) {
        return override;
    }

    if (!isBrowser()) {
        return '';
    }

    return `https://files.${window.location.hostname.replace('www.', '')}`;
};

export const getFilesDownloadUrl = (fileId: string, query?: Record<string, string>): string => {
    const base = getFilesBaseUrl();
    const path = `/download/${fileId}`;
    const qs = query && Object.keys(query).length ? `?${new URLSearchParams(query).toString()}` : '';

    return `${base}${path}${qs}`;
};

export const getFilesMultipleDownloadUrl = (fileIds: string[]): string => {
    const base = getFilesBaseUrl();
    const qs = new URLSearchParams({ fileIds: fileIds.join(',') }).toString();

    return `${base}/download/multiple?${qs}`;
};

export const getDataStoreFileDownloadUrl = (storeId: string, fileId: string): string => {
    const base = getFilesBaseUrl();
    const path = `/download/datastores/${storeId}`;
    const qs = `?${new URLSearchParams({ file_path: fileId }).toString()}`;

    return `${base}${path}${qs}`;
};

type HeaderConfig = AxiosRequestConfig['headers'] | InternalAxiosRequestConfig['headers'];

const readHeader = (headers: HeaderConfig, name: string): unknown => {
    if (!headers) {
        return undefined;
    }

    if (headers instanceof AxiosHeaders) {
        return headers.get(name);
    }

    return headers[name] ?? headers[name.toLowerCase()];
};

const asBoolean = (value: unknown): boolean => {
    if (typeof value === 'boolean') {
        return value;
    }

    if (typeof value === 'string') {
        return value.toLowerCase() === 'true';
    }

    return false;
};

const asString = (value: unknown): string | undefined =>
    typeof value === 'string' && value.length > 0 ? value : undefined;

const responseInterceptor = (response: AxiosResponse) => {
    const shouldReleaseUnload = asBoolean(readHeader(response.config?.headers, 'preventAccidentalClose'));

    if (shouldReleaseUnload && isBrowser()) {
        window.onbeforeunload = null;
    }

    return response;
};

const errorInterceptor = (error: AxiosError) => {
    const config = error.config;
    const skipAuthRedirect = config?.skipAuthRedirect === true;
    const shouldReleaseUnload = asBoolean(readHeader(config?.headers, 'preventAccidentalClose'));

    if (error.response?.status === 401 && !skipAuthRedirect && !embeddedApiConfig) {
        handleSessionExpired();
    }

    if (shouldReleaseUnload && isBrowser()) {
        window.onbeforeunload = null;
    }

    return Promise.reject(error);
};

const createRequestInterceptor = (resolveBase: () => string) => async (config: InternalAxiosRequestConfig) => {
    if (!config.baseURL && config.url && !/^https?:\/\//i.test(config.url)) {
        config.baseURL = resolveBase();
    }

    config.headers = AxiosHeaders.from(config.headers);

    if (!config.headers.has(TIMEZONE_HEADER)) {
        config.headers.set(TIMEZONE_HEADER, getBrowserTimezone());
    }

    // Embedded host: authenticate every apiClient call with the injected bearer
    // token (not cookies), matching the SDK's chat transport.
    if (embeddedApiConfig?.getToken) {
        const raw = embeddedApiConfig.getToken();
        const token = typeof raw === 'string' ? raw : await raw;

        config.headers.set(embeddedApiConfig.authHeader ?? 'Authorization', `Bearer ${token}`);
        config.withCredentials = false;
    } else {
        // Desktop session: the Tauri webview (tauri://localhost) holds no first-party
        // cookie for the API origin, so the OTP `type: 'jwt'` login stores a bearer
        // token instead and every request carries it here. Resolved lazily: this
        // module sits on the utils→axios import cycle, and a static named import of
        // the token store arrives partially linked for suites that enter the graph
        // through the api client.
        const { getSessionToken } = await import('@/lib/auth/session-token');
        const sessionToken = getSessionToken();

        if (sessionToken) {
            config.headers.set('Authorization', `Bearer ${sessionToken}`);
            config.withCredentials = false;
        }
    }

    const shouldPreventUnload = asBoolean(readHeader(config.headers, 'preventAccidentalClose'));

    if (shouldPreventUnload && isBrowser()) {
        const confirmationMessage =
            asString(readHeader(config.headers, 'confirmationMessage')) ?? 'Changes that you made may not be saved.';
        const confirmExit = (e: BeforeUnloadEvent) => {
            e.returnValue = confirmationMessage;

            return confirmationMessage;
        };

        window.onbeforeunload = confirmExit;
    }

    return config;
};

const createHttpClient = (resolveBase: () => string): AxiosInstance => {
    const instance = axios.create({ withCredentials: true });

    instance.interceptors.request.use(createRequestInterceptor(resolveBase), (error: AxiosError) =>
        Promise.reject(error),
    );
    instance.interceptors.response.use(responseInterceptor, errorInterceptor);

    return instance;
};

export const uiAxios = createHttpClient(getApiBaseUrl);
export const filesHttp = createHttpClient(getFilesBaseUrl);

export default uiAxios;
export type { CancelTokenSource } from 'axios';
