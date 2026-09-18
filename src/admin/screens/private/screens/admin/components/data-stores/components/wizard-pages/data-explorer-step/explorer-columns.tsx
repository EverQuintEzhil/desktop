import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import {
    formatExplorerColumnHeader,
    getExplorerColumnSize,
    renderExplorerCellValue,
    sortExplorerColumnKeys,
} from './explorer-cell-formatters';
import type { DocumentRow } from './types';

const columnHelper = createColumnHelper<DocumentRow>();

type BuildExplorerColumnsParams = {
    data: DocumentRow[];
    expandedRows: Record<string, boolean>;
    toggleRow: (id: string) => void;
};

export const buildExplorerColumns = ({
    data,
    expandedRows,
    toggleRow,
}: BuildExplorerColumnsParams): ColumnDef<DocumentRow>[] => {
    if (data.length === 0) return [];

    const allKeys = sortExplorerColumnKeys(Array.from(new Set(data.flatMap((item) => Object.keys(item)))));

    const dynamicColumns = allKeys.map((key) => {
        return columnHelper.accessor(key, {
            id: key,
            header: formatExplorerColumnHeader(key),
            enableSorting: false,
            cell: ({ getValue }) =>
                renderExplorerCellValue({
                    key,
                    value: getValue(),
                }),
            size: getExplorerColumnSize(key),
            minSize: 72,
            maxSize: 640,
        });
    });

    return [
        columnHelper.display({
            id: 'expander',
            header: () => null,
            enableSorting: false,
            enableResizing: false,
            cell: ({ row }) => {
                const rowKey = String(row.original._id);
                const isExpanded = Boolean(expandedRows[rowKey]);

                return (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={(event) => {
                            event.stopPropagation();
                            toggleRow(rowKey);
                        }}
                        className={cn(
                            'size-7 shrink-0 text-muted-foreground',
                            isExpanded && 'bg-muted text-foreground',
                        )}
                        aria-expanded={isExpanded}
                        aria-label={isExpanded ? 'Collapse document' : 'Expand document'}
                    >
                        {isExpanded ? <ChevronDownIcon className="size-4" /> : <ChevronRightIcon className="size-4" />}
                    </Button>
                );
            },
            size: 44,
            minSize: 44,
            maxSize: 44,
        }),
        ...dynamicColumns,
    ];
};
