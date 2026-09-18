import { describe, expect, it } from 'vitest';

import {
    buildWeblinksAuthPayload,
    createEmptyWeblinkRow,
    getWeblinkRowErrors,
    isHttpUrl,
    parseWeblinksLinks,
    toWeblinkRow,
    toWeblinkSpec,
    validateSiteMapLink,
    validateStoredCredentialsUrl,
    validateWeblinkRows,
    validateWeblinkUrl,
    weblinkRowHasErrors,
    type WeblinkFormRow,
} from './weblinks-validation';

const makeRow = (overrides: Partial<WeblinkFormRow> = {}): WeblinkFormRow => ({
    ...createEmptyWeblinkRow(),
    url: 'https://example.com',
    ...overrides,
});

describe('isHttpUrl', () => {
    it('accepts http and https URLs', () => {
        expect(isHttpUrl('https://example.com')).toBe(true);
        expect(isHttpUrl('http://example.com/page')).toBe(true);
    });

    it('rejects non-http protocols and unparsable values', () => {
        expect(isHttpUrl('ftp://example.com')).toBe(false);
        expect(isHttpUrl('not-a-url')).toBe(false);
        expect(isHttpUrl('')).toBe(false);
        expect(isHttpUrl('javascript:alert(1)')).toBe(false);
    });
});

describe('validateWeblinkUrl', () => {
    it('requires a URL', () => {
        expect(validateWeblinkUrl('')).toBe('URL is required.');
        expect(validateWeblinkUrl('   ')).toBe('URL is required.');
    });

    it('rejects a malformed / non-http URL', () => {
        expect(validateWeblinkUrl('not-a-url')).toEqual(expect.any(String));
        expect(validateWeblinkUrl('ftp://example.com')).toEqual(expect.any(String));
    });

    it('accepts a valid http(s) URL', () => {
        expect(validateWeblinkUrl('https://example.com')).toBeNull();
    });
});

describe('validateSiteMapLink', () => {
    it('is optional', () => {
        expect(validateSiteMapLink({ type: 'crawl', siteMapLink: '' })).toBeNull();
    });

    it('is rejected on scrape links even when it parses fine', () => {
        expect(validateSiteMapLink({ type: 'scrape', siteMapLink: 'https://example.com/sitemap.xml' })).toBe(
            'Sitemap link only applies to crawl links.',
        );
    });

    it('must be a valid URL on crawl links', () => {
        expect(validateSiteMapLink({ type: 'crawl', siteMapLink: 'not-a-url' })).toEqual(expect.any(String));
        expect(validateSiteMapLink({ type: 'crawl', siteMapLink: 'https://example.com/sitemap.xml' })).toBeNull();
    });
});

describe('getWeblinkRowErrors / weblinkRowHasErrors — credentials required when auth != none', () => {
    it('does not require credentials when auth is none', () => {
        const row = makeRow({ auth: 'none', username: '', password: '' });

        expect(weblinkRowHasErrors(row)).toBe(false);
    });

    it('requires both username and password once an auth kind is selected', () => {
        const missingBoth = makeRow({ auth: 'basic', username: '', password: '' });
        const missingPassword = makeRow({ auth: 'basic', username: 'admin', password: '' });
        const missingUsername = makeRow({ auth: 'wordpress', username: '', password: 'secret' });
        const complete = makeRow({ auth: 'basic', username: 'admin', password: 'secret' });

        expect(getWeblinkRowErrors(missingBoth).username).toEqual(expect.any(String));
        expect(getWeblinkRowErrors(missingBoth).password).toEqual(expect.any(String));
        expect(weblinkRowHasErrors(missingBoth)).toBe(true);

        expect(getWeblinkRowErrors(missingPassword).password).toEqual(expect.any(String));
        expect(weblinkRowHasErrors(missingPassword)).toBe(true);

        expect(getWeblinkRowErrors(missingUsername).username).toEqual(expect.any(String));
        expect(weblinkRowHasErrors(missingUsername)).toBe(true);

        expect(weblinkRowHasErrors(complete)).toBe(false);
    });
});

describe('validateWeblinkRows', () => {
    it('requires at least one link', () => {
        expect(validateWeblinkRows([])).toEqual(expect.any(String));
    });

    it('rejects a bad URL anywhere in the list', () => {
        const rows = [makeRow({ url: 'https://example.com' }), makeRow({ url: 'not-a-url' })];

        expect(validateWeblinkRows(rows)).toEqual(expect.any(String));
    });

    it('rejects duplicate URLs (normalized)', () => {
        const rows = [makeRow({ url: 'https://Example.com/path/' }), makeRow({ url: 'https://example.com/path' })];

        expect(validateWeblinkRows(rows)).toBe('Each URL must be unique within this data store.');
    });

    it('accepts a clean list of unique, valid rows', () => {
        const rows = [
            makeRow({ url: 'https://example.com', type: 'crawl' }),
            makeRow({ url: 'https://example.org/page', type: 'scrape' }),
        ];

        expect(validateWeblinkRows(rows)).toBeNull();
    });
});

