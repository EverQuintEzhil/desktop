import { afterEach, describe, expect, it } from 'vitest';

import { collectFindMatches } from './collect-matches';

const mount = (html: string): HTMLElement => {
    const root = document.createElement('div');

    root.innerHTML = html;
    document.body.append(root);

    return root;
};

afterEach(() => {
    document.body.innerHTML = '';
});

describe('collectFindMatches', () => {
    it('finds every case-insensitive occurrence in document order', () => {
        const root = mount('<p>Language switched</p><p>the language pair</p><p>LANGUAGE</p>');

        const matches = collectFindMatches(root, 'language');

        expect(matches).toHaveLength(3);
        expect(matches.map((range) => range.toString())).toEqual(['Language', 'language', 'LANGUAGE']);
    });

    it('returns nothing for an empty or whitespace query', () => {
        const root = mount('<p>Language switched</p>');

        expect(collectFindMatches(root, '')).toHaveLength(0);
        expect(collectFindMatches(root, '   ')).toHaveLength(0);
    });

    it('matches a phrase that spans inline markup', () => {
        const root = mount('<p>the <strong>language</strong> pair triggered it</p>');

        const matches = collectFindMatches(root, 'language pair');

        expect(matches).toHaveLength(1);
        expect(matches[0].toString()).toBe('language pair');
    });

    it('never matches a phrase across a block boundary', () => {
        const root = mount('<p>ends with language</p><p>pair starts here</p>');

        expect(collectFindMatches(root, 'language pair')).toHaveLength(0);
    });

    it('skips subtrees marked data-find-skip', () => {
        const root = mount('<div data-find-skip=""><input value="language" />language</div><p>language</p>');

        expect(collectFindMatches(root, 'language')).toHaveLength(1);
    });

    it('skips aria-hidden subtrees and script content', () => {
        const root = mount('<span aria-hidden="true">language</span><script>var language = 1;</script><p>language</p>');

        expect(collectFindMatches(root, 'language')).toHaveLength(1);
    });

    // Lowercasing is not length-preserving in JS, so a lowercased haystack would
    // shift every offset after a character like this one.
    it('keeps offsets correct after a character that grows when lowercased', () => {
        const root = mount('<p>\u0130stanbul then language here</p>');

        const matches = collectFindMatches(root, 'language');

        expect(matches).toHaveLength(1);
        expect(matches[0].toString()).toBe('language');
    });

    it('treats regex metacharacters in the query literally', () => {
        const root = mount('<p>cost is 20 (per seat) a month</p>');

        expect(collectFindMatches(root, '(per seat)')).toHaveLength(1);
        expect(collectFindMatches(root, 'c.st')).toHaveLength(0);
    });

    it('finds overlapping-free consecutive matches', () => {
        const root = mount('<p>aaaa</p>');

        expect(collectFindMatches(root, 'aa')).toHaveLength(2);
    });
});
