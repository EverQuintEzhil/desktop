import { describe, expect, it } from 'vitest';

import { pruneLayout, resolveColumnOrder, resolveColumnWidths } from './reconcile';

describe('resolveColumnOrder', () => {
    const columnIds = ['key', 'value', 'isPublic', 'updatedAt', 'actions'];

    it('falls back to the defined order when nothing is stored', () => {
        expect(resolveColumnOrder(undefined, columnIds, ['actions'])).toEqual(columnIds);
        expect(resolveColumnOrder([], columnIds, ['actions'])).toEqual(columnIds);
    });

    it('applies the stored order', () => {
        const stored = ['updatedAt', 'key', 'isPublic', 'value'];

        expect(resolveColumnOrder(stored, columnIds, ['actions'])).toEqual([
            'updatedAt',
            'key',
            'isPublic',
            'value',
            'actions',
        ]);
    });

    it('drops columns that no longer exist', () => {
        const stored = ['updatedAt', 'removedColumn', 'key', 'value', 'isPublic'];

        expect(resolveColumnOrder(stored, columnIds, ['actions'])).toEqual([
            'updatedAt',
            'key',
            'value',
            'isPublic',
            'actions',
        ]);
    });

    it('inserts a newly added column after the neighbour it follows in the definitions', () => {
        const stored = ['updatedAt', 'key', 'value'];
        const withNewColumn = ['key', 'value', 'createdBy', 'isPublic', 'updatedAt', 'actions'];

        expect(resolveColumnOrder(stored, withNewColumn, ['actions'])).toEqual([
            'updatedAt',
            'key',
            'value',
            'createdBy',
            'isPublic',
            'actions',
        ]);
    });

    it('keeps a locked column in its defined position even if it was stored elsewhere', () => {
        const stored = ['actions', 'updatedAt', 'key', 'value', 'isPublic'];

        expect(resolveColumnOrder(stored, columnIds, ['actions'])).toEqual([
            'updatedAt',
            'key',
            'value',
            'isPublic',
            'actions',
        ]);
    });

    it('ignores a duplicated id instead of dropping a column', () => {
        const stored = ['updatedAt', 'key', 'updatedAt', 'value', 'isPublic'];

        expect(resolveColumnOrder(stored, columnIds, ['actions'])).toEqual([
            'updatedAt',
            'key',
            'value',
            'isPublic',
            'actions',
        ]);
    });

    it('survives a column set the stored order has never seen (permission-gated actions)', () => {
        const stored = ['updatedAt', 'key', 'value', 'isPublic'];
        const readOnlyColumns = ['key', 'value', 'isPublic', 'updatedAt'];

        expect(resolveColumnOrder(stored, readOnlyColumns, ['actions'])).toEqual([
            'updatedAt',
            'key',
            'value',
            'isPublic',
        ]);
    });
});

describe('resolveColumnWidths', () => {
    it('keeps only usable widths for existing columns', () => {
        const widths = {
            key: 320,
            removed: 200,
            value: 0,
            isPublic: Number.NaN,
        };

        expect(resolveColumnWidths(widths, ['key', 'value', 'isPublic'])).toEqual({ key: 320 });
    });

    it('returns an empty map when nothing is stored', () => {
        expect(resolveColumnWidths(undefined, ['key'])).toEqual({});
    });
});

describe('pruneLayout', () => {
    it('collapses an untouched layout to null', () => {
        expect(pruneLayout({})).toBeNull();
        expect(pruneLayout({ order: [], widths: {} })).toBeNull();
    });

    it('keeps only the populated parts', () => {
        expect(pruneLayout({ order: ['key'], widths: {} })).toEqual({ order: ['key'] });
        expect(pruneLayout({ widths: { key: 200 } })).toEqual({ widths: { key: 200 } });
    });
});
