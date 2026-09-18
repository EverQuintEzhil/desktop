import type { WeblinkSpec } from '@/lib/api/admin/data-stores';

export type WeblinkType = 'crawl' | 'scrape';
export type WeblinkAuthKind = 'none' | 'basic' | 'wordpress';

export const WEBLINK_TYPE_OPTIONS: { value: WeblinkType; label: string }[] = [
    { value: 'crawl', label: 'Crawl' },
    { value: 'scrape', label: 'Scrape' },
];

export const DEFAULT_RESPECT_ROBOTS = true;
export const DEFAULT_MAX_PAGES = 2000;
export const DEFAULT_MAX_DEPTH = 5;

/** Local editor state for one link row. Numeric fields stay as strings while being typed; username/password are kept only in memory and never round-tripped through `specification`. */
export interface WeblinkFormRow {
    id: string;
    url: string;
    type: WeblinkType;
    siteMapLink: string;
    auth: WeblinkAuthKind;
    username: string;
    password: string;
    /** URL the server-side secrets are keyed by, empty when there are none. Blank credential fields mean "keep those secrets" only while `url` still matches this. */
    storedCredentialsUrl: string;
    respectRobots: boolean;
    maxPages: string;
    maxDepth: string;
}

export interface WeblinkAuthSecretEntry {
    kind: 'basic' | 'wordpress';
    username: string;
    password: string;
}

let rowIdCounter = 0;

const generateRowId = (): string => {
    rowIdCounter += 1;

    return `weblink-${Date.now()}-${rowIdCounter}-${Math.random().toString(36).slice(2, 8)}`;
};

export const createEmptyWeblinkRow = (): WeblinkFormRow => ({
    id: generateRowId(),
    url: '',
    type: 'crawl',
    siteMapLink: '',
    auth: 'none',
    username: '',
    password: '',
    storedCredentialsUrl: '',
    respectRobots: DEFAULT_RESPECT_ROBOTS,
    maxPages: String(DEFAULT_MAX_PAGES),
    maxDepth: String(DEFAULT_MAX_DEPTH),
});

/** Parses a value as an absolute http(s) URL. Anything else (relative paths, other protocols, garbage) is rejected. */
export const isHttpUrl = (value: string): boolean => {
    try {
        const parsed = new URL(value);

        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
};

/**
 * Normalizes a URL for uniqueness comparisons: lowercase host, no fragment, no trailing slash.
 * Falls back to a trimmed lowercase string if parsing fails (the field validator already flags
 * unparsable URLs separately).
 */
export const normalizeUrlForCompare = (value: string): string => {
    try {
        const url = new URL(value.trim());
        const pathname =
            url.pathname.length > 1 && url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname;

        return `${url.protocol}//${url.hostname.toLowerCase()}${pathname}${url.search}`;
    } catch {
        return value.trim().toLowerCase();
    }
};

export const validateWeblinkUrl = (value: string): string | null => {
    const trimmed = value.trim();

    if (!trimmed) return 'URL is required.';
    if (!isHttpUrl(trimmed)) return 'Enter a valid http:// or https:// URL.';

    return null;
};

/**
 * Stored secrets are keyed by URL, so re-pointing an authenticated link would leave the new URL with
 * no credentials — a crawl that silently fails to authenticate. Reported against the URL field
 * because that is the input the user just changed (and the only one visible while the auth picker is
 * hidden): restoring the URL clears it, as does supplying credentials for the new one.
 */
export const validateStoredCredentialsUrl = (
    row: Pick<WeblinkFormRow, 'auth' | 'url' | 'username' | 'password' | 'storedCredentialsUrl'>,
): string | null => {
    if (row.auth === 'none' || !row.storedCredentialsUrl) return null;
    if (row.url.trim() === row.storedCredentialsUrl) return null;
    if (row.username.trim() && row.password.trim()) return null;

    return 'Restore the original URL, or re-enter the credentials for this link.';
};

export const validateSiteMapLink = (row: Pick<WeblinkFormRow, 'type' | 'siteMapLink'>): string | null => {
    const trimmed = row.siteMapLink.trim();

    if (!trimmed) return null;
    if (row.type !== 'crawl') return 'Sitemap link only applies to crawl links.';
    if (!isHttpUrl(trimmed)) return 'Enter a valid http:// or https:// sitemap URL.';

    return null;
};

type CredentialFields = Pick<WeblinkFormRow, 'url' | 'username' | 'password' | 'storedCredentialsUrl'>;

/**
 * A saved link keeps its server-side secrets when both credential fields are left blank — the
 * weblinks endpoint never returns them, so an untouched row has nothing to re-submit.
 *
 * Secrets are keyed by URL, so this only holds while the URL is unchanged: re-pointing the link
 * needs the credentials again, under the new key.
 */
const keepsStoredCredentials = (row: CredentialFields): boolean =>
    Boolean(row.storedCredentialsUrl) &&
    row.url.trim() === row.storedCredentialsUrl &&
    !row.username.trim() &&
    !row.password.trim();

export const validateUsername = (row: Pick<WeblinkFormRow, 'auth'> & CredentialFields): string | null => {
    if (row.auth === 'none' || keepsStoredCredentials(row)) return null;

    return row.username.trim() ? null : 'Username is required for this authentication type.';
};

export const validatePassword = (row: Pick<WeblinkFormRow, 'auth'> & CredentialFields): string | null => {
    if (row.auth === 'none' || keepsStoredCredentials(row)) return null;

    return row.password.trim() ? null : 'Password is required for this authentication type.';
};

const validatePositiveInteger = (value: string): string | null => {
    if (!value.trim()) return null;

    const parsed = Number(value);

    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
        return 'Must be a positive whole number.';
    }

    return null;
};