describe('toWeblinkSpec / toWeblinkRow round-trip', () => {
    it('drops siteMapLink/maxPages/maxDepth for scrape links', () => {
        const row = makeRow({
            type: 'scrape',
            siteMapLink: 'https://example.com/sitemap.xml',
            maxPages: '10',
            maxDepth: '2',
        });
        const spec = toWeblinkSpec(row);

        expect(spec.type).toBe('scrape');
        expect(spec.siteMapLink).toBeUndefined();
        expect(spec.maxPages).toBeUndefined();
        expect(spec.maxDepth).toBeUndefined();
    });

    it('keeps siteMapLink/maxPages/maxDepth for crawl links', () => {
        const row = makeRow({
            type: 'crawl',
            siteMapLink: 'https://example.com/sitemap.xml',
            maxPages: '10',
            maxDepth: '2',
        });
        const spec = toWeblinkSpec(row);

        expect(spec.siteMapLink).toBe('https://example.com/sitemap.xml');
        expect(spec.maxPages).toBe(10);
        expect(spec.maxDepth).toBe(2);
    });

    it('never round-trips credentials back into a row', () => {
        const row = toWeblinkRow({ url: 'https://example.com', type: 'crawl', auth: 'basic' });

        expect(row.username).toBe('');
        expect(row.password).toBe('');
        expect(row.auth).toBe('basic');
    });

    it('keeps a saved auth kind through an edit that never touches credentials', () => {
        const row = toWeblinkRow({ url: 'https://example.com', type: 'crawl', auth: 'basic' });

        // Blank credentials on a stored-secret row are valid: the server keeps what it already has.
        expect(row.storedCredentialsUrl).toBe('https://example.com');
        expect(weblinkRowHasErrors(row)).toBe(false);
        expect(toWeblinkSpec(row).auth).toBe('basic');
        expect(buildWeblinksAuthPayload([row])).toBeNull();
    });

    it('defaults new rows to no auth', () => {
        const row = createEmptyWeblinkRow();

        expect(row.auth).toBe('none');
        expect(row.storedCredentialsUrl).toBe('');
        expect(toWeblinkSpec({ ...row, url: 'https://example.com' }).auth).toBe('none');
    });
});

describe('validateStoredCredentialsUrl — secrets are keyed by URL', () => {
    const savedRow = () => toWeblinkRow({ url: 'https://example.com', type: 'crawl', auth: 'basic' });

    it('blocks re-pointing an authenticated link while credentials are blank', () => {
        const repointed = { ...savedRow(), url: 'https://moved.example.com' };

        expect(validateStoredCredentialsUrl(repointed)).toBe(
            'Restore the original URL, or re-enter the credentials for this link.',
        );
        expect(getWeblinkRowErrors(repointed).url).toBe(validateStoredCredentialsUrl(repointed));
        expect(weblinkRowHasErrors(repointed)).toBe(true);
    });

    it('allows the re-point once credentials are supplied, keyed by the new URL', () => {
        const repointed = {
            ...savedRow(),
            url: 'https://moved.example.com',
            username: 'admin',
            password: 'pw',
        };

        expect(weblinkRowHasErrors(repointed)).toBe(false);
        expect(buildWeblinksAuthPayload([repointed])).toEqual({
            auth: { 'https://moved.example.com': { kind: 'basic', username: 'admin', password: 'pw' } },
        });
    });

    it('reports a malformed URL ahead of the credentials message', () => {
        const repointed = { ...savedRow(), url: 'not-a-url' };

        expect(getWeblinkRowErrors(repointed).url).toBe('Enter a valid http:// or https:// URL.');
    });

    it('ignores rows with no stored secrets', () => {
        const row = { ...createEmptyWeblinkRow(), url: 'https://example.com' };

        expect(validateStoredCredentialsUrl(row)).toBeNull();
    });
});

describe('buildWeblinksAuthPayload', () => {
    it('returns null when no row has both username and password', () => {
        const rows = [makeRow({ auth: 'basic', username: 'admin', password: '' })];

        expect(buildWeblinksAuthPayload(rows)).toBeNull();
    });

    it('keys entries by URL and omits rows without credentials', () => {
        const rows = [
            makeRow({
                url: 'https://a.example.com',
                auth: 'basic',
                username: 'admin',
                password: 'pw',
            }),
            makeRow({ url: 'https://b.example.com', auth: 'none' }),
        ];

        const payload = buildWeblinksAuthPayload(rows);

        expect(payload).toEqual({
            auth: {
                'https://a.example.com': { kind: 'basic', username: 'admin', password: 'pw' },
            },
        });
    });
});

describe('parseWeblinksLinks', () => {
    it('reads links from a parsed object specification', () => {
        const links = parseWeblinksLinks({ links: [{ url: 'https://example.com', type: 'crawl' }] });

        expect(links).toHaveLength(1);
        expect(links[0].url).toBe('https://example.com');
    });

    it('reads links from a JSON string specification', () => {
        const links = parseWeblinksLinks(JSON.stringify({ links: [{ url: 'https://example.com', type: 'scrape' }] }));

        expect(links).toHaveLength(1);
        expect(links[0].type).toBe('scrape');
    });

    it('returns an empty array for missing or malformed specification', () => {
        expect(parseWeblinksLinks(undefined)).toEqual([]);
        expect(parseWeblinksLinks(null)).toEqual([]);
        expect(parseWeblinksLinks('not json')).toEqual([]);
        expect(parseWeblinksLinks({})).toEqual([]);
    });
});
