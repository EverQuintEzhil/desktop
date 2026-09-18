/** Per-user, per-table column layout. One stored row per (user, table). */
export interface TableLayout {
    /** Column ids in the user's preferred left-to-right order. */
    order?: string[];
    /** Column id -> pixel width, only for columns the user actually resized. */
    widths?: Record<string, number>;
}
