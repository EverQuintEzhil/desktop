import type { TableLayout } from './types';

/** Narrower than this is unusable, and a stored 0 would collapse the column entirely. */
export const MIN_COLUMN_WIDTH = 40;

/** Matches the API's own bound, so a drag can never produce a width the PUT would reject. */
export const MAX_COLUMN_WIDTH = 2000;

/**
 * Merge a stored column order with the columns the table actually renders today.
 *
 * Columns come and go as the admin screens evolve, and the same table can render a
 * different column set per user (permission-gated `actions`, for example), so a stored
 * order is treated as a preference and never as the source of truth:
 * - ids that no longer exist are dropped,
 * - ids the user has never seen are inserted next to the neighbour they follow in the
 *   column definitions, so a newly added column shows up where the developer put it,
 * - locked ids keep their defined position and cannot be moved.
 */
export const resolveColumnOrder = (
    stored: string[] | undefined,
    columnIds: string[],
    lockedColumnIds: string[] = [],
): string[] => {
    if (!stored?.length) {
        return columnIds;
    }

    const locked = new Set(lockedColumnIds);
    const movable = columnIds.filter((id) => !locked.has(id));
    const known = new Set(movable);
    // De-duplicate: a repeated id would consume a slot below and silently drop a column.
    const ordered = [...new Set(stored.filter((id) => known.has(id)))];
    const seen = new Set(ordered);

    movable.forEach((id, index) => {
        if (seen.has(id)) {
            return;
        }

        const previous = movable
            .slice(0, index)
            .reverse()
            .find((candidate) => seen.has(candidate));
        const insertAt = previous === undefined ? 0 : ordered.indexOf(previous) + 1;

        ordered.splice(insertAt, 0, id);
        seen.add(id);
    });

    const queue = [...ordered];

    return columnIds.map((id) => (locked.has(id) ? id : (queue.shift() as string)));
};

/** Keep only widths for columns that still exist, so the stored blob does not grow forever. */
export const resolveColumnWidths = (
    stored: Record<string, number> | undefined,
    columnIds: string[],
): Record<string, number> => {
    if (!stored) {
        return {};
    }

    const known = new Set(columnIds);

    return Object.fromEntries(
        Object.entries(stored).filter(
            ([id, width]) =>
                known.has(id) && Number.isFinite(width) && width >= MIN_COLUMN_WIDTH && width <= MAX_COLUMN_WIDTH,
        ),
    );
};

/** Drop the empty pieces so an untouched table stores nothing at all. */
export const pruneLayout = (layout: TableLayout): TableLayout | null => {
    const next: TableLayout = {};

    if (layout.order?.length) {
        next.order = layout.order;
    }

    if (layout.widths && Object.keys(layout.widths).length > 0) {
        next.widths = layout.widths;
    }

    return Object.keys(next).length > 0 ? next : null;
};
