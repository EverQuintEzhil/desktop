import { CopyButton } from '@/components';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { formatDateTime, formatRelativeTime } from '@/utils/date';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

const COLUMN_ORDER: Record<string, number> = {
    _id: 0,
    id: 1,
    title: 2,
    name: 3,
    status: 4,
    priority: 5,
    description: 6,
};

const STATUS_BADGE_CLASS: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
    completed: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
    success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
    done: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
    pending: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
    in_progress: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400',
    processing: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400',
    open: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400',
    failed: 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400',
    error: 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400',
    cancelled: 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400',
    canceled: 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400',
    inactive: 'bg-muted text-muted-foreground',
    draft: 'bg-muted text-muted-foreground',
};

const PRIORITY_BADGE_CLASS: Record<string, string> = {
    critical: 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400',
    high: 'bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400',
    medium: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
    low: 'bg-muted text-muted-foreground',
};

const LONG_TEXT_KEYS = new Set(['description', 'body', 'content', 'notes', 'summary', 'message']);

export type ExplorerCellVariant = 'table' | 'detail';

export const formatExplorerColumnHeader = (key: string): string => {
    if (key === '_id') return 'ID';

    return key
        .replace(/_/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\b\w/g, (char) => char.toUpperCase());
};

export const sortExplorerColumnKeys = (keys: string[]): string[] => {
    return [...keys].sort((left, right) => {
        const leftPriority = COLUMN_ORDER[left] ?? COLUMN_ORDER[left.toLowerCase()] ?? 100;
        const rightPriority = COLUMN_ORDER[right] ?? COLUMN_ORDER[right.toLowerCase()] ?? 100;

        if (leftPriority !== rightPriority) {
            return leftPriority - rightPriority;
        }

        return left.localeCompare(right);
    });
};

export const isIdField = (key: string): boolean => {
    if (key === '_id' || key === 'id') return true;

    return /Id$/.test(key) || /_id$/.test(key);
};

export const isDateFieldKey = (key: string): boolean => {
    return /(?:At|Date|Time|On)$/i.test(key) || /^(created|updated|deleted|due|expir)/i.test(key);
};

export const isIsoDateString = (value: unknown): value is string => {
    return typeof value === 'string' && ISO_DATE_RE.test(value) && !Number.isNaN(Date.parse(value));
};

export const isStatusFieldKey = (key: string): boolean => {
    return key.toLowerCase() === 'status' || /Status$/.test(key);
};

export const isPriorityFieldKey = (key: string): boolean => {
    return key.toLowerCase() === 'priority';
};

export const getExplorerColumnSize = (key: string): number => {
    if (key === '_id' || isIdField(key)) return 132;
    if (isDateFieldKey(key)) return 220;
    if (isStatusFieldKey(key) || isPriorityFieldKey(key)) return 108;
    if (LONG_TEXT_KEYS.has(key.toLowerCase())) return 240;
    if (/email/i.test(key)) return 200;
    if (key === 'title' || key === 'name') return 180;

    return 150;
};

const renderEmptyValue = () => (
    <span className="text-muted-foreground/50" aria-hidden>
        —
    </span>
);

const renderBadge = (label: string, className: string) => (
    <span
        className={cn(
            'inline-flex max-w-full items-center rounded-md px-2 py-0.5',
            'truncate text-xs font-medium capitalize',
            className,
        )}
    >
        {label.replace(/_/g, ' ')}
    </span>
);

const renderIdCell = (value: string, variant: ExplorerCellVariant) => {
    if (variant === 'detail') {
        return (
            <div className="flex min-w-0 items-end gap-2">
                <span className="min-w-0 font-mono text-sm wrap-break-word text-foreground">{value}</span>
                <CopyButton text={value} className="copy-button ml-0 h-4 w-4 shrink-0" />
            </div>
        );
    }

    return (
        <div className="flex min-w-0 items-center gap-1.5">
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{value}</span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-sm font-mono text-xs break-all">
                    {value}
                </TooltipContent>
            </Tooltip>
            <CopyButton text={value} className="copy-button h-4 w-4 shrink-0" />
        </div>
    );
};

