import { closestCenter } from '@dnd-kit/collision';
import { useSortable } from '@dnd-kit/react/sortable';
import { GripVerticalIcon, RotateCcwIcon } from 'lucide-react';
import type React from 'react';

import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { TableHead } from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface HeadProps {
    label: string;
    colSpan: number;
    width: number;
    ariaSort?: React.AriaAttributes['aria-sort'];
    canReorder: boolean;
    canResetLayout: boolean;
    onResetLayout: () => void;
    children: React.ReactNode;
}

interface ShellProps extends HeadProps {
    elementRef?: (element: Element | null) => void;
    handleRef?: (element: Element | null) => void;
    isDragging?: boolean;
}

interface Props extends HeadProps {
    columnId: string;
    /** Position among the reorderable columns only. `useSortable` requires an index. */
    sortableIndex: number;
}

/**
 * Header cell with an explicit drag handle, which keeps the reorder gesture from competing with the
 * sort click and the resize handle that live in the same cell.
 */
const TableHeadShell = (props: ShellProps) => {
    const {
        label,
        colSpan,
        width,
        ariaSort,
        canReorder,
        canResetLayout,
        onResetLayout,
        children,
        elementRef,
        handleRef,
        isDragging,
    } = props;

    const renderHandle = () => {
        // Locked columns keep the handle's footprint so every header label stays aligned.
        if (!canReorder) {
            return <span className="size-5 shrink-0" aria-hidden="true" />;
        }

        return (
            <button
                ref={handleRef}
                type="button"
                className={cn(
                    'table-drag-handle flex size-5 shrink-0 items-center justify-center rounded-sm border-0 bg-transparent',
                    'cursor-grab p-0 text-muted-foreground outline-none active:cursor-grabbing',
                    'hover:text-foreground focus-visible:ring-1 focus-visible:ring-primary',
                )}
                aria-label={`Reorder ${label} column`}
            >
                <GripVerticalIcon className="size-3.5" />
            </button>
        );
    };

    const head = (
        <TableHead
            ref={elementRef}
            colSpan={colSpan}
            // `ContextMenuTrigger asChild` overwrites `data-slot` with its own, which drops the
            // `[data-slot='table-head'] { position: relative }` rule the absolutely-positioned
            // resize handle depends on -- without this it escapes to the scroll container.
            data-slot="table-head"
            className={cn('h-12 px-4', isDragging && 'is-dragging')}
            style={{ width: `${width}px` }}
            aria-sort={ariaSort}
        >
            {/*
             * h-12 rather than inheriting: the cell centres its content with `vertical-align:
             * middle`, which only applies to a table-cell box, and dnd-kit's drag feedback sets
             * `position: fixed` on this cell -- that blockifies it, so anything relying on
             * vertical-align jumps to the top the instant a drag starts.
             */}
            <div className="flex h-12 min-w-0 items-center gap-1">
                {renderHandle()}
                {children}
            </div>
        </TableHead>
    );

    if (!canResetLayout) {
        return head;
    }

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>{head}</ContextMenuTrigger>
            <ContextMenuContent className="w-56">
                <ContextMenuItem onClick={onResetLayout}>
                    <RotateCcwIcon className="size-4" />
                    <span>Reset column layout</span>
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );
};

const SortableTableHead = (props: Props) => {
    const { columnId, sortableIndex, ...head } = props;

    const { ref, handleRef, isDragging } = useSortable({
        id: columnId,
        index: sortableIndex,
        collisionDetector: closestCenter,
    });

    return <TableHeadShell {...head} elementRef={ref} handleRef={handleRef} isDragging={isDragging} />;
};

/**
 * A locked column is deliberately not registered as a sortable at all rather than registered with
 * `disabled: true`: dnd-kit's OptimisticSortingPlugin rewrites `index` across every
 * SortableDroppable it collects in the group without checking `disabled`.
 */
const DraggableTableHead = (props: Props) => {
    const { columnId, sortableIndex, ...head } = props;

    if (!head.canReorder) {
        return <TableHeadShell {...head} />;
    }

    return <SortableTableHead {...head} columnId={columnId} sortableIndex={sortableIndex} />;
};

export default DraggableTableHead;
