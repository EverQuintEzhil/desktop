import {
    CalendarClockIcon,
    HistoryIcon,
    OctagonAlertIcon,
    PencilIcon,
    PlayIcon,
    SettingsIcon,
    Trash2Icon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Table } from '@/components';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import ConfirmationModal from '@/components/ui/confirmation-modal';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import SpinnerBlade from '@/components/ui/spinner';
import {
    useWizardDeleteEmbeddingJobMutation,
    useWizardEmbeddingJobRunsQuery,
    useWizardSaveCronMutation,
    useWizardStartEmbeddingJobMutation,
} from '@/lib/api/admin/data-stores';
import { cn } from '@/lib/utils';
import type { DataStoreType } from '@/types/admin';
import { cronToStatement, showErrorToast, showSuccessToast } from '@/utils';

import '../../data-stores-detail.scss';
import { EditCronSideSheet } from '../data-stores-embeddings-index/components';

import type { WebCrawlRunType } from './crawl-run-types';
import { getCrawlRunsColumns } from './crawl-runs-columns';

interface Props {
    dataStore: DataStoreType;
    canUserEdit: boolean;
    onSubmit: (value: DataStoreType) => void;
}

const DataStoresCrawler = (props: Props) => {
    const { dataStore, onSubmit, canUserEdit } = props;

    const [pageIndex, setPageIndex] = useState(0);
    const [pageSize, setPageSize] = useState(10);

    const listParams = useMemo(
        () => ({
            page: pageIndex,
            size: pageSize,
        }),
        [pageIndex, pageSize],
    );

    const runsQuery = useWizardEmbeddingJobRunsQuery(dataStore._id, listParams, { poll: true });
    const stopCrawlMutation = useWizardDeleteEmbeddingJobMutation();
    const startCrawlMutation = useWizardStartEmbeddingJobMutation();
    const saveCronMutation = useWizardSaveCronMutation();

    const rows = (runsQuery.data?.values ?? []) as WebCrawlRunType[];
    const totalCount = runsQuery.data?.page_info?.total_count ?? 0;
    const cron = dataStore.embeddingConfig?.cron;

    useEffect(() => {
        setPageIndex(0);
    }, [dataStore._id]);

    const handleStopCrawl = useCallback(
        async (_run: WebCrawlRunType) => {
            try {
                await stopCrawlMutation.mutateAsync(dataStore._id);

                showSuccessToast('Crawl stopped successfully');
                void runsQuery.refetch();
            } catch (error) {
                console.error(error);
                showErrorToast('Failed to stop crawl');
            }
        },
        [dataStore._id, stopCrawlMutation, runsQuery],
    );

    const crawlRunsColumns = useMemo(() => getCrawlRunsColumns(handleStopCrawl), [handleStopCrawl]);

    const handleTriggerCrawl = useCallback(async () => {
        try {
            await startCrawlMutation.mutateAsync(dataStore._id);

            showSuccessToast('Crawl triggered successfully');
            void runsQuery.refetch();
        } catch (error) {
            console.error(error);
            const axiosError = error as { response?: { data?: { message?: string }; status?: number } };

            if (axiosError.response?.status === 409) {
                showErrorToast(axiosError.response.data?.message ?? 'A crawl is already running for this data store.');
            } else {
                showErrorToast('Failed to trigger crawl');
            }
            void runsQuery.refetch();
        }
    }, [dataStore._id, runsQuery, startCrawlMutation]);

    const handleRetryRuns = useCallback(() => {
        void runsQuery.refetch();
    }, [runsQuery]);

    const navigate = useNavigate();
    const [isEditCronOpen, setIsEditCronOpen] = useState(false);
    const [isRemoveScheduleOpen, setIsRemoveScheduleOpen] = useState(false);

    const handleRemoveSchedule = useCallback(async () => {
        try {
            const result = await saveCronMutation.mutateAsync({
                id: dataStore._id,
                data: { cron: null },
            });

            onSubmit(result);
            showSuccessToast('Schedule removed successfully');
            setIsRemoveScheduleOpen(false);
        } catch (error) {
            console.error(error);
            const axiosError = error as { response?: { data?: { message?: string } } };

            showErrorToast(axiosError.response?.data?.message ?? 'Failed to remove schedule');
        }
    }, [dataStore._id, onSubmit, saveCronMutation]);

    const renderEditCronSheet = () => {
        if (!isEditCronOpen) return null;

        return (
            <EditCronSideSheet
                isOpen={isEditCronOpen}
                onClose={() => {
                    setIsEditCronOpen(false);
                }}
                cron={cron ?? ''}
                dataStore={dataStore}
                onEditCron={(dataStore: DataStoreType) => {
                    onSubmit({ ...dataStore });
                }}
            />
        );
    };

    const renderCrawlRuns = () => {
        if (runsQuery.isLoading) {
            return (
                <div className="flex flex-col items-center justify-center gap-4 bg-muted/5 py-16 text-center">
                    <SpinnerBlade className="scale-150" />
                    <span className="text-sm text-muted-foreground">Loading crawl runs…</span>
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
                                Failed to Load Crawl Runs
                            </h3>
                            <span className="font-medium text-text-secondary">
                                Network issue or crawl runs don&apos;t exist
                            </span>
                            <Button
                                type="button"
                                className="retry-button mt-2 min-w-[120px] justify-center rounded-full text-center"
                                onClick={() => {
                                    handleRetryRuns();
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
                        columns={crawlRunsColumns}
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
                    <span className="text font-medium text-foreground/80">No crawl history</span>
                    <span className="max-w-[200px] text-sm text-muted-foreground">
                        Runs will appear here once a crawl is triggered.
                    </span>
                </div>
            </div>
        );
    };

    return (
        <div className="tab-content data-stores-tab flex flex-col gap-4">
            <div className="data-stores-embeddings-index-header flex items-center justify-end gap-2 px-1">
                <SimpleTooltip content="Configure Web Links" side="bottom">
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Configure web links"
                        onClick={() => {
                            navigate(`/admin/data-stores/${dataStore._id}/web-links`);
                        }}
                    >
                        <SettingsIcon />
                    </Button>
                </SimpleTooltip>
                <SimpleTooltip content="Crawl the configured links now" side="bottom">
                    <Button
                        variant="default"
                        size="sm"
                        onClick={handleTriggerCrawl}
                        disabled={startCrawlMutation.isPending}
                    >
                        {startCrawlMutation.isPending ? <SpinnerBlade /> : <PlayIcon className="mr-2" />}
                        {startCrawlMutation.isPending ? 'Starting...' : 'Crawl Now'}
                    </Button>
                </SimpleTooltip>
            </div>

            <Card className="data-stores-embeddings-index-card gap-0 overflow-hidden shadow-none">
                <div className="data-stores-embeddings-index-card-header border-b px-3 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <CalendarClockIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            <h3 className="font-medium">Crawl Schedule</h3>
                        </div>
                        {canUserEdit && (
                            <div className="flex items-center gap-1">
                                {cron && (
                                    <SimpleTooltip content="Remove Schedule" side="bottom">
                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            aria-label="Remove schedule"
                                            onClick={() => {
                                                setIsRemoveScheduleOpen(true);
                                            }}
                                            className="h-7 w-7 hover:bg-background/50"
                                        >
                                            <Trash2Icon className="h-3 w-3" />
                                        </Button>
                                    </SimpleTooltip>
                                )}
                                <SimpleTooltip content="Edit Schedule" side="bottom">
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        aria-label="Edit schedule"
                                        onClick={() => {
                                            setIsEditCronOpen(true);
                                        }}
                                        className="h-7 w-7 hover:bg-background/50"
                                    >
                                        <PencilIcon className="h-3 w-3" />
                                    </Button>
                                </SimpleTooltip>
                            </div>
                        )}
                    </div>
                    {cron ? (
                        <div className="flex items-center gap-3">
                            <div className="rounded border bg-background px-2.5 py-1 shadow-sm">
                                <code className="text-lg font-bold tracking-tight text-primary">{cron}</code>
                            </div>
                            <span className="text-sm font-medium">{cronToStatement(cron)}</span>
                        </div>
                    ) : (
                        <span className="text-sm text-muted-foreground italic">
                            No schedule set. Crawls must be triggered manually.
                        </span>
                    )}
                </div>

                <div className="data-stores-embeddings-index-card-history-header border-b bg-card px-3 py-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <h4 className="text-base font-bold tracking-tight">Crawl History</h4>
                            <span className="text-sm text-muted-foreground">
                                Monitor recent crawl runs and their status.
                            </span>
                        </div>
                        <Badge
                            variant="secondary"
                            className="h-5 px-2 py-0 font-mono text-[10px] tracking-tighter uppercase"
                        >
                            {totalCount} total runs
                        </Badge>
                    </div>
                </div>

                <CardContent className="data-stores-embeddings-index-card-content px-3 py-4">
                    {renderCrawlRuns()}
                </CardContent>
            </Card>
            {renderEditCronSheet()}
            <ConfirmationModal
                isOpen={isRemoveScheduleOpen}
                title="Remove Crawl Schedule"
                message="The recurring crawl will stop. A crawl that is currently running is not affected."
                confirmButtonText="Remove"
                isButtonLoading={saveCronMutation.isPending}
                onConfirm={handleRemoveSchedule}
                onClose={() => {
                    setIsRemoveScheduleOpen(false);
                }}
            />
        </div>
    );
};

export default DataStoresCrawler;
