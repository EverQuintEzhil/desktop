import { type ColumnDef, type Table } from '@tanstack/react-table';
import { FileCodeIcon, SearchXIcon, InboxIcon, Table2Icon } from 'lucide-react';
import { type ReactNode } from 'react';

import JSONEditor from '@/components/json-editor';
import { Pagination } from '@/components/table/components';
import { Button } from '@/components/ui/button';
import Select from '@/components/ui/select';
import Switch from '@/components/ui/switch';
import { cn } from '@/lib/utils';

import { ExplorerResultsTable } from './explorer-results-table';
import type { DocumentRow } from './types';

type ExplorerResultsPanelProps = {
    showEmptyFilterMessage: boolean;
    hasActiveQuery?: boolean;
    onResetQuery?: () => void;
    viewMode: 'table' | 'json';
    onViewModeChange: (mode: 'table' | 'json') => void;
    explorerTable: Table<DocumentRow>;
    columns: ColumnDef<DocumentRow>[];
    expandedRows: Record<string, boolean>;
    toggleRow: (id: string) => void;
    data: DocumentRow[];
    loading: boolean;
    provider?: string;
    rangeLabel: string;
    total: number;
    pageSize: number;
    pages: number;
    pageIndex: number;
    onPageSizeChange: (size: number) => void;
    onPageChange: (page: number) => void;
};

export const ExplorerResultsPanel = ({
    showEmptyFilterMessage,
    hasActiveQuery = false,
    onResetQuery,
    viewMode,
    onViewModeChange,
    explorerTable,
    columns,
    expandedRows,
    toggleRow,
    data,
    loading,
    provider,
    rangeLabel,
    total,
    pageSize,
    pages,
    pageIndex,
    onPageSizeChange,
    onPageChange,
}: ExplorerResultsPanelProps) => {
    let explorerPanelBody: ReactNode;

    if (showEmptyFilterMessage) {
        const EmptyIcon = hasActiveQuery ? SearchXIcon : InboxIcon;

        explorerPanelBody = (
            <div
                className={cn(
                    'flex min-h-[220px] min-w-0 flex-1 flex-col items-center justify-center gap-4',
                    'px-6 py-12 text-center',
                )}
                role="status"
            >
                <span
                    className={cn(
                        'flex size-12 items-center justify-center rounded-[14px]',
                        'bg-[color-mix(in_srgb,var(--primary)_8%,var(--surface))] text-primary',
                        'border border-[color-mix(in_srgb,var(--primary)_14%,var(--border))]',
                    )}
                >
                    <EmptyIcon size={20} aria-hidden="true" />
                </span>
                <div className="flex flex-col gap-1">
                    <p className="text-sm font-semibold text-foreground">
                        {hasActiveQuery ? 'No documents match your query' : 'No documents yet'}
                    </p>
                    <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                        {hasActiveQuery
                            ? 'Adjust the query parameters or reset the query to see all documents.'
                            : 'Once this data source has documents, run a query to explore them here.'}
                    </p>
                </div>
                {hasActiveQuery && onResetQuery ? (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 cursor-pointer"
                        onClick={onResetQuery}
                    >
                        Reset query
                    </Button>
                ) : null}
            </div>
        );
    } else if (viewMode === 'table') {
        explorerPanelBody = (
            <ExplorerResultsTable
                explorerTable={explorerTable}
                columns={columns}
                expandedRows={expandedRows}
                toggleRow={toggleRow}
                loading={loading}
            />
        );
    } else {
        explorerPanelBody = (
            <div className="data-explorer-json-view flex h-full min-h-0 flex-1 flex-col overflow-hidden">
                <JSONEditor
                    content={{ json: data }}
                    readOnly
                    mode="text"
                    statusBar={false}
                    className="data-explorer-json-view-editor h-full min-h-0 flex-1"
                />
            </div>
        );
    }

    const resultSummary =
        loading && total === 0 ? 'Loading results…' : `${rangeLabel} of ${total} document${total === 1 ? '' : 's'}`;

    return (
        <div
            id="explorer-results-panel"
            className={cn(
                'data-explorer-panel flex min-h-0 max-w-full min-w-0 flex-1 flex-col overflow-hidden',
                'rounded-lg border border-border/60 bg-card shadow-xs',
            )}
        >
            <div
                className={cn(
                    'data-explorer-results-header flex shrink-0 items-center justify-between gap-3',
                    'border-b border-border/60 bg-muted/30 px-4 py-2.5',
                )}
            >
                <span className="min-w-0 truncate text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Results</span>
                    <span className="mx-2 text-border" aria-hidden>
                        ·
                    </span>
                    <span className="font-mono text-xs tabular-nums">{resultSummary}</span>
                </span>
                <div
                    id="explorer-view-switch"
                    className="flex shrink-0 items-center"
                    role="group"
                    aria-label="Result view"
                >
                    <Switch
                        options={[
                            { label: 'Table', icon: Table2Icon },
                            { label: 'JSON', icon: FileCodeIcon },
                        ]}
                        activeIndex={viewMode === 'table' ? 0 : 1}
                        onChange={(_event, index) => onViewModeChange(index === 0 ? 'table' : 'json')}
                        width={90}
                    />
                </div>
            </div>

            <div className="data-explorer-results-body flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                {explorerPanelBody}
            </div>

            {provider !== 'opensearch' &&
                provider !== 'elasticsearch' &&
                provider !== 'files' &&
                provider !== 'weblinks' && (
                    <div
                        id="explorer-statusbar"
                        className={cn(
                            'data-explorer-statusbar flex h-11 shrink-0 items-center',
                            'justify-between gap-3 border-t border-border/60',
                            'bg-muted/20 px-4 text-xs text-muted-foreground',
                        )}
                    >
                        <div className="flex min-w-0 items-center gap-2">
                            <span className="text-xs text-muted-foreground">Rows per page</span>
                            <Select<number>
                                placeholder="Select"
                                variant="outline"
                                className="h-7 w-auto max-w-[80px] rounded-md text-xs"
                                popoverClassName="min-w-[120px]"
                                options={[10, 20, 50, 100].map((size) => ({
                                    value: size,
                                    label: String(size),
                                }))}
                                value={pageSize}
                                onChange={(val) => {
                                    if (val == null) return;
                                    onPageSizeChange(val);
                                }}
                            />
                        </div>
                        <Pagination disabled={loading} count={pages} page={pageIndex + 1} onChange={onPageChange} />
                    </div>
                )}
        </div>
    );
};
