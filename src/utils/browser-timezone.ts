export const TIMEZONE_HEADER = 'x-timezone';

/**
 * IANA timezone of the current browser, e.g. `America/New_York`. Sent on every
 * API request so the backend can render dates in the user's local zone.
 */
export const getBrowserTimezone = (): string => {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
        return 'UTC';
    }
};
