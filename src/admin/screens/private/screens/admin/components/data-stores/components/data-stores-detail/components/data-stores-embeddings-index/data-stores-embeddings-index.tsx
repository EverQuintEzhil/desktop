import type { SortingState } from '@tanstack/react-table';
import { CalendarClockIcon, HistoryIcon, PencilIcon, PlayIcon, SettingsIcon, OctagonAlertIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Table } from '@/components';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import SpinnerBlade from '@/components/ui/spinner';
import {
    useWizardDeleteEmbeddingJobMutation,
    useWizardEmbeddingJobRunsQuery,
    useWizardStartEmbeddingJobMutation,
} from '@/lib/api/admin/data-stores';
import { cn } from '@/lib/utils';
import type { DataStoreType } from '@/types/admin';
import { cronToStatement, showErrorToast, showSuccessToast } from '@/utils';

import '../../data-stores-detail.scss';

import { EditCronSideSheet } from './components';
import type { EmbeddingJobType } from './embedding-job-types';
import { getEmbeddingJobsColumns } from './embedding-jobs-columns';

interface Props {
    dataStore: DataStoreType;
    canUserEdit: boolean;
    onSubmit: (value: DataStoreType) => void;
}

const getEmbeddingConfigProviderPath = (provider: DataStoreType['provider']): string => {
    if (provider === 'weblinks') return 'web-links';
    if (provider === 's3' || provider === 'azure-blob-storage' || provider === 'sharepoint') return 'files-folders';

    return 'fields';
};

