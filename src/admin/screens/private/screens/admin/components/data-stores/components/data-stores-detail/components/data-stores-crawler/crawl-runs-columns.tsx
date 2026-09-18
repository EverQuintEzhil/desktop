import { createColumnHelper } from '@tanstack/react-table';
import { OctagonAlertIcon, SquareIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';

import { JOB_STATUS_MAP } from '../data-stores-embeddings-index/embedding-jobs-constants';
import {
    formatEmbeddingJobDateTime,
    formatJobDuration,
} from '../data-stores-embeddings-index/embedding-jobs-formatting';

import type { WebCrawlRunStats, WebCrawlRunType } from './crawl-run-types';

const columnHelper = createColumnHelper<WebCrawlRunType>();

const TRIGGER_LABELS: Record<WebCrawlRunType['trigger'], string> = {
    manual: 'Manual',
    schedule: 'Schedule',
    create: 'Create',
};

const STATS_SUMMARY_KEYS = ['discovered', 'added', 'updated', 'deleted'] as const;
const STATS_ALL_KEYS = ['discovered', 'fetched', 'unchanged', 'added', 'updated', 'deleted', 'failed'] as const;

const formatStats = (stats: WebCrawlRunStats, keys: readonly (keyof WebCrawlRunStats)[]) =>
    keys
        .filter((key) => stats[key] != null)
        .map((key) => `${stats[key]} ${key}`)
        .join(' · ');

export function getCrawlRunsColumns(onStopRun: (run: WebCrawlRunType) => void) {
    return [
        columnHelper.display({
            id: 'id',
            header: 'Run Id',
            size: 220,
            enableSorting: false,
            cell: ({ row }) => (
                <SimpleTooltip content={row.original.workflowId} side="bottom">
                    <p className="font-mono text-sm">{row.original._id || '—'}</p>
                </SimpleTooltip>
            ),
        }),
        columnHelper.display({
            id: 'trigger',
            header: 'Trigger',
            size: 100,
            enableSorting: false,
            cell: ({ row }) => (
                <Badge variant="secondary">{TRIGGER_LABELS[row.original.trigger] ?? row.original.trigger}</Badge>
            ),
        }),
        columnHelper.display({
            id: 'started_at',
            header: 'Started',
            size: 180,
            enableSorting: false,
            cell: ({ row }) => <p>{formatEmbeddingJobDateTime(row.original.startedAt)}</p>,
        }),
        columnHelper.display({
            id: 'finished_at',
            header: 'Finished',
            size: 180,
            enableSorting: false,
            cell: ({ row }) => <p>{formatEmbeddingJobDateTime(row.original.finishedAt ?? undefined)}</p>,
        }),
        columnHelper.display({
            id: 'duration',
            header: 'Duration',
            size: 100,
            enableSorting: false,
            cell: ({ row }) => {
                const { startedAt, finishedAt } = row.original;
                const d = finishedAt ? formatJobDuration(startedAt, finishedAt) : null;

                return <p>{d ?? '—'}</p>;
            },
        }),
        columnHelper.display({
            id: 'stats',
            header: 'Pages',
            size: 260,
            enableSorting: false,
            cell: ({ row }) => {
                const stats = row.original.stats;

                if (!stats) {
                    return <p className="text-muted-foreground">—</p>;
                }

                const summary = formatStats(stats, STATS_SUMMARY_KEYS);
                const failed = stats.failed ?? 0;

                return (
                    <SimpleTooltip content={formatStats(stats, STATS_ALL_KEYS) || 'No pages processed'} side="bottom">
                        <p className="text-sm text-muted-foreground">
                            {summary || '—'}
                            {failed > 0 && (
                                <span className="text-destructive">
                                    {summary ? ' · ' : ''}
                                    {failed} failed
                                </span>
                            )}
                        </p>
                    </SimpleTooltip>
                );
            },
        }),
        columnHelper.display({
            id: 'status',
            header: 'Status',
            size: 130,
            enableSorting: false,
            cell: ({ row }) => {
                const run = row.original;
                const statusInfo = JOB_STATUS_MAP[run.status] ?? {
                    label: run.status,
                    variant: 'default' as const,
                };

                if (run.status === 'failed' && run.error) {
                    return (
                        <SimpleTooltip content={run.error} side="bottom">
                            <p className="flex items-center gap-1">
                                <OctagonAlertIcon className="size-3.5 text-destructive" />
                                {statusInfo.label}
                            </p>
                        </SimpleTooltip>
                    );
                }

                return <p>{statusInfo.label}</p>;
            },
        }),
        columnHelper.display({
            id: 'actions',
            header: 'Actions',
            size: 88,
            enableSorting: false,
            cell: ({ row }) => {
                const run = row.original;

                if (run.status !== 'running') {
                    return <p className="text-center text-muted-foreground">—</p>;
                }

                return (
                    <div
                        className="action-button flex items-center justify-center"
                        onClick={(e) => {
                            e.stopPropagation();
                        }}
                    >
                        <SimpleTooltip content="Stop crawl" side="bottom">
                            <Button
                                variant="destructive"
                                size="icon-xs"
                                type="button"
                                aria-label="Stop crawl"
                                onClick={() => {
                                    onStopRun(run);
                                }}
                            >
                                <SquareIcon />
                            </Button>
                        </SimpleTooltip>
                    </div>
                );
            },
        }),
    ];
}