export const validateMaxPages = (value: string): string | null => validatePositiveInteger(value);
export const validateMaxDepth = (value: string): string | null => validatePositiveInteger(value);

/** All per-field errors for a row, keyed the same as the fields rendered in the row editor. */
export const getWeblinkRowErrors = (
    row: WeblinkFormRow,
): {
    url: string | null;
    siteMapLink: string | null;
    username: string | null;
    password: string | null;
    maxPages: string | null;
    maxDepth: string | null;
} => ({
    url: validateWeblinkUrl(row.url) ?? validateStoredCredentialsUrl(row),
    siteMapLink: validateSiteMapLink(row),
    username: validateUsername(row),
    password: validatePassword(row),
    maxPages: row.type === 'crawl' ? validateMaxPages(row.maxPages) : null,
    maxDepth: row.type === 'crawl' ? validateMaxDepth(row.maxDepth) : null,
});

export const weblinkRowHasErrors = (row: WeblinkFormRow): boolean =>
    Object.values(getWeblinkRowErrors(row)).some((error) => error !== null);

/** Validates the whole link list: at least one row, every row internally valid, and URLs unique. Returns a user-facing message or null when clean. */
export const validateWeblinkRows = (rows: WeblinkFormRow[]): string | null => {
    if (rows.length === 0) return 'Add at least one link.';

    if (rows.some(weblinkRowHasErrors)) {
        return 'Fix the highlighted link fields before continuing.';
    }

    const seen = new Set<string>();

    for (const row of rows) {
        const key = normalizeUrlForCompare(row.url);

        if (seen.has(key)) return 'Each URL must be unique within this data store.';
        seen.add(key);
    }

    return null;
};

/** Non-secret payload sent to PUT /datastores/wizard/:storeId/weblinks. */
export const toWeblinkSpec = (row: WeblinkFormRow): WeblinkSpec => {
    const spec: WeblinkSpec = {
        url: row.url.trim(),
        type: row.type,
        auth: row.auth,
        respectRobots: row.respectRobots,
    };

    if (row.type === 'crawl') {
        const siteMapLink = row.siteMapLink.trim();

        if (siteMapLink) spec.siteMapLink = siteMapLink;
        spec.maxPages = row.maxPages.trim() ? Number(row.maxPages) : DEFAULT_MAX_PAGES;
        spec.maxDepth = row.maxDepth.trim() ? Number(row.maxDepth) : DEFAULT_MAX_DEPTH;
    }

    return spec;
};

/**
 * Rehydrates editor rows from the saved (non-secret) spec. Credential fields always start blank —
 * they are never returned by the weblinks endpoint — so a saved auth kind records
 * `storedCredentialsUrl` to mark those blanks as "unchanged" rather than "missing". The kind itself
 * round-trips untouched, which keeps an authenticated link authenticated while the picker is hidden.
 */
export const toWeblinkRow = (spec: WeblinkSpec): WeblinkFormRow => {
    const auth = spec.auth ?? 'none';
    const url = spec.url ?? '';

    return {
        id: generateRowId(),
        url,
        type: spec.type ?? 'crawl',
        siteMapLink: spec.siteMapLink ?? '',
        auth,
        username: '',
        password: '',
        storedCredentialsUrl: auth === 'none' ? '' : url,
        respectRobots: spec.respectRobots ?? DEFAULT_RESPECT_ROBOTS,
        maxPages: String(spec.maxPages ?? DEFAULT_MAX_PAGES),
        maxDepth: String(spec.maxDepth ?? DEFAULT_MAX_DEPTH),
    };
};

/** One `auth` map entry (keyed by URL) for rows with credentials filled in, or null when the row doesn't contribute a secret. */
export const toAuthSecretEntry = (row: WeblinkFormRow): [string, WeblinkAuthSecretEntry] | null => {
    if (row.auth === 'none') return null;
    if (!row.username.trim() || !row.password.trim()) return null;

    return [
        row.url.trim(),
        {
            kind: row.auth,
            username: row.username.trim(),
            password: row.password.trim(),
        },
    ];
};

/** Builds the `{ auth: { [url]: { kind, username, password } } }` body for the wizard connection endpoint. Returns null when no row has credentials to save (skips the extra request). */
export const buildWeblinksAuthPayload = (
    rows: WeblinkFormRow[],
): { auth: Record<string, WeblinkAuthSecretEntry> } | null => {
    const entries = rows
        .map(toAuthSecretEntry)
        .filter((entry): entry is [string, WeblinkAuthSecretEntry] => entry !== null);

    if (entries.length === 0) return null;

    return { auth: Object.fromEntries(entries) };
};

/**
 * Reads `links[]` back out of a datastore's `specification`. The API type declares `specification`
 * as `string`, but (mirroring the `custom` provider's JSONEditor usage elsewhere in this codebase)
 * it is actually handed back as a parsed object at runtime; this helper tolerates both shapes.
 */
export const parseWeblinksLinks = (specification: unknown): WeblinkSpec[] => {
    if (!specification) return [];

    let value: unknown = specification;

    if (typeof value === 'string') {
        try {
            value = JSON.parse(value);
        } catch {
            return [];
        }
    }

    if (value && typeof value === 'object' && Array.isArray((value as { links?: unknown }).links)) {
        return (value as { links: WeblinkSpec[] }).links;
    }

    return [];
};
