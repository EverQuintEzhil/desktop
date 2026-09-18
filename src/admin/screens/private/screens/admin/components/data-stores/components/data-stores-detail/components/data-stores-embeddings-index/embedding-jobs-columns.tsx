import { createColumnHelper } from '@tanstack/react-table';
import { SquareIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';

import type { EmbeddingJobType } from './embedding-job-types';
import { EMBEDDING_JOB_STATUS_MAP } from './embedding-jobs-constants';
import { formatEmbeddingJobDateTime, formatJobDuration } from './embedding-jobs-formatting';

const columnHelper = createColumnHelper<EmbeddingJobType>();

export function getEmbeddingJobsColumns(onStopJob: (job: EmbeddingJobType) => void) {
    return [
        columnHelper.display({
            id: 'id',
            header: 'Job Id',
            size: 280,
            enableSorting: false,
            cell: ({ row }) => <p className="font-mono text-sm">{row.original.id || row.original._id || '—'}</p>,
        }),
        columnHelper.display({
            id: 'triggered_at',
            header: 'Triggered',
            size: 200,
            enableSorting: false,
            cell: ({ row }) => <p>{formatEmbeddingJobDateTime(row.original.triggered_at)}</p>,
        }),
        columnHelper.display({
            id: 'started_at',
            header: 'Started',
            size: 200,
            enableSorting: false,
            cell: ({ row }) => <p>{formatEmbeddingJobDateTime(row.original.started_at)}</p>,
        }),
        columnHelper.display({
            id: 'finished_at',
            header: 'Finished',
            size: 200,
            enableSorting: false,
            cell: ({ row }) => <p>{formatEmbeddingJobDateTime(row.original.finished_at)}</p>,
        }),
        columnHelper.display({
            id: 'duration',
            header: 'Duration',
            size: 110,
            enableSorting: false,
            cell: ({ row }) => {
                const d = formatJobDuration(row.original.started_at, row.original.finished_at);

                return <p>{d ?? '—'}</p>;
            },
        }),
        columnHelper.display({
            id: 'status',
            header: 'Status',
            size: 130,
            enableSorting: false,
            cell: ({ row }) => {
                const job = row.original;
                const statusInfo = EMBEDDING_JOB_STATUS_MAP[job.status] ?? {
                    label: job.status.replace(/-/g, ' '),
                    variant: 'default' as const,
                };

                return <p>{statusInfo.label}</p>;
            },
        }),
        columnHelper.display({
            id: 'actions',
            header: 'Actions',
            size: 88,
            enableSorting: false,
            cell: ({ row }) => {
                const job = row.original;

                if (job.status !== 'running') {
                    return <p className="text-center text-muted-foreground">—</p>;
                }

                return (
                    <div
                        className="action-button flex items-center justify-center"
                        onClick={(e) => {
                            e.stopPropagation();
                        }}
                    >
                        <SimpleTooltip content="Stop job" side="bottom">
                            <Button
                                variant="destructive"
                                size="icon-xs"
                                type="button"
                                onClick={() => {
                                    onStopJob(job);
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
