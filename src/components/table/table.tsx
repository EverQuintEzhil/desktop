import { RestrictToHorizontalAxis } from '@dnd-kit/abstract/modifiers';
import { DragDropProvider } from '@dnd-kit/react';
import {
    type ColumnDef,
    type Header,
    type PaginationState,
    type SortingState,
    flexRender,
    getCoreRowModel,
    useReactTable,
} from '@tanstack/react-table';
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import Select from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import Spinner from '@/components/ui/spinner';
import { Table as UITable, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MAX_COLUMN_WIDTH, MIN_COLUMN_WIDTH } from '@/hooks/table-layout';
import useDidUpdate from '@/hooks/use-did-update';
import { cn } from '@/lib/utils';

import SearchInput from '../search-input';

import { DraggableTableHead, Pagination, TableRowCells } from './components';
import { SELECT_COLUMN_ID } from './constants';
import { COLUMN_DRAG_SENSORS, useColumnLayout } from './use-column-layout';
import './table.scss';

const DEFAULT_LOCKED_COLUMN_IDS = ['actions'];

interface Props<TData> {
    data: TData[];
    columns: ColumnDef<TData, unknown>[];
    pagination?: PaginationState;
    rowCount?: number;
    onPaginationChange?: (pagination: PaginationState) => void;
    renderLeftHeader?: () => React.ReactNode;
    renderRightHeader?: () => React.ReactNode;
    loading?: boolean;
    onSearchChange?: (search: string) => void;
    onSortingChange?: (sort: SortingState) => void;
    search?: string;
    onRowClick?: (row: unknown, event: React.MouseEvent<HTMLTableRowElement, MouseEvent>) => void;
    getRowUrl?: (row: unknown) => string;
    showHeader?: boolean;
    showSearch?: boolean;
    firstLoading: boolean;
    defaultSorting?: SortingState;
    pageSizeOptions?: number[];
    /**
     * Stable id for this table, under which the per-user column order and widths are stored.
     * Tables without a key mount no drag-and-drop at all.
     */
    columnLayoutKey?: string;
    /** Columns that keep their defined position, such as a trailing actions column. */
    lockedColumnIds?: string[];
    /** Opt-in row selection. Provide all three to render a leading checkbox column. */
    getRowId?: (row: TData) => string;
    selectedIds?: string[];
    onSelectionChange?: (ids: string[]) => void;
}

