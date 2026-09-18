import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

import type { WizardFormPageHandle } from '@/admin/components/wizard';
import { Button } from '@/components/ui/button';
import SpinnerBlade from '@/components/ui/spinner';
import Switch from '@/components/ui/switch';
import { useIsMobile } from '@/hooks';
import { cn } from '@/lib/utils';

import './data-explorer-step.scss';
import type { DataStoreType } from '@/types/admin';

import { ExplorerQueryFields } from './explorer-query-fields';
import { formatExplorerMethodOptionLabel } from './explorer-query-helpers';
import { ExplorerResultsPanel } from './explorer-results-panel';
import { useExplorerQuery } from './hooks/use-explorer-query';
import S3FileBrowser from './s3-file-browser';
import type { DataExplorerStepProps } from './types';
import { useExplorerLayoutVars } from './use-explorer-layout-vars';

export const DataExplorerStep = forwardRef<WizardFormPageHandle, DataExplorerStepProps>(
    ({ setCanGoNext, commonData, isWizardPage = true }, ref) => {
        const submitStep = useCallback(async (): Promise<boolean> => {
            const w = commonData as {
                dontSkipEmbeddingFields?: boolean;
                requestEmbeddingFieldsChoice?: () => void;
            } | null;

            if (w?.dontSkipEmbeddingFields !== undefined) {
                return true;
            }

            w?.requestEmbeddingFieldsChoice?.();

            return false;
        }, [commonData]);

        useImperativeHandle(
            ref,
            () => ({
                submitStep,
            }),
            [submitStep],
        );

        const stepRef = useRef<HTMLDivElement>(null);

        const isMobile = useIsMobile();
        const [mobileResultsOpen, setMobileResultsOpen] = useState(false);

        const wizardData = commonData as {
            dataStore?: DataStoreType;
            completedPages?: number[];
        } | null;
        const dataStore = wizardData?.dataStore;
        const provider = wizardData?.dataStore?.provider;
        const isS3Provider = provider === 's3';

        const {
            methodVariants,
            methodVariantIndex,
            setMethodVariantIndex,
            explorerConfig,
            showMethodVariantSwitch,
            isSplitView,
            queryValues,
            setQueryField,
            resetQueryBar,
            fetchData,
            state,
            columns,
            explorerTable,
            expandedRows,
            toggleRow,
            total,
            rangeLabel,
            showEmptyFilterMessage,
            handlePageSizeChange,
            handlePageChange,
        } = useExplorerQuery(dataStore?._id, provider);

        const [viewMode, setViewMode] = useState<'table' | 'json'>(isSplitView ? 'json' : 'table');

        useEffect(() => {
            setCanGoNext?.(true);
        }, [setCanGoNext]);

        useExplorerLayoutVars(stepRef, isSplitView, showMethodVariantSwitch, !state.firstLoading);

        if (isS3Provider && dataStore?._id && provider) {
            return (
                <div
                    className={cn(
                        'data-explorer-step flex min-h-0 w-full max-w-full min-w-0 flex-1 flex-col gap-4 bg-card',
                        isWizardPage ? 'wizard-page' : 'non-wizard-page',
                    )}
                >
                    <S3FileBrowser dataStoreId={dataStore._id} provider={provider} isWizardPage={isWizardPage} />
                </div>
            );
        }

        if (state.firstLoading) {
            return (
                <div
                    className={cn(
                        'data-explorer-loading flex w-full flex-1 flex-col items-center justify-center bg-card px-6 py-12',
                        isWizardPage ? 'wizard-page' : 'non-wizard-page',
                    )}
                >
                    <div className="data-explorer-loading-inner flex max-w-sm flex-col items-center gap-4 text-center">
                        <div className="data-explorer-loading-icon flex size-11 items-center justify-center rounded-full">
                            <SpinnerBlade className="scale-125" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <h3 className="text-sm font-medium text-foreground">Loading data explorer</h3>
                            <p className="text-sm text-text-secondary">Preparing query fields and results…</p>
                        </div>
                    </div>
                </div>
            );
        }

        const queryActionButtons = (
            <div className="flex shrink-0 items-center gap-2">
                {isMobile && isSplitView ? (
                    <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        className="h-8 cursor-pointer"
                        onClick={() => setMobileResultsOpen(true)}
                    >
                        View results
                        <ChevronRightIcon className="size-4" />
                    </Button>
                ) : null}
                <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    className="h-8 cursor-pointer text-muted-foreground"
                    onClick={resetQueryBar}
                    disabled={state.loading}
                >
                    Reset
                </Button>
                <Button
                    size="sm"
                    type="button"
                    className="h-8 min-w-[5.5rem] cursor-pointer"
                    onClick={() => {
                        fetchData(queryValues, 0, state.pageSize);

                        if (isMobile && isSplitView) {
                            setMobileResultsOpen(true);
                        }
                    }}
                    disabled={state.loading}
                >
                    {state.loading ? <SpinnerBlade /> : null}
                    {state.loading ? 'Running…' : 'Run query'}
                </Button>
            </div>
        );

        const methodVariantSwitch = showMethodVariantSwitch ? (
            <div id="explorer-method-switch" className="flex shrink-0">
                <Switch
                    options={methodVariants.map((v) => ({
                        label: formatExplorerMethodOptionLabel(v.method),
                    }))}
                    activeIndex={methodVariantIndex}
                    onChange={(_event, index) => {
                        setMethodVariantIndex(index);
                    }}
                    width={120}
                />
            </div>
        ) : (
            <span className="text-sm font-medium text-foreground">Query Type</span>
        );

        const queryPanel = (
            <div
                id="explorer-query-bar"
                className={cn(
                    'data-explorer-query-card flex shrink-0 flex-col overflow-hidden',
                    'rounded-lg border border-border/60 bg-card shadow-xs',
                    isSplitView && 'min-h-0 flex-1',
                )}
            >
                <div
                    className={cn(
                        'flex flex-wrap items-center justify-between gap-3',
                        'border-b border-border/60 bg-muted/30 px-4 py-2.5',
                    )}
                >
                    {methodVariantSwitch}
                    {queryActionButtons}
                </div>
                <div
                    id="explorer-query-body"
                    className={cn(
                        'flex flex-col',
                        isSplitView ? 'min-h-0 flex-1 overflow-hidden px-4 pt-2 pb-4' : 'gap-3 px-4 py-3',
                    )}
                >
                    <ExplorerQueryFields
                        explorerConfig={explorerConfig}
                        queryValues={queryValues}
                        loading={state.loading}
                        layout={isSplitView ? 'split' : 'normal'}
                        setQueryField={setQueryField}
                    />
                </div>
            </div>
        );

        const resultsPanel = (
            <ExplorerResultsPanel
                showEmptyFilterMessage={showEmptyFilterMessage}
                hasActiveQuery={Object.values(queryValues).some((v) => v.trim() !== '')}
                onResetQuery={resetQueryBar}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                explorerTable={explorerTable}
                columns={columns}
                expandedRows={expandedRows}
                toggleRow={toggleRow}
                data={state.data}
                loading={state.loading}
                provider={provider}
                rangeLabel={rangeLabel}
                total={total}
                pageSize={state.pageSize}
                pages={state.pages}
                pageIndex={state.pageIndex}
                onPageSizeChange={handlePageSizeChange}
                onPageChange={handlePageChange}
            />
        );

        // Below md the split results slide in over the query as an in-tree overlay (not a
        // portaled sheet), mirroring the parameters-schema "Show JSON" pattern: the query
        // stays full-width and a header button reveals results, with a back button to return.
        // On desktop both panels sit side by side and scroll internally (height in the scss).
        // Render the results in EITHER the inline split OR this overlay — never both — to keep
        // a single #explorer-results-panel in the DOM.
        const mobileResultsOverlay = (
            <div
                className={cn(
                    'absolute inset-0 z-20 flex flex-col bg-card',
                    'transition-transform duration-300 ease-in-out',
                    mobileResultsOpen ? 'translate-x-0' : 'pointer-events-none translate-x-full',
                )}
            >
                <div className="flex shrink-0 items-center gap-1 border-b border-border bg-card px-3 py-2">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-text-secondary"
                        onClick={() => setMobileResultsOpen(false)}
                    >
                        <ChevronLeftIcon className="size-4" />
                        Query
                    </Button>
                </div>
                <div className="data-explorer-split-results flex min-h-0 min-w-0 flex-1 flex-col">{resultsPanel}</div>
            </div>
        );

        const renderExplorerBody = () => {
            if (!isSplitView) {
                return (
                    <div className="flex min-h-0 flex-1 flex-col gap-4">
                        {queryPanel}
                        {resultsPanel}
                    </div>
                );
            }

            if (isMobile) {
                return (
                    <div className="data-explorer-split-pane relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                        <div className="data-explorer-split-query flex min-h-0 w-full flex-1 flex-col">
                            {queryPanel}
                        </div>
                        {mobileResultsOverlay}
                    </div>
                );
            }

            return (
                <div
                    className={cn(
                        'data-explorer-split-pane flex min-h-0 flex-1 flex-col gap-4',
                        'md:flex-row md:items-stretch',
                    )}
                >
                    <div
                        className={cn(
                            'data-explorer-split-query flex min-h-0 w-full flex-1 flex-col',
                            'md:w-2/5 md:max-w-[40%] md:min-w-0',
                        )}
                    >
                        {queryPanel}
                    </div>
                    <div
                        className={cn(
                            'data-explorer-split-results flex min-h-0 w-full flex-1 flex-col',
                            'md:w-3/5 md:max-w-[60%] md:min-w-0',
                        )}
                    >
                        {resultsPanel}
                    </div>
                </div>
            );
        };

        return (
            <div
                ref={stepRef}
                className={cn(
                    'data-explorer-step flex min-h-0 w-full max-w-full min-w-0 flex-1 flex-col gap-4 bg-card',
                    isWizardPage ? 'wizard-page' : 'non-wizard-page',
                    showMethodVariantSwitch && 'method-variant-switch',
                    isSplitView && 'data-explorer-step--split',
                )}
            >
                {renderExplorerBody()}
            </div>
        );
    },
);

DataExplorerStep.displayName = 'DataExplorerStep';
