/**
 * `uiAxios` derives its base URL from `window.location.hostname` at request
 * time (see `getApiBaseUrl` in `src/lib/axios.ts`). Under jsdom the hostname is
 * `localhost`, so every `apiClient` call resolves to `https://api.localhost`.
 * MSW handlers must be registered against that exact origin. The
 * `VITE_API_BASE_URL` dev override is disabled when MODE is `test` precisely to
 * keep this true — without that guard a developer's `.env` sends these calls to
 * the real backend.
 */
export const API_BASE_URL = 'https://api.localhost';

export const FILES_BASE_URL = 'https://files.localhost';

export const apiUrl = (path: string): string => `${API_BASE_URL}${path}`;

export const filesUrl = (path: string): string => `${FILES_BASE_URL}${path}`;
