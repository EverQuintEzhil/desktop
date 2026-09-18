import { type ColumnDef, flexRender, type Table } from '@tanstack/react-table';
import { Fragment, type MouseEvent } from 'react';

import SpinnerBlade from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

import { ExplorerDocumentDetail } from './explorer-document-detail';
import type { DocumentRow } from './types';

type ExplorerResultsTableProps = {
    explorerTable: Table<DocumentRow>;
    columns: ColumnDef<DocumentRow>[];
    expandedRows: Record<string, boolean>;
    loading: boolean;
    toggleRow: (id: string) => void;
};

const isInteractiveTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) return false;

    return Boolean(target.closest('button, a, input, textarea, select, [role="button"], .copy-button'));
};

export const ExplorerResultsTable = ({
    explorerTable,
    columns,
    expandedRows,
    loading,
    toggleRow,
}: ExplorerResultsTableProps) => {
    const handleRowClick = (rowId: string, event: MouseEvent<HTMLTableRowElement>) => {
        if (isInteractiveTarget(event.target)) return;

        toggleRow(rowId);
    };

    const renderExplorerRows = () => {
        const rows = explorerTable.getRowModel().rows;

        if (rows.length === 0 && loading) {
            return (
                <tr>
                    <td colSpan={columns.length || 1}>
                        <div className="table-loading flex w-full flex-col gap-3 overflow-hidden p-4">
                            <div className="table-loading-inner" />
                            <div className="table-loading-inner" />
                        </div>
                    </td>
                </tr>
            );
        }

        if (!Array.isArray(rows) || rows.length === 0) {
            return null;
        }

        return rows.map((row, rowIndex) => {
            const rowKey = String(row.original._id);
            const isExpanded = Boolean(expandedRows[rowKey]);

            return (
                <Fragment key={row.id}>
                    <tr
                        className={cn(
                            'data-explorer-row group cursor-pointer border-b border-border/40',
                            'transition-colors hover:bg-muted/50',
                            rowIndex % 2 === 1 && 'bg-muted/15',
                            isExpanded && 'bg-primary/5 hover:bg-primary/10',
                        )}
                        onClick={(event) => handleRowClick(rowKey, event)}
                        aria-expanded={isExpanded}
                    >
                        {row.getVisibleCells().map((cell) => (
                            <td
                                key={cell.id}
                                className={cn(
                                    'overflow-hidden px-3 py-2.5 align-middle',
                                    cell.column.id === 'expander' && 'w-11 px-1',
                                )}
                                style={{
                                    width: cell.column.getSize(),
                                    maxWidth: cell.column.getSize(),
                                }}
                            >
                                <div
                                    className={cn(
                                        'max-w-full min-w-0',
                                        cell.column.id === 'expander'
                                            ? 'flex justify-center'
                                            : 'table-cell-content text-sm',
                                    )}
                                >
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </div>
                            </td>
                        ))}
                    </tr>
                    {isExpanded ? (
                        <tr className="data-explorer-expand-row">
                            <td className="data-explorer-expand-cell p-0 align-top" colSpan={columns.length}>
                                <ExplorerDocumentDetail document={row.original} onCollapse={() => toggleRow(rowKey)} />
                            </td>
                        </tr>
                    ) : null}
                </Fragment>
            );
        });
    };

    return (
        <div className="data-explorer-table-host flex min-h-0 max-w-full min-w-0 flex-1 flex-col overflow-hidden">
            <div className="table-box overflow-hidden">
                <div className="table-controller scrollbar-controller scrollbar-vertical scrollbar-horizontal relative">
                    <table
                        className="table-styled table-fixed border-collapse"
                        style={{
                            width: explorerTable.getCenterTotalSize(),
                        }}
                    >
                        <thead>
                            {explorerTable.getHeaderGroups().map((headerGroup) => (
                                <tr key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => (
                                        <th
                                            key={header.id}
                                            colSpan={header.colSpan}
                                            className={cn(
                                                'border-b border-border/60',
                                                header.column.id === 'expander' && 'w-11 px-1',
                                            )}
                                            style={{
                                                width: `${header.getSize()}px`,
                                            }}
                                        >
                                            {header.isPlaceholder ? null : (
                                                <>
                                                    <div
                                                        className="flex min-h-9 items-center justify-start gap-2 px-3"
                                                        role="presentation"
                                                    >
                                                        <span
                                                            className={cn(
                                                                'text-[11px] font-semibold tracking-wide uppercase',
                                                                'text-muted-foreground',
                                                            )}
                                                        >
                                                            {flexRender(
                                                                header.column.columnDef.header,
                                                                header.getContext(),
                                                            )}
                                                        </span>
                                                    </div>
                                                    {header.column.getCanResize() ? (
                                                        <div
                                                            className={cn(
                                                                'resizer',
                                                                explorerTable.options.columnResizeDirection,
                                                                header.column.getIsResizing() && 'is-resizing',
                                                            )}
                                                            onDoubleClick={() => header.column.resetSize()}
                                                            onMouseDown={header.getResizeHandler()}
                                                            onTouchStart={header.getResizeHandler()}
                                                        />
                                                    ) : null}
                                                </>
                                            )}
                                        </th>
                                    ))}
                                </tr>
                            ))}
                        </thead>
                        <tbody>{renderExplorerRows()}</tbody>
                    </table>
                    <div className={cn('loading-styled', loading && 'active')}>
                        <div
                            className="loading-inner flex items-center justify-center"
                            style={{ minWidth: explorerTable.getCenterTotalSize() }}
                        >
                            <SpinnerBlade />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