const DataStoresEmbeddingsIndex = (props: Props) => {
    const { dataStore, onSubmit, canUserEdit } = props;
    const provider = dataStore.provider;
    const providerPath = getEmbeddingConfigProviderPath(provider);

    const [pageIndex, setPageIndex] = useState(0);
    const [pageSize, setPageSize] = useState(10);
    const [sort, setSort] = useState<SortingState>([]);

    const listParams = useMemo(
        () => ({
            page: pageIndex,
            size: pageSize,
            sortBy: sort.map((s) => `${s.id}:${s.desc ? 'desc' : 'asc'}`),
        }),
        [pageIndex, pageSize, sort],
    );

    const runsQuery = useWizardEmbeddingJobRunsQuery(dataStore._id, listParams);
    const deleteEmbeddingJobMutation = useWizardDeleteEmbeddingJobMutation();
    const startEmbeddingJobMutation = useWizardStartEmbeddingJobMutation();

    const rows = (runsQuery.data?.values ?? []) as EmbeddingJobType[];
    const totalCount = runsQuery.data?.page_info?.total_count ?? 0;

    useEffect(() => {
        setPageIndex(0);
    }, [dataStore._id]);

    const handleStopEmbeddingJob = useCallback(
        async (_job: EmbeddingJobType) => {
            try {
                await deleteEmbeddingJobMutation.mutateAsync(dataStore._id);

                showSuccessToast('Embedding job stopped successfully');
                void runsQuery.refetch();
            } catch (error) {
                console.error(error);
                showErrorToast('Failed to trigger embedding job');
            }
        },
        [dataStore._id, deleteEmbeddingJobMutation, runsQuery],
    );

    const embeddingJobsColumns = useMemo(
        () => getEmbeddingJobsColumns(handleStopEmbeddingJob),
        [handleStopEmbeddingJob],
    );

    const handleTriggerEmbeddingJob = useCallback(async () => {
        try {
            await startEmbeddingJobMutation.mutateAsync(dataStore._id);

            showSuccessToast('Embedding job triggered successfully');
            void runsQuery.refetch();
        } catch (error) {
            console.error(error);
            showErrorToast('Failed to trigger embedding job');
        }
    }, [dataStore._id, runsQuery, startEmbeddingJobMutation]);

    const handleRetryJobs = useCallback(() => {
        void runsQuery.refetch();
    }, [runsQuery]);

    const navigate = useNavigate();
    const [isEditCronOpen, setIsEditCronOpen] = useState(false);

    const renderEditCronSheet = () => {
        if (!isEditCronOpen) return null;

        return (
            <EditCronSideSheet
                isOpen={isEditCronOpen}
                onClose={() => {
                    setIsEditCronOpen(false);
                }}
                cron={dataStore.embeddingConfig?.cron ?? ''}
                dataStore={dataStore}
                onEditCron={(dataStore: DataStoreType) => {
                    const data = {
                        ...dataStore,
                    };

                    onSubmit(data);
                }}
            />
        );
    };

    const renderEmbeddingJobs = () => {
        if (runsQuery.isLoading) {
            return (
                <div className="flex flex-col items-center justify-center gap-4 bg-muted/5 py-16 text-center">
                    <SpinnerBlade className="scale-150" />
                    <span className="text-sm text-muted-foreground">Loading embedding jobs…</span>
                </div>
            );
        }

        if (runsQuery.isError) {
            return (
                <div className="flex min-h-[30svh] items-center justify-center py-4">
                    <div className="flex max-w-xs flex-col items-center justify-center gap-4 text-center">
                        <OctagonAlertIcon className="size-4 text-5xl! text-destructive!" />
                        <div className="flex flex-col items-center justify-center gap-2">
                            <h3 className="error-title text-xl font-medium text-(--text-primary)">
                                Failed to Load Embedding Jobs
                            </h3>
                            <span className="font-medium text-text-secondary">
                                Network issue or Embedding Jobs don&apos;t exist
                            </span>
                            <Button
                                type="button"
                                className="retry-button mt-2 min-w-[120px] justify-center rounded-full text-center"
                                onClick={() => {
                                    handleRetryJobs();
                                }}
                            >
                                Retry
                            </Button>
                        </div>
                    </div>
                </div>
            );
        }

        if (rows.length > 0) {
            return (
                <div className={cn('[&_.table-box]:rounded-xl [&_.table-box]:border-border-secondary')}>
                    <Table
                        data={rows}
                        columns={embeddingJobsColumns}
                        loading={runsQuery.isFetching}
                        firstLoading={false}
                        pagination={{
                            pageIndex,
                            pageSize,
                        }}
                        rowCount={totalCount}
                        onPaginationChange={(pagination) => {
                            setPageIndex(pagination.pageIndex);
                            setPageSize(pagination.pageSize);
                        }}
                        search=""
                        onSearchChange={() => {}}
                        onSortingChange={(nextSort) => {
                            setSort(nextSort);
                        }}
                        showHeader={false}
                        showSearch={false}
                    />
                </div>
            );
        }

        return (
            <div className="flex flex-col items-center justify-center gap-3 bg-muted/5 py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-muted-foreground/20 bg-muted/40">
                    <HistoryIcon className="size-4" />
                </div>
                <div className="flex flex-col items-center justify-center gap-1">
                    <span className="text font-medium text-foreground/80">No sync history</span>
                    <span className="max-w-[200px] text-sm text-muted-foreground">
                        Logs will appear here once an indexing job is triggered.
                    </span>
                </div>
            </div>
        );
    };

    return (
        <div className="tab-content data-stores-tab flex flex-col gap-4">
            <div className="data-stores-embeddings-index-header flex items-center justify-end gap-2 px-1">
                <SimpleTooltip content="Embedding Configuration" side="bottom">
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                            navigate(`/admin/data-stores/${dataStore._id}/${providerPath}`);
                        }}
                    >
                        <SettingsIcon />
                    </Button>
                </SimpleTooltip>
                <SimpleTooltip content="Trigger Job" side="bottom">
                    <Button
                        variant="default"
                        size="sm"
                        onClick={handleTriggerEmbeddingJob}
                        disabled={startEmbeddingJobMutation.isPending}
                    >
                        {startEmbeddingJobMutation.isPending ? <SpinnerBlade /> : <PlayIcon className="mr-2" />}
                        {startEmbeddingJobMutation.isPending ? 'Triggering...' : 'Trigger'}
                    </Button>
                </SimpleTooltip>
            </div>

            <Card className="data-stores-embeddings-index-card gap-0 overflow-hidden shadow-none">
                <div className="data-stores-embeddings-index-card-header border-b px-3 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <CalendarClockIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            <h3 className="font-medium">Cron Schedule</h3>
                        </div>
                        {canUserEdit && (
                            <SimpleTooltip content="Edit Cron" side="bottom">
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => {
                                        setIsEditCronOpen(true);
                                    }}
                                    className="h-7 w-7 hover:bg-background/50"
                                >
                                    <PencilIcon className="h-3 w-3" />
                                </Button>
                            </SimpleTooltip>
                        )}
                    </div>
                    {dataStore.embeddingConfig?.cron ? (
                        <div className="flex items-center gap-3">
                            <div className="rounded border bg-background px-2.5 py-1 shadow-sm">
                                <code className="text-lg font-bold tracking-tight text-primary">
                                    {dataStore.embeddingConfig.cron}
                                </code>
                            </div>
                            <span className="text-sm font-medium">
                                {cronToStatement(dataStore.embeddingConfig.cron)}
                            </span>
                        </div>
                    ) : (
                        <span className="text-sm text-muted-foreground italic">
                            No schedule set. Updates must be triggered manually.
                        </span>
                    )}
                </div>

                <div className="data-stores-embeddings-index-card-history-header border-b bg-card px-3 py-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <h4 className="text-base font-bold tracking-tight">Jobs History</h4>
                            <span className="text-sm text-muted-foreground">
                                Monitor recent synchronization activities and their status.
                            </span>
                        </div>
                        <Badge
                            variant="secondary"
                            className="h-5 px-2 py-0 font-mono text-[10px] tracking-tighter uppercase"
                        >
                            {totalCount} total jobs
                        </Badge>
                    </div>
                </div>

                <CardContent className="data-stores-embeddings-index-card-content px-3 py-4">
                    {renderEmbeddingJobs()}
                </CardContent>
            </Card>
            {renderEditCronSheet()}
        </div>
    );
};

export default DataStoresEmbeddingsIndex;
