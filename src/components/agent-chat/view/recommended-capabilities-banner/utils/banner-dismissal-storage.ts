export type BannerRowKey = 'noAccess' | 'recommended';

export type BannerDismissals = Record<BannerRowKey, string | null>;

const getStorageKey = (agentId: string, row: BannerRowKey) => `fm.banner.dismissed.${agentId}.${row}`;

/**
 * The dismissed entries, sorted so a payload that only re-orders is not read as a changed
 * one. Entries and not a boolean are stored because a row that gains a blocker the viewer
 * has never seen has to show again.
 */
export const getDismissalFingerprint = (entries: readonly string[]): string => [...entries].sort().join(',');

/**
 * A row re-shows only on an entry the viewer has not already dismissed. Resolving one item
 * shrinks the set, and a strict shrink must never re-nag about the items still left.
 */
export const hasUndismissedEntry = (dismissed: string | null, entries: readonly string[]): boolean => {
    if (dismissed === null) return true;

    const seen = new Set(dismissed.split(','));

    return entries.some((entry) => !seen.has(entry));
};

/**
 * Drops the entries that were on the row and have since left it. A blocker that is resolved
 * and later comes back is then unseen again rather than staying silently dismissed for the
 * rest of the session. Entries still on the row keep their dismissal, so a pure shrink does
 * not re-nag about what is left.
 */
export const pruneDismissalFingerprint = (
    dismissed: string,
    previousEntries: readonly string[],
    entries: readonly string[],
): string => {
    const current = new Set(entries);
    const departed = new Set(previousEntries.filter((entry) => !current.has(entry)));

    if (departed.size === 0) return dismissed;

    return dismissed
        .split(',')
        .filter((entry) => !departed.has(entry))
        .join(',');
};

// sessionStorage throws in Safari private mode and wherever storage is disabled. A banner
// dismissal is not worth crashing the composer for, so a failure degrades to "not dismissed".
const readEntry = (key: string): string | null => {
    try {
        return window.sessionStorage.getItem(key);
    } catch {
        return null;
    }
};

export const readBannerDismissals = (agentId: string): BannerDismissals => ({
    noAccess: readEntry(getStorageKey(agentId, 'noAccess')),
    recommended: readEntry(getStorageKey(agentId, 'recommended')),
});

export const writeBannerDismissal = (agentId: string, row: BannerRowKey, fingerprint: string): void => {
    try {
        window.sessionStorage.setItem(getStorageKey(agentId, row), fingerprint);
    } catch {
        // Storage unavailable: the dismissal still applies to this mount, it just does not persist.
    }
};
