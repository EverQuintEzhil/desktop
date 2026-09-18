import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import isEqual from 'lodash/isEqual';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useAppSelector } from '@/hooks/use-typed-redux';
import { tablePreferencesApi } from '@/lib/api/common/table-preferences';
import { selectUser } from '@/store/selectors';

import { pruneLayout, resolveColumnOrder, resolveColumnWidths } from './reconcile';
import type { TableLayout } from './types';

export interface UseTableLayoutOptions {
    /** Stable id for the table. Omit to disable persistence entirely. */
    storageKey?: string;
    /** Column ids in the order the screen defines them. */
    columnIds: string[];
    /** Ids that keep their defined position, such as a trailing actions column. */
    lockedColumnIds?: string[];
}

export interface UseTableLayoutResult {
    isEnabled: boolean;
    isLoaded: boolean;
    isCustomized: boolean;
    /**
     * Bumped when a write is rolled back. A rollback restores the value the table already
     * had, so consumers cannot detect it by diffing the layout — they must re-sync on this.
     */
    revision: number;
    columnOrder: string[];
    columnWidths: Record<string, number>;
    saveOrder: (order: string[]) => void;
    saveWidths: (widths: Record<string, number>) => void;
    reset: () => void;
}

export const TABLE_LAYOUT_QUERY_KEY = 'table-layout';

/**
 * Per-user column order and width for one table, stored server side as its own
 * `user_table_preferences` row keyed by (user, table), so saving one table never touches
 * another and the layout follows the user to any browser or device.
 */
export const useTableLayout = (options: UseTableLayoutOptions): UseTableLayoutResult => {
    const { storageKey, columnIds, lockedColumnIds = [] } = options;
    const isEnabled = Boolean(storageKey);
    const queryClient = useQueryClient();
    const user = useAppSelector(selectUser);
    const userId = user?._id ?? undefined;
    const queryKey = useMemo(() => [TABLE_LAYOUT_QUERY_KEY, userId ?? 'anonymous', storageKey], [userId, storageKey]);

    const { data: stored, isSuccess } = useQuery({
        queryKey,
        queryFn: () => tablePreferencesApi.get(storageKey as string),
        enabled: isEnabled,
        staleTime: Infinity,
    });

    const columnIdsKey = columnIds.join(',');
    const lockedKey = lockedColumnIds.join(',');

    const columnOrder = useMemo(
        () => resolveColumnOrder(stored?.order, columnIds, lockedColumnIds),
        [stored?.order, columnIdsKey, lockedKey],
    );

    const columnWidths = useMemo(() => resolveColumnWidths(stored?.widths, columnIds), [stored?.widths, columnIdsKey]);

    // Sequence number of the newest write. Out-of-order or superseded responses must not
    // resurrect an older layout, and only the newest failure may roll the cache back.
    const writeSeq = useRef(0);
    const [revision, setRevision] = useState(0);
    /** A gesture made while the layout was still loading, replayed once it arrives. */
    const pendingPatch = useRef<TableLayout | null>(null);

    const mutation = useMutation({
        mutationFn: ({ layout, replace }: { layout: TableLayout | null; seq: number; replace: boolean }) => {
            if (!layout) {
                return tablePreferencesApi.remove(storageKey as string).then(() => null);
            }

            if (replace) {
                return tablePreferencesApi.removeThenSave(storageKey as string, layout);
            }

            return tablePreferencesApi.save(storageKey as string, layout);
        },
        onMutate: async ({ layout }) => {
            await queryClient.cancelQueries({ queryKey });

            const previous = queryClient.getQueryData<TableLayout | null>(queryKey);

            queryClient.setQueryData<TableLayout | null>(queryKey, layout);

            return { previous };
        },
        onSuccess: (saved, { seq }) => {
            if (seq !== writeSeq.current) {
                return;
            }

            queryClient.setQueryData<TableLayout | null>(queryKey, saved);
        },
        onError: (_error, { seq }, context) => {
            if (seq !== writeSeq.current) {
                return;
            }

            queryClient.setQueryData<TableLayout | null>(queryKey, context?.previous ?? null);
            setRevision((current) => current + 1);

            toast.error("Couldn't save the column layout. Please try again.");
        },
    });

    const writeLayout = useCallback(
        (patch: TableLayout) => {
            if (!storageKey) {
                return;
            }

            // Writing before the stored layout arrives would overwrite it with this table's
            // defaults, so hold the gesture and replay it once the load settles.
            if (!isSuccess) {
                if (patch.order?.length || (patch.widths && Object.keys(patch.widths).length > 0)) {
                    pendingPatch.current = { ...pendingPatch.current, ...patch };
                }

                return;
            }

            const current = queryClient.getQueryData<TableLayout | null>(queryKey) ?? null;
            const next = pruneLayout({ ...current, ...patch });

            if (isEqual(next, current)) {
                return;
            }

            writeSeq.current += 1;
            // The API merges widths, so a width the user dropped (double-clicking a resize
            // handle) needs the row replaced rather than patched.
            const droppedWidth = Object.keys(current?.widths ?? {}).some((id) => next?.widths?.[id] === undefined);

            mutation.mutate({ layout: next, seq: writeSeq.current, replace: droppedWidth });
        },
        [storageKey, isSuccess, queryClient, mutation, queryKey],
    );

    useEffect(() => {
        if (!isSuccess || !pendingPatch.current) {
            return;
        }

        const patch = pendingPatch.current;

        pendingPatch.current = null;
        writeLayout(patch);
    }, [isSuccess, writeLayout]);

    const saveOrder = useCallback((order: string[]) => writeLayout({ order }), [writeLayout]);

    const saveWidths = useCallback((widths: Record<string, number>) => writeLayout({ widths }), [writeLayout]);

    const reset = useCallback(() => writeLayout({ order: undefined, widths: undefined }), [writeLayout]);

    return {
        isEnabled,
        isLoaded: !isEnabled || isSuccess,
        revision,
        isCustomized: Boolean(stored?.order?.length) || Object.keys(columnWidths).length > 0,
        columnOrder,
        columnWidths,
        saveOrder,
        saveWidths,
        reset,
    };
};
