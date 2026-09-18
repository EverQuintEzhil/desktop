import { type Cell, flexRender } from '@tanstack/react-table';
import { Link } from 'react-router-dom';

import { TableCell } from '@/components/ui/table';

import { SELECT_COLUMN_ID } from '../constants';

const UNLINKED_COLUMN_IDS = ['actions', SELECT_COLUMN_ID];

interface Props<TData> {
    cells: Cell<TData, unknown>[];
    /** When set, each cell (except actions and the selection checkbox) becomes a link covering the whole cell. */
    rowUrl?: string;
}

/**
 * Body cells are deliberately NOT dnd-kit sortables. dnd-kit keys its droppable and
 * draggable registries by id alone, so registering a cell per row under the same column id
 * would overwrite the header's registration -- the last row would own the column, and a row
 * unmounting mid-drag (a poll, a page-size change) would delete the drop target outright.
 * Only the header participates in the drag; the cells follow on drop.
 */
const TableRowCells = <TData,>(props: Props<TData>) => {
    const { cells, rowUrl } = props;

    const renderContent = (cell: Cell<TData, unknown>) => {
        const content = (
            <span className="table-cell-content text-sm">
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </span>
        );

        if (!rowUrl || UNLINKED_COLUMN_IDS.includes(cell.column.id)) {
            return content;
        }

        return (
            <Link
                to={rowUrl}
                className="box-border block h-full w-full px-4 py-3 text-inherit no-underline"
                onClick={(e) => e.stopPropagation()}
            >
                {content}
            </Link>
        );
    };

    return cells.map((cell) => {
        const flush = Boolean(rowUrl) && !UNLINKED_COLUMN_IDS.includes(cell.column.id);

        return (
            <TableCell
                key={cell.id}
                className="px-4 py-3"
                style={{ width: cell.column.getSize(), padding: flush ? 0 : undefined }}
            >
                {renderContent(cell)}
            </TableCell>
        );
    });
};

export default TableRowCells;