const renderDateCell = (value: string) => (
    <Tooltip>
        <TooltipTrigger asChild>
            <time dateTime={value} className="block max-w-full min-w-0 truncate text-sm text-foreground tabular-nums">
                {formatDateTime(value)}
            </time>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-sm break-all">
            {formatRelativeTime(value)}
        </TooltipContent>
    </Tooltip>
);

const renderBooleanCell = (value: boolean) =>
    renderBadge(
        value ? 'Yes' : 'No',
        value
            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
            : 'bg-muted text-muted-foreground',
    );

const renderStatusCell = (value: string) => {
    const normalized = value.toLowerCase().replace(/\s+/g, '_');
    const badgeClass = STATUS_BADGE_CLASS[normalized] ?? 'bg-muted text-muted-foreground';

    return renderBadge(value, badgeClass);
};

const renderPriorityCell = (value: string) => {
    const normalized = value.toLowerCase();
    const badgeClass = PRIORITY_BADGE_CLASS[normalized] ?? 'bg-muted text-muted-foreground';

    return renderBadge(value, badgeClass);
};

const renderTextCell = (value: string, key: string, variant: ExplorerCellVariant) => {
    const isLongText = LONG_TEXT_KEYS.has(key.toLowerCase());

    if (variant === 'detail') {
        return (
            <span className="block min-w-0 text-sm wrap-break-word whitespace-pre-wrap text-foreground">{value}</span>
        );
    }

    if (isLongText) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className="line-clamp-2 block min-w-0 text-sm text-foreground">{value}</span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-sm wrap-break-word whitespace-pre-wrap">
                    {value}
                </TooltipContent>
            </Tooltip>
        );
    }

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span className="block max-w-full min-w-0 truncate text-sm text-foreground">{value}</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-sm break-all">
                {value}
            </TooltipContent>
        </Tooltip>
    );
};

const renderNestedValue = (value: unknown) => (
    <pre
        className={cn(
            'scrollbar-controller scrollbar-vertical scrollbar-horizontal max-h-40 rounded-md border border-border/60',
            'bg-muted/40 p-2 font-mono text-xs text-foreground',
        )}
    >
        {JSON.stringify(value, null, 2)}
    </pre>
);

type RenderExplorerCellValueParams = {
    key: string;
    value: unknown;
    variant?: ExplorerCellVariant;
};

export const renderExplorerCellValue = ({ key, value, variant = 'table' }: RenderExplorerCellValueParams) => {
    if (value === null || value === undefined || value === '') {
        return renderEmptyValue();
    }

    if (key === '_id' || isIdField(key)) {
        return renderIdCell(String(value), variant);
    }

    if (typeof value === 'boolean') {
        return renderBooleanCell(value);
    }

    if (typeof value === 'number') {
        return <span className="block max-w-full min-w-0 truncate text-sm text-foreground tabular-nums">{value}</span>;
    }

    if (Array.isArray(value)) {
        if (variant === 'detail') {
            return renderNestedValue(value);
        }

        return <span className="text-xs text-muted-foreground">Array ({value.length})</span>;
    }

    if (typeof value === 'object') {
        if (variant === 'detail') {
            return renderNestedValue(value);
        }

        return <span className="text-xs text-muted-foreground">Object</span>;
    }

    const stringValue = String(value);

    if (isDateFieldKey(key) || isIsoDateString(stringValue)) {
        return renderDateCell(stringValue);
    }

    if (isStatusFieldKey(key)) {
        return renderStatusCell(stringValue);
    }

    if (isPriorityFieldKey(key)) {
        return renderPriorityCell(stringValue);
    }

    return renderTextCell(stringValue, key, variant);
};
