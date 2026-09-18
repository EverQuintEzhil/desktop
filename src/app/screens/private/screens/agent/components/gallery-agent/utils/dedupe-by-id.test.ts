import { describe, expect, it } from 'vitest';

import { dedupeById } from './dedupe-by-id';

describe('dedupeById', () => {
    it('keeps the first occurrence of each id', () => {
        expect(
            dedupeById([
                { _id: 'a', value: 1 },
                { _id: 'b', value: 2 },
                { _id: 'a', value: 3 },
            ]),
        ).toEqual([
            { _id: 'a', value: 1 },
            { _id: 'b', value: 2 },
        ]);
    });

    it('returns an empty list for empty input', () => {
        expect(dedupeById([])).toEqual([]);
    });
});
