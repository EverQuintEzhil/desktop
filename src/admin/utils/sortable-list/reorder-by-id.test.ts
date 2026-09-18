import type { DragEndEvent } from '@dnd-kit/react';
import { describe, expect, it } from 'vitest';

import { reorderById } from './reorder-by-id';

type Row = { id: string; title: string };

const rows: Row[] = [
    { id: 'a', title: 'Alpha' },
    { id: 'b', title: 'Bravo' },
    { id: 'c', title: 'Charlie' },
];

const getId = (row: Row) => row.id;

/** `move` reads source, target and `canceled` off `event.operation`, not off the event itself. */
const dragEvent = (sourceId: string, targetId: string, canceled = false) =>
    ({
        operation: {
            source: { id: sourceId },
            target: { id: targetId },
            canceled,
        },
    }) as unknown as DragEndEvent;

describe('reorderById', () => {
    it('moves the dragged row to the target position, keeping every row', () => {
        const next = reorderById(rows, getId, dragEvent('a', 'c'));

        expect(next?.map(getId)).toEqual(['b', 'c', 'a']);
        expect(next).toHaveLength(rows.length);
    });

    it('returns null when the drag produced no reorder, so nothing is written', () => {
        expect(reorderById(rows, getId, dragEvent('a', 'a'))).toBeNull();
    });

    it('returns null for a cancelled drag', () => {
        expect(reorderById(rows, getId, dragEvent('a', 'c', true))).toBeNull();
    });

    it('leaves the source array untouched', () => {
        reorderById(rows, getId, dragEvent('a', 'c'));

        expect(rows.map(getId)).toEqual(['a', 'b', 'c']);
    });
});
