import { PointerActivationConstraints } from '@dnd-kit/dom';
import { move } from '@dnd-kit/helpers';
import { KeyboardSensor, PointerSensor, type DragEndEvent } from '@dnd-kit/react';
import type { ColumnDef, ColumnSizingInfoState, ColumnSizingState, OnChangeFn } from '@tanstack/react-table';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTableLayout } from '@/hooks/table-layout';
import useDidUpdate from '@/hooks/use-did-update';

const DRAG_ACTIVATION_DISTANCE = 4;

const TOUCH_ACTIVATION_DELAY_MS = 250;

/**
 * dnd-kit 0.5 activates a mouse drag with no movement at all when the press lands on the
 * draggable's own handle, so a plain click on the grip runs a whole drag. Its feedback pass puts
 * `position: fixed` on the header cell, which blockifies the table-cell box and drops the
 * `vertical-align: middle` that centred the cell's content, so the label visibly jumps. Touch keeps
 * the library's own long-press default so a scroll that starts on the grip is still a scroll.
 */
export const COLUMN_DRAG_SENSORS = [
    PointerSensor.configure({
        activationConstraints: (event) => {
            if (event.pointerType === 'touch') {
                return [new PointerActivationConstraints.Delay({ value: TOUCH_ACTIVATION_DELAY_MS, tolerance: 5 })];
            }

            return [new PointerActivationConstraints.Distance({ value: DRAG_ACTIVATION_DISTANCE })];
        },
    }),
    KeyboardSensor,
];

const INITIAL_SIZING_INFO: ColumnSizingInfoState = {
    startOffset: null,
    startSize: null,
    deltaOffset: null,
    deltaPercentage: null,
    isResizingColumn: false,
    columnSizingStart: [],
};

/** Mirrors TanStack Table's own id derivation: id, then accessorKey, then a string header. */
const getColumnId = <TData>(column: ColumnDef<TData, unknown>): string => {
    if (column.id) {
        return column.id;
    }

    const accessorKey = (column as { accessorKey?: string | number }).accessorKey;

    if (accessorKey !== undefined) {
        return String(accessorKey).replace('.', '_');
    }

    return typeof column.header === 'string' ? column.header : '';
};

const getColumnLabel = <TData>(column: ColumnDef<TData, unknown>, columnId: string): string =>
    typeof column.header === 'string' ? column.header : columnId;

export interface UseColumnLayoutOptions<TData> {
    columns: ColumnDef<TData, unknown>[];
    storageKey?: string;
    lockedColumnIds: string[];
}

export interface UseColumnLayoutResult {
    isEnabled: boolean;
    isCustomized: boolean;
    canReorder: boolean;
    columnLabels: Record<string, string>;
    columnOrder: string[];
    columnSizing: ColumnSizingState;
    columnSizingInfo: ColumnSizingInfoState;
    sortableColumnIds: string[];
    setColumnOrder: OnChangeFn<string[]>;
    setColumnSizing: OnChangeFn<ColumnSizingState>;
    setColumnSizingInfo: OnChangeFn<ColumnSizingInfoState>;
    onDragEnd: (event: DragEndEvent) => void;
    reset: () => void;
}

export const useColumnLayout = <TData>(options: UseColumnLayoutOptions<TData>): UseColumnLayoutResult => {
    const { columns, storageKey, lockedColumnIds } = options;

    const columnIds = useMemo(() => columns.map((column) => getColumnId(column)).filter(Boolean), [columns]);

    const columnLabels = useMemo(() => {
        const labels: Record<string, string> = {};

        columns.forEach((column) => {
            const id = getColumnId(column);

            if (id) {
                labels[id] = getColumnLabel(column, id);
            }
        });

        return labels;
    }, [columns]);

    const layout = useTableLayout({ storageKey, columnIds, lockedColumnIds });

    const [columnOrder, setColumnOrder] = useState<string[]>(layout.columnOrder);
    const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(layout.columnWidths);
    const [columnSizingInfo, setColumnSizingInfo] = useState<ColumnSizingInfoState>(INITIAL_SIZING_INFO);
    /**
     * Only a real resize may be persisted: reading a stored layout also normalises it (widths for
     * columns that no longer render are dropped), and writing that back would delete a width for a
     * column the user simply cannot see right now.
     */
    const isResizeGesture = useRef(false);

    const isResizing = Boolean(columnSizingInfo.isResizingColumn);
    const layoutOrderKey = layout.columnOrder.join(',');
    const layoutWidthsKey = JSON.stringify(layout.columnWidths);
    const columnSizingKey = JSON.stringify(columnSizing);

    // Adopt the stored layout once the profile loads and whenever it changes elsewhere (a reset,
    // another tab); local state drives the live drag and resize in between, which is why the
    // `layout.columnOrder` identity is deliberately not a dependency.
    useEffect(() => {
        setColumnOrder(layout.columnOrder);
    }, [layoutOrderKey, layout.revision]);

    useEffect(() => {
        isResizeGesture.current = false;
        setColumnSizing(layout.columnWidths);
    }, [layoutWidthsKey, layout.revision]);

    const handleColumnSizingChange = useCallback<OnChangeFn<ColumnSizingState>>((updater) => {
        isResizeGesture.current = true;
        setColumnSizing(updater);
    }, []);

    // Double-clicking a resize handle resets a width without ever setting isResizingColumn, so
    // watch both rather than the flag alone.
    useDidUpdate(() => {
        if (isResizing || !isResizeGesture.current) {
            return;
        }

        isResizeGesture.current = false;
        layout.saveWidths(columnSizing);
    }, [isResizing, columnSizingKey]);

    const onDragEnd = useCallback(
        (event: DragEndEvent) => {
            const movable = columnOrder.filter((id) => !lockedColumnIds.includes(id));
            // `move` returns the array it was given when the drop was cancelled, missed a target,
            // or landed back on the source, so reference equality is the "nothing happened" signal.
            const reordered = move(movable, event);

            if (reordered === movable) {
                return;
            }

            const queue = [...reordered];
            const nextOrder = columnOrder.map((id) => (lockedColumnIds.includes(id) ? id : (queue.shift() as string)));

            setColumnOrder(nextOrder);
            // Store only the movable columns: a locked id's position is owned by the column definitions.
            layout.saveOrder(reordered);
        },
        [columnOrder, lockedColumnIds, layout],
    );

    return {
        isEnabled: layout.isEnabled,
        isCustomized: layout.isCustomized,
        // Deliberately NOT gated on an in-flight resize: the resizer is its own element, and a stuck
        // `isResizingColumn` would leave every drag handle hidden until something forced a re-render.
        canReorder: layout.isEnabled,
        columnLabels,
        columnOrder,
        columnSizing,
        columnSizingInfo,
        sortableColumnIds: columnOrder.filter((id) => !lockedColumnIds.includes(id)),
        setColumnOrder,
        setColumnSizing: handleColumnSizingChange,
        setColumnSizingInfo,
        onDragEnd,
        reset: layout.reset,
    };
};
