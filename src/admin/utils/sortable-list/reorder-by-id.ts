import { move } from '@dnd-kit/helpers';
import type { DragEndEvent } from '@dnd-kit/react';

/**
 * `move` returns the array it was given when the drag produced no reorder (cancelled, dropped on
 * itself, no target). This returns `null` for that, and for a reordered id with no matching entry,
 * so a caller never writes a list that lost or duplicated a row.
 */
export const reorderById = <T>(items: T[], getId: (item: T) => string, event: DragEndEvent): T[] | null => {
    const ids = items.map(getId);
    const nextIds = move(ids, event);

    if (nextIds === ids) return null;

    const itemById = new Map(items.map((item) => [getId(item), item]));
    const nextItems = nextIds.map((id) => itemById.get(id)).filter((item): item is T => item !== undefined);

    return nextItems.length === items.length ? nextItems : null;
};
