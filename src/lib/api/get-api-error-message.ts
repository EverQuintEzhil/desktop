import { isAxiosError } from 'axios';

/**
 * Pulls the backend's own message out of a failed request, so a screen can show
 * why it was rejected rather than one generic string.
 *
 * Covers both shapes `apiClient` produces: an `AxiosError` for a non-2xx
 * response (message in `response.data.message`, if any) and a plain `Error`
 * thrown by `assertApiSuccess` for a `{ success: false }` envelope (message on
 * the error itself).
 */
export const getApiErrorMessage = (error: unknown, fallback: string): string => {
    if (isAxiosError(error)) {
        const data = error.response?.data;

        if (data && typeof data === 'object' && 'message' in data) {
            const { message } = data as { message: unknown };

            if (typeof message === 'string' && message.trim()) {
                return message;
            }
        }

        // An AxiosError is an Error, and its own `message` is transport text
        // ("Request failed with status code 403"). Never show that to a user.
        return fallback;
    }

    if (error instanceof Error && error.message) {
        return error.message;
    }

    return fallback;
};
