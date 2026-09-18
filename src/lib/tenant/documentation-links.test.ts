import { describe, expect, it } from 'vitest';

import { createDocumentationLink, normaliseDocumentationLinks, parseDocumentationLinks } from './documentation-links';

describe('parseDocumentationLinks', () => {
    it('returns an empty list for anything that is not an array', () => {
        expect(parseDocumentationLinks(undefined)).toEqual([]);
        expect(parseDocumentationLinks(null)).toEqual([]);
        expect(parseDocumentationLinks('nope')).toEqual([]);
        expect(parseDocumentationLinks({ a: 1 })).toEqual([]);
    });

    it('keeps stored order and stored ids', () => {
        const stored = [
            { id: 'a', label: 'AI Policies', url: '/assets/policies.pdf' },
            { id: 'b', label: 'AI FAQs', url: 'https://example.com/faqs' },
        ];

        expect(parseDocumentationLinks(stored)).toEqual(stored);
    });

    it('backfills a row written without an id rather than dropping it', () => {
        const parsed = parseDocumentationLinks([
            { label: 'AI Policies', url: '/assets/policies.pdf' },
            { id: 'b', label: 'AI FAQs', url: 'https://example.com/faqs' },
        ]);

        expect(parsed).toEqual([
            { id: 'link-0', label: 'AI Policies', url: '/assets/policies.pdf' },
            { id: 'b', label: 'AI FAQs', url: 'https://example.com/faqs' },
        ]);
    });

    it('parses the same stored value into equal rows, so a dirty check stays honest', () => {
        const stored = [{ label: 'AI Policies', url: '/assets/policies.pdf' }];

        expect(parseDocumentationLinks(stored)).toEqual(parseDocumentationLinks(stored));
    });

    it('drops a malformed row and keeps the rest', () => {
        const parsed = parseDocumentationLinks([
            { id: 'a', label: '', url: '/assets/policies.pdf' },
            { id: 'b', label: 'AI FAQs', url: '' },
            'not an object',
            { id: 'c', label: 'AI Field Guide', url: '/assets/guide.pdf' },
        ]);

        expect(parsed).toEqual([{ id: 'c', label: 'AI Field Guide', url: '/assets/guide.pdf' }]);
    });
});

describe('normaliseDocumentationLinks', () => {
    it('trims each field and keeps the given order', () => {
        expect(
            normaliseDocumentationLinks([
                { id: 'a', label: '  AI Policies ', url: ' /assets/policies.pdf ' },
                { id: 'b', label: 'AI FAQs', url: 'https://example.com/faqs' },
            ]),
        ).toEqual([
            { id: 'a', label: 'AI Policies', url: '/assets/policies.pdf' },
            { id: 'b', label: 'AI FAQs', url: 'https://example.com/faqs' },
        ]);
    });

    it('drops a row that is empty once trimmed', () => {
        expect(normaliseDocumentationLinks([{ id: 'a', label: '   ', url: '  ' }])).toEqual([]);
    });

    it('keeps a row a parse would have backfilled, so a save cannot delete it', () => {
        const parsed = parseDocumentationLinks([{ label: 'AI Policies', url: '/assets/policies.pdf' }]);

        expect(normaliseDocumentationLinks(parsed)).toEqual(parsed);
    });
});

describe('createDocumentationLink', () => {
    it('mints a blank row with a unique id', () => {
        const first = createDocumentationLink();
        const second = createDocumentationLink();

        expect(first).toEqual({ id: expect.any(String), label: '', url: '' });
        expect(first.id).not.toBe(second.id);
    });
});
