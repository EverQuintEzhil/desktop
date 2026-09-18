import { ArrowDownIcon, ChevronRightIcon } from 'lucide-react';
import { useState } from 'react';

import type { MemoryDoc } from '@/lib/api/admin/memory-docs';
import { cn } from '@/lib/utils';
import { formatDateShort, formatDateTime } from '@/utils/date';

import type { MemoryDocsSort } from './hooks/use-memories-queries';

export type MemoryDocsSortKey = 'createdAt' | 'updatedAt';

const SORT_COLUMNS: { key: MemoryDocsSortKey; label: string }[] = [
    { key: 'createdAt', label: 'Created' },
    { key: 'updatedAt', label: 'Updated' },
];

const ROW_GRID = 'grid grid-cols-[minmax(0,1fr)_110px_110px] items-center gap-x-5 max-sm:grid-cols-[minmax(0,1fr)]';

interface MemoryDocsTableProps {
    docs: MemoryDoc[];
    sort?: MemoryDocsSort;
    onSortChange?: (sort: MemoryDocsSort) => void;
}

const MemoryDocsTable = ({ docs, sort, onSortChange }: MemoryDocsTableProps) => {
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const [sortKey, sortDir] = (sort ?? 'updatedAt:desc').split(':') as [MemoryDocsSortKey, 'asc' | 'desc'];

    const onSortColumn = (key: MemoryDocsSortKey) => {
        const nextDir = sortKey === key && sortDir === 'desc' ? 'asc' : 'desc';

        onSortChange?.(`${key}:${nextDir}`);
    };

    const renderSortButton = ({ key, label }: (typeof SORT_COLUMNS)[number]) => {
        if (!sort || !onSortChange) {
            return (
                <span key={key} className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                    {label}
                </span>
            );
        }

        const isActive = sortKey === key;

        return (
            <button
                key={key}
                type="button"
                onClick={() => onSortColumn(key)}
                aria-label={`Sort by ${label.toLowerCase()}`}
                aria-pressed={isActive}
                className={cn(
                    'flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-[11px] font-semibold tracking-wider uppercase',
                    isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
            >
                {label}
                <ArrowDownIcon
                    aria-hidden="true"
                    className={cn(
                        'size-3 transition-transform',
                        !isActive && 'opacity-35',
                        isActive && sortDir === 'asc' && 'rotate-180',
                    )}
                />
            </button>
        );
    };

    const renderRow = (doc: MemoryDoc) => {
        const isExpanded = expandedId === doc.id;

        return (
            <div key={doc.id} className="flex flex-col border-t border-border transition-colors hover:bg-muted/30">
                <div className={cn(ROW_GRID, 'px-4 py-3')}>
                    <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : doc.id)}
                        aria-expanded={isExpanded}
                        className="flex w-full min-w-0 cursor-pointer items-start gap-2.5 border-0 bg-transparent p-0 text-left"
                    >
                        <ChevronRightIcon
                            className={cn(
                                'mt-1 size-3.5 shrink-0 text-muted-foreground transition-transform',
                                isExpanded && 'rotate-90',
                            )}
                            aria-hidden="true"
                        />
                        <span
                            className={cn(
                                'min-w-0 text-sm leading-relaxed text-foreground',
                                isExpanded ? 'wrap-break-word whitespace-pre-wrap' : 'truncate',
                            )}
                        >
                            {doc.text}
                        </span>
                    </button>
                    <span className="text-xs whitespace-nowrap text-muted-foreground max-sm:hidden">
                        {formatDateShort(doc.createdAt)}
                    </span>
                    <span className="text-xs whitespace-nowrap text-muted-foreground max-sm:hidden">
                        {formatDateShort(doc.updatedAt)}
                    </span>
                </div>
                {isExpanded && (
                    <dl className="mr-4 mb-3 ml-10 grid grid-cols-1 gap-3 border-t border-border/60 pt-2.5 sm:grid-cols-2 sm:gap-6">
                        {[
                            { label: 'Created', value: doc.createdAt },
                            { label: 'Updated', value: doc.updatedAt },
                        ].map((entry) => (
                            <div key={entry.label} className="flex flex-col gap-0.5">
                                <dt className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                                    {entry.label}
                                </dt>
                                <dd className="text-xs font-medium text-foreground">{formatDateTime(entry.value)}</dd>
                            </div>
                        ))}
                    </dl>
                )}
            </div>
        );
    };

    return (
        <div className="memory-docs-table flex flex-col">
            <div className={cn(ROW_GRID, 'bg-muted px-4 py-2.5')}>
                <span className="pl-6 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                    Fact
                </span>
                <div className="flex max-sm:hidden">{renderSortButton(SORT_COLUMNS[0])}</div>
                <div className="flex max-sm:hidden">{renderSortButton(SORT_COLUMNS[1])}</div>
            </div>
            {docs.map(renderRow)}
        </div>
    );
};

export default MemoryDocsTable;
