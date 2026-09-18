import type { TableLayout } from '@/hooks/table-layout/types';

import { apiClient, type ApiRequestConfig } from '../client';

/**
 * One stored row per user per table (`user_table_preferences`, unique on
 * `(user_id, table_key)`), so saving one table never rewrites another and a screen reads only
 * the row it needs. The user comes from the session; it is never sent in the request.
 */
export interface TablePreference {
    tableKey: string;
    layout: TableLayout;
}

/** Mirrors the API's own `table_key` pattern, so a bad key fails here instead of as a 400. */
const TABLE_KEY_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9:_./-]{0,127}$/;

const buildUrl = (tableKey: string): string => {
    if (!TABLE_KEY_PATTERN.test(tableKey)) {
        throw new Error(`Invalid table layout key: ${tableKey}`);
    }

    return `/users/me/tablepreferences/${encodeURIComponent(tableKey)}`;
};

export const tablePreferencesApi = {
    /** Resolves to `null` when the user has never customised this table. */
    get: async (tableKey: string, config?: ApiRequestConfig): Promise<TableLayout | null> => {
        const preference = await apiClient.get<TablePreference | null>(buildUrl(tableKey), config);

        return preference?.layout ?? null;
    },

    /**
     * Upserts the row. Note the API *merges* `widths` into whatever is stored, so this can
     * add or change a width but never drop one — see `removeThenSave` for that case.
     */
    save: async (tableKey: string, layout: TableLayout, config?: ApiRequestConfig): Promise<TableLayout> => {
        const preference = await apiClient.put<TablePreference, TableLayout>(buildUrl(tableKey), layout, config);

        return preference?.layout ?? layout;
    },

    /** Deletes the row. Idempotent server side; this is also the "reset layout" action. */
    remove: async (tableKey: string, config?: ApiRequestConfig): Promise<void> => {
        await apiClient.delete<null>(buildUrl(tableKey), config);
    },

    /**
     * Replaces the row outright. Needed because `PUT` merges widths: double-clicking a resize
     * handle drops one column's width, and a plain `PUT` would leave the old value behind.
     */
    removeThenSave: async (tableKey: string, layout: TableLayout, config?: ApiRequestConfig): Promise<TableLayout> => {
        await tablePreferencesApi.remove(tableKey, config);

        return tablePreferencesApi.save(tableKey, layout, config);
    },
};