const Table = <TData,>(props: Props<TData>) => {
    const {
        data,
        columns,
        pagination: paginationProp,
        rowCount,
        onPaginationChange,
        renderLeftHeader,
        renderRightHeader,
        loading,
        onSearchChange,
        onSortingChange,
        search = '',
        onRowClick,
        getRowUrl,
        showHeader = true,
        showSearch = true,
        firstLoading,
        defaultSorting,
        pageSizeOptions = [10, 20, 50, 100],
        columnLayoutKey,
        lockedColumnIds = DEFAULT_LOCKED_COLUMN_IDS,
        getRowId,
        selectedIds,
        onSelectionChange,
    } = props;

    const selectionEnabled = Boolean(getRowId && onSelectionChange);

    const selectColumn: ColumnDef<TData, unknown> | null =
        selectionEnabled && getRowId
            ? {
                  id: SELECT_COLUMN_ID,
                  size: 40,
                  minSize: 40,
                  maxSize: 40,
                  enableSorting: false,
                  header: () => {
                      const visibleIds = data.map(getRowId);
                      const selected = selectedIds ?? [];
                      const selectedVisibleCount = visibleIds.filter((id) => selected.includes(id)).length;
                      const allSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
                      const someSelected = selectedVisibleCount > 0 && !allSelected;

                      return (
                          <Checkbox
                              preventDefault
                              checked={allSelected}
                              indeterminate={someSelected}
                              onChange={(_value, checked) => {
                                  if (!onSelectionChange) return;
                                  const next = new Set(selected);
                                  visibleIds.forEach((id) => {
                                      if (checked) {
                                          next.add(id);
                                      } else {
                                          next.delete(id);
                                      }
                                  });
                                  onSelectionChange(Array.from(next));
                              }}
                          />
                      );
                  },
                  cell: ({ row }) => {
                      const id = getRowId(row.original);
                      const checked = (selectedIds ?? []).includes(id);

                      return (
                          <Checkbox
                              preventDefault
                              value={id}
                              checked={checked}
                              onChange={(value, isChecked) => {
                                  if (!onSelectionChange || value === undefined) return;
                                  const idValue = String(value);
                                  const current = selectedIds ?? [];
                                  const next = isChecked
                                      ? [...current, idValue]
                                      : current.filter((existing) => existing !== idValue);
                                  onSelectionChange(next);
                              }}
                          />
                      );
                  },
              }
            : null;

    const tableColumns = selectColumn ? [selectColumn, ...columns] : columns;
    const effectiveLockedColumnIds = selectionEnabled ? [...lockedColumnIds, SELECT_COLUMN_ID] : lockedColumnIds;

    const sortTitles: Record<string, string> = {
        asc: 'Sort ascending',
        desc: 'Sort descending',
        false: 'Clear sort',
    };

    const getSortTitle = (canSort: boolean, nextSortingOrder: false | 'asc' | 'desc'): string | undefined => {
        if (!canSort) return undefined;

        return sortTitles[String(nextSortingOrder)];
    };
    const renderSortIcon = (sortState: false | 'asc' | 'desc') => {
        return (
            <span className="table-sort-indicator flex shrink-0 flex-col items-center justify-center">
                <ChevronUpIcon
                    className={cn('size-3.5', sortState === 'asc' ? 'text-foreground' : 'text-muted-foreground/45')}
                />
                <ChevronDownIcon
                    className={cn(
                        '-mt-1 size-3.5',
                        sortState === 'desc' ? 'text-foreground' : 'text-muted-foreground/45',
                    )}
                />
            </span>
        );
    };
    const getAriaSort = (canSort: boolean, sortState: false | 'asc' | 'desc'): React.AriaAttributes['aria-sort'] => {
        if (!canSort) {
            return undefined;
        }

        if (sortState === 'asc') {
            return 'ascending';
        }

        if (sortState === 'desc') {
            return 'descending';
        }

        return 'none';
    };
    const [pagination, setPagination] = useState<PaginationState>(
        paginationProp || {
            pageIndex: 0,
            pageSize: 10,
        },
    );
    const [sorting, setSorting] = React.useState<SortingState>(defaultSorting ?? []);
    const defaultSortingKey = (defaultSorting ?? []).map((s) => `${s.id}:${s.desc}`).join(',');

    const layout = useColumnLayout({
        columns: tableColumns,
        storageKey: columnLayoutKey,
        lockedColumnIds: effectiveLockedColumnIds,
    });

    const table = useReactTable({
        data,
        columns: tableColumns,
        rowCount,
        getCoreRowModel: getCoreRowModel(),
        columnResizeMode: 'onChange',
        defaultColumn: { minSize: MIN_COLUMN_WIDTH, maxSize: MAX_COLUMN_WIDTH },
        manualPagination: true,
        onPaginationChange: setPagination,
        onSortingChange: setSorting,
        onColumnOrderChange: layout.setColumnOrder,
        onColumnSizingChange: layout.setColumnSizing,
        onColumnSizingInfoChange: layout.setColumnSizingInfo,
        state: {
            pagination,
            sorting,
            columnOrder: layout.columnOrder,
            columnSizing: layout.columnSizing,
            columnSizingInfo: layout.columnSizingInfo,
        },
        manualSorting: true,
    });

    useDidUpdate(() => {
        onPaginationChange?.(pagination);
    }, [pagination.pageIndex, pagination.pageSize]);

    useDidUpdate(() => {
        onSortingChange?.(sorting);
    }, [sorting]);

    useEffect(() => {
        if (paginationProp) {
            setPagination(paginationProp);
        }
    }, [paginationProp?.pageIndex, paginationProp?.pageSize]);

    useEffect(() => {
        if (defaultSorting) {
            setSorting(defaultSorting);
        }
    }, [defaultSortingKey]);

    useEffect(() => {
        if (loading || rowCount === undefined) {
            return;
        }

        const pageCount = table.getPageCount();
        const target = pageCount > 0 ? pageCount - 1 : 0;

        if (pagination.pageIndex > target) {
            setPagination({ ...pagination, pageIndex: target });
        }
    }, [rowCount, pagination.pageSize, pagination.pageIndex, loading]);

    const renderHeaderContent = (header: Header<TData, unknown>) => {
        if (header.isPlaceholder) {
            return null;
        }

        const canSort = header.column.getCanSort();
        const sortState = header.column.getIsSorted();
        const label = flexRender(header.column.columnDef.header, header.getContext());

        return (
            <>
                {canSort ? (
                    <button
                        type="button"
                        className={cn(
                            'table-sort-trigger flex min-h-8 items-center justify-start gap-2 rounded-md border-0 bg-transparent',
                            'p-0 text-left text-xs font-semibold tracking-wide text-foreground uppercase outline-none',
                            'hover:text-foreground focus-visible:ring-1 focus-visible:ring-primary',
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                        title={getSortTitle(canSort, header.column.getNextSortingOrder())}
                    >
                        <span className="truncate">{label}</span>
                        {renderSortIcon(sortState)}
                    </button>
                ) : (
                    <div className="table-head-label flex min-h-8 min-w-0 items-center text-xs font-semibold tracking-wide text-foreground uppercase">
                        <span className="truncate">{label}</span>
                    </div>
                )}
                <div
                    onDoubleClick={() => header.column.resetSize()}
                    onMouseDown={header.getResizeHandler()}
                    onTouchStart={header.getResizeHandler()}
                    className={`resizer ${table.options.columnResizeDirection} ${header.column.getIsResizing() ? 'is-resizing' : ''}`}
                />
            </>
        );
    };

    const renderHeaderCells = (headers: Header<TData, unknown>[]) => {
        const cells = headers.map((header) => {
            const canSort = header.column.getCanSort();
            const ariaSort = getAriaSort(canSort, header.column.getIsSorted());

            if (!layout.isEnabled) {
                return (
                    <TableHead
                        key={header.id}
                        colSpan={header.colSpan}
                        className="h-12 px-4"
                        style={{ width: `${header.getSize()}px` }}
                        aria-sort={ariaSort}
                    >
                        {renderHeaderContent(header)}
                    </TableHead>
                );
            }

            return (
                <DraggableTableHead
                    key={header.id}
                    columnId={header.column.id}
                    sortableIndex={layout.sortableColumnIds.indexOf(header.column.id)}
                    label={layout.columnLabels[header.column.id] ?? header.column.id}
                    colSpan={header.colSpan}
                    width={header.getSize()}
                    ariaSort={ariaSort}
                    canReorder={layout.canReorder && !effectiveLockedColumnIds.includes(header.column.id)}
                    canResetLayout={layout.isCustomized}
                    onResetLayout={layout.reset}
                >
                    {renderHeaderContent(header)}
                </DraggableTableHead>
            );
        });

        return cells;
    };

    const renderTable = () => (
        <UITable
            className={cn(
                'table-styled w-full caption-bottom border-collapse text-sm',
                layout.isEnabled && 'table-fixed-layout',
            )}
            style={{ width: table.getCenterTotalSize() }}
        >
            <TableHeader className="bg-muted/30">
                {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>{renderHeaderCells(headerGroup.headers)}</TableRow>
                ))}
            </TableHeader>
            <TableBody className={cn('transition-opacity duration-300 ease-out', loading && 'opacity-60')}>
                {renderItems()}
            </TableBody>
        </UITable>
    );

    const renderTableWithDnd = () => {
        if (!layout.isEnabled) {
            return renderTable();
        }

        return (
            <DragDropProvider
                sensors={COLUMN_DRAG_SENSORS}
                modifiers={[RestrictToHorizontalAxis]}
                onDragEnd={layout.onDragEnd}
            >
                {renderTable()}
            </DragDropProvider>
        );
    };

    const renderItems = () => {
        const rows = table.getRowModel().rows;

        if (rows.length > 0) {
            return rows.map((row) => {
                const rowUrl = getRowUrl?.(row.original);
                const hasUrl = Boolean(rowUrl);
                const isClickable = hasUrl || onRowClick !== undefined;

                const handleRowClick = (event: React.MouseEvent) => {
                    if (hasUrl && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
                        if (onRowClick) {
                            event.preventDefault();
                            onRowClick(row.original, event as React.MouseEvent<HTMLTableRowElement, MouseEvent>);
                        }
                    } else if (!hasUrl) {
                        onRowClick?.(row.original, event as React.MouseEvent<HTMLTableRowElement, MouseEvent>);
                    }
                };

                return (
                    <TableRow key={row.id} onClick={handleRowClick} className={cn(isClickable && 'cursor-pointer')}>
                        <TableRowCells cells={row.getVisibleCells()} rowUrl={rowUrl} />
                    </TableRow>
                );
            });
        }
        if (loading) {
            return (
                <TableRow>
                    <TableCell colSpan={tableColumns.length}>
                        <div className="table-loading flex w-full flex-col gap-3 overflow-hidden p-4">
                            <div className="table-loading-inner" />
                            <div className="table-loading-inner" />
                        </div>
                    </TableCell>
                </TableRow>
            );
        }

        return (
            <TableRow className="no-row-found">
                <TableCell colSpan={tableColumns.length} className="px-4">
                    <span className="text-text-secondary">No rows found</span>
                </TableCell>
            </TableRow>
        );
    };

    const renderTableRow = () => {
        return (
            <div className="w-full px-3 py-4">
                <Skeleton className="h-5 w-full rounded-lg" />
            </div>
        );
    };

    if (firstLoading) {
        return (
            <div className="table-box flex w-full flex-col rounded-lg border border-border-secondary bg-card">
                <div className="flex items-center justify-between p-4">
                    <Skeleton className="h-9 w-full max-w-[200px] rounded-lg" />
                    <Skeleton className="h-9 w-full max-w-[100px] rounded-lg" />
                </div>
                <div className={`flex-col px-4 ${loading ? 'active' : ''}`}>
                    {renderTableRow()}
                    {renderTableRow()}
                    {renderTableRow()}
                    {renderTableRow()}
                </div>
            </div>
        );
    }

    return (
        <div className="table-box overflow-hidden">
            {showHeader ? (
                <div
                    className={cn(
                        'table-header flex flex-wrap items-end gap-3 p-4',
                        showSearch || renderLeftHeader ? 'justify-between' : 'justify-end',
                    )}
                >
                    {showSearch || renderLeftHeader ? (
                        <div className="flex min-w-0 flex-wrap items-end gap-3">
                            {renderLeftHeader?.()}
                            {showSearch ? (
                                <SearchInput
                                    searchOnChange
                                    placeholder="Search"
                                    className="w-full max-w-[240px]"
                                    inputClassName="shadow-none! focus:border-primary focus:ring-0!"
                                    search={search}
                                    onChange={(value) => {
                                        if (onSearchChange) {
                                            onSearchChange(value);
                                        }
                                    }}
                                />
                            ) : null}
                        </div>
                    ) : null}
                    {renderRightHeader?.()}
                </div>
            ) : null}
            <div
                className={cn(
                    'table-controller scrollbar-controller scrollbar-vertical scrollbar-horizontal relative',
                    loading && 'overflow-hidden',
                )}
            >
                {renderTableWithDnd()}
                <div
                    className={cn('loading-styled', loading && 'active')}
                    style={{ minWidth: table.getCenterTotalSize() }}
                >
                    <div className="loading-inner">
                        <Spinner />
                    </div>
                </div>
            </div>
            {paginationProp && (
                <div className="table-pagination flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="row-per-pagination flex items-center gap-3">
                        <span className="text-sm">Row per page</span>
                        <Select<number>
                            placeholder="Select"
                            variant="outline"
                            className="w-auto max-w-[80px] rounded-full"
                            popoverClassName="min-w-[120px]"
                            options={pageSizeOptions.map((size) => ({
                                value: size,
                                label: String(size),
                            }))}
                            value={pagination.pageSize}
                            onChange={(val) => {
                                if (val != null) {
                                    setPagination({
                                        ...pagination,
                                        pageIndex: 0,
                                        pageSize: val,
                                    });
                                }
                            }}
                        />
                    </div>
                    <Pagination
                        disabled={loading}
                        count={table.getPageCount()}
                        page={pagination.pageIndex + 1}
                        onChange={(page) => {
                            setPagination({
                                ...pagination,
                                pageIndex: page - 1,
                            });
                        }}
                    />
                </div>
            )}
        </div>
    );
};

export default Table;
