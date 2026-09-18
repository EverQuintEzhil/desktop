import { useQueryClient } from '@tanstack/react-query';
import { PlusIcon, XIcon } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';

import QueryStateBoundary from '@/admin/components/query-state-boundary';
import { WizardForm } from '@/admin/components/wizard';
import { Table } from '@/components';
import MultiSelect, { type SelectSuggestionItem } from '@/components/multi-select';
import { Button } from '@/components/ui/button';
import ConfirmationModal from '@/components/ui/confirmation-modal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePermissions, useTableUrlParams } from '@/hooks';
import { DATA_STORES_LIST_QUERY_KEY, useDataStoresQuery } from '@/lib/api/admin/data-stores';
import type { DataStoreType } from '@/types/admin';
import { showSuccessToast } from '@/utils';

import Header from '../header';

import { DeleteDataStore, EditDataStore } from './components';
import DataStoresDetail from './components/data-stores-detail';
import { PROVIDER_OPTIONS } from './constants';
import { useDataStoreColumns, useWizardFlow } from './hooks';
import type { WizardCommonData } from './types';
import './data-stores.scss';

const DataStores = () => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const { canAccessible, checkMultiplePermissions } = usePermissions();

    const [canUserAdd, canUserEdit, canUserDelete] = checkMultiplePermissions([
        {
            module: 'dataStores',
            action: 'post',
            noConditionCheck: true,
        },
        {
            module: 'dataStores',
            action: 'put',
            noConditionCheck: true,
        },
        {
            module: 'dataStores',
            action: 'delete',
            noConditionCheck: true,
        },
    ]);

    const { pageIndex, pageSize, search, sort, setSearch, setSort, setPagination, patch, getParam } = useTableUrlParams(
        { storageKey: 'admin:data-stores-table' },
    );

    const providerParam = getParam('provider') ?? '';
    const selectedProvider: SelectSuggestionItem<string>[] = providerParam
        ? PROVIDER_OPTIONS.filter((option) => option.value === providerParam)
        : [];

    const handleProviderChange = useCallback(
        (val: SelectSuggestionItem<string>[]) => {
            const picked = val.length ? val[val.length - 1] : null;

            patch({ provider: picked?.value || null, page: null });
        },
        [patch],
    );

    const [editDataStore, setEditDataStore] = useState<DataStoreType | null>(null);
    const [deleteDataStore, setDeleteDataStore] = useState<DataStoreType | null>(null);

    const { data, isLoading, isFetching, isError, refetch } = useDataStoresQuery({
        pageIndex,
        pageSize,
        search,
        sort,
        provider: providerParam || undefined,
    });

    const [isAddOpen, setIsAddOpen] = useState(false);

    const wizardFlow = useWizardFlow({
        onComplete: () => {
            setIsAddOpen(false);
            setEditDataStore(null);
            showSuccessToast('Data store added successfully.');
        },
    });

    const { resetWizard } = wizardFlow;

    const closeWizard = useCallback(() => {
        setIsAddOpen(false);
        setEditDataStore(null);
        resetWizard();
    }, [resetWizard]);

    const handleEdit = (dataStore: DataStoreType) => {
        setEditDataStore(dataStore);
        setIsAddOpen(true);
    };

    const handleDelete = (dataStore: DataStoreType) => {
        setDeleteDataStore(dataStore);
    };

    const columns = useDataStoreColumns({
        canUserEdit,
        canUserDelete,
        canAccessible,
        onEdit: handleEdit,
        onDelete: handleDelete,
    });

    const renderEdit = () => {
        if (!isAddOpen || !editDataStore) return null;

        return (
            <EditDataStore
                isOpen={isAddOpen}
                onClose={() => {
                    setIsAddOpen(false);
                    setEditDataStore(null);
                }}
                dataStore={editDataStore}
            />
        );
    };

    const renderWizard = () => {
        if (!isAddOpen || editDataStore) return null;

        return (
            <>
                <Dialog open={isAddOpen} onOpenChange={() => {}}>
                    <DialogContent
                        className="flex max-h-[96svh] flex-col overflow-hidden p-0 max-lg:min-h-[90svh] lg:h-[96svh] lg:max-w-[90%]"
                        onInteractOutside={(e) => {
                            e.preventDefault();
                            if (
                                wizardFlow.isEmbeddingFieldsChoiceOpen ||
                                wizardFlow.isCronChoiceOpen ||
                                wizardFlow.isWizardCloseConfirmOpen
                            ) {
                                return;
                            }
                            wizardFlow.requestCloseWizard();
                        }}
                        onEscapeKeyDown={(e) => {
                            e.preventDefault();
                            if (
                                wizardFlow.isEmbeddingFieldsChoiceOpen ||
                                wizardFlow.isCronChoiceOpen ||
                                wizardFlow.isWizardCloseConfirmOpen
                            ) {
                                return;
                            }
                            wizardFlow.requestCloseWizard();
                        }}
                    >
                        <DialogHeader id="ds-wiz-dialog-header" className="flex-row items-center justify-between gap-3">
                            <DialogTitle className="text-xl">Add Data Store</DialogTitle>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Close add data store wizard"
                                onClick={() => {
                                    if (
                                        wizardFlow.isEmbeddingFieldsChoiceOpen ||
                                        wizardFlow.isCronChoiceOpen ||
                                        wizardFlow.isWizardCloseConfirmOpen
                                    ) {
                                        return;
                                    }
                                    wizardFlow.requestCloseWizard();
                                }}
                            >
                                <XIcon />
                            </Button>
                        </DialogHeader>
                        <WizardForm
                            pages={wizardFlow.wizardPages}
                            commonData={wizardFlow.wizardCommonDataForForm}
                            onCommonDataChange={(data) => wizardFlow.setWizardCommonData(data as WizardCommonData)}
                            currentPage={wizardFlow.currentWizardPage}
                            onGoToPage={wizardFlow.setCurrentWizardPage}
                            onNext={() => {
                                wizardFlow.setCurrentWizardPage((p) => p + 1);
                            }}
                            onPrev={() => {
                                wizardFlow.setCurrentWizardPage((p) => p - 1);
                            }}
                            onComplete={wizardFlow.completeWizard}
                            onPageComplete={(data) => {
                                void queryClient.invalidateQueries({ queryKey: DATA_STORES_LIST_QUERY_KEY });

                                const created = data as DataStoreType | null;

                                if (created?.provider === 'files') {
                                    wizardFlow.completeWizard();
                                    navigate(`/admin/data-stores/${created._id}`);
                                }
                            }}
                        />
                    </DialogContent>
                </Dialog>
                {wizardFlow.isWizardCloseConfirmOpen && (
                    <ConfirmationModal
                        isOpen={wizardFlow.isWizardCloseConfirmOpen}
                        onClose={() => wizardFlow.setIsWizardCloseConfirmOpen(false)}
                        onConfirm={closeWizard}
                        title="Close Confirmation"
                        confirmButtonText="Confirm"
                        cancelButtonText="Cancel"
                    >
                        <div className="mx-auto flex flex-col items-center justify-center text-center">
                            <span className="text-sm">
                                Are you sure you want to close? Your changes will not be saved.
                            </span>
                        </div>
                    </ConfirmationModal>
                )}
                {wizardFlow.isEmbeddingFieldsChoiceOpen && (
                    <ConfirmationModal
                        isOpen={wizardFlow.isEmbeddingFieldsChoiceOpen}
                        onClose={() => wizardFlow.setIsEmbeddingFieldsChoiceOpen(false)}
                        title="Embedding configuration"
                        buttons={[
                            {
                                text: 'Skip',
                                variant: 'outline',
                                onClick: () => wizardFlow.confirmEmbeddingFieldsChoice(false),
                            },
                            {
                                text: 'Configure',
                                variant: 'default',
                                onClick: () => wizardFlow.confirmEmbeddingFieldsChoice(true),
                            },
                        ]}
                    >
                        <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-2 text-center">
                            <span className="text-sm text-muted-foreground">
                                Choose whether to configure embedding fields (or files and folders for blob stores) now,
                                or skip this step and continue the wizard.
                            </span>
                        </div>
                    </ConfirmationModal>
                )}
                {wizardFlow.isCronChoiceOpen && (
                    <ConfirmationModal
                        isOpen={wizardFlow.isCronChoiceOpen}
                        onClose={() => wizardFlow.setIsCronChoiceOpen(false)}
                        title="Cron configuration"
                        buttons={[
                            {
                                text: 'Skip',
                                variant: 'outline',
                                loading: wizardFlow.saveCronMutation.isPending,
                                onClick: () => wizardFlow.confirmCronChoice(false),
                            },
                            {
                                text: 'Configure',
                                variant: 'default',
                                disabled: wizardFlow.saveCronMutation.isPending,
                                onClick: () => wizardFlow.confirmCronChoice(true),
                            },
                        ]}
                    >
                        <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-2 text-center">
                            <span className="text-sm text-muted-foreground">
                                Choose whether to configure a cron schedule for this data store now, or skip this step
                                and continue the wizard.
                            </span>
                        </div>
                    </ConfirmationModal>
                )}
            </>
        );
    };

    const renderDeleteDataStoreModal = () => {
        if (!deleteDataStore) return null;

        return (
            <DeleteDataStore
                isOpen={!!deleteDataStore}
                onClose={() => {
                    setDeleteDataStore(null);
                }}
                onDeleteSuccess={() => {
                    const itemsOnPage = data?.values?.length ?? 0;

                    setDeleteDataStore(null);

                    if (itemsOnPage !== 1) return;

                    setPagination({ pageIndex: Math.max(0, pageIndex - 1), pageSize });
                }}
                dataStore={deleteDataStore}
            />
        );
    };

    const renderAddButton = () => {
        if (!canUserAdd) return null;

        return (
            <Button
                className="h-8 rounded-full font-normal"
                onClick={() => {
                    setEditDataStore(null);
                    wizardFlow.setCurrentWizardPage(0);
                    wizardFlow.setWizardCommonData(null);
                    setIsAddOpen(true);
                }}
            >
                <PlusIcon />
                Add Data Store
            </Button>
        );
    };

    const renderRightHeader = () => (
        <div className="data-stores-filters-container ml-auto flex flex-wrap items-center gap-2">
            <MultiSelect
                noneLabel="Clear Provider"
                className="w-[200px] [&_.multi-select-container]:flex-nowrap [&_.multi-select-item]:min-w-[74%]"
                useSearchCondition={true}
                allowSearch={true}
                value={selectedProvider}
                data={PROVIDER_OPTIONS}
                onSelect={handleProviderChange}
                defaultText="Filter by Provider"
                maximumShow={1}
            />
            {renderAddButton()}
        </div>
    );

    return (
        <div>
            <Header breadcrumbs={[{ to: '/admin/data-stores', title: 'Data Stores' }]} />
            <div className="page-container data-stores-wrapper flex flex-col gap-4">
                <QueryStateBoundary isError={isError} hasData={data !== undefined} onRetry={refetch}>
                    <Table
                        columnLayoutKey="admin:data-stores-table"
                        data={data?.values ?? []}
                        columns={columns}
                        loading={isFetching}
                        firstLoading={isLoading}
                        defaultSorting={sort}
                        pagination={{ pageIndex, pageSize }}
                        rowCount={data?.pageInfo.totalCount ?? 0}
                        onPaginationChange={setPagination}
                        search={search}
                        onSearchChange={setSearch}
                        onSortingChange={setSort}
                        renderRightHeader={renderRightHeader}
                        getRowUrl={(row: unknown) => `/admin/data-stores/${(row as DataStoreType)._id}`}
                    />
                </QueryStateBoundary>
                {renderEdit()}
                {renderDeleteDataStoreModal()}
                {renderWizard()}
            </div>
        </div>
    );
};

const DataStoreWrapper = () => {
    return (
        <Routes>
            <Route path="" element={<DataStores />} />
            <Route path=":dataStoreId/*" element={<DataStoresDetail />} />
            <Route path="*" element={<Navigate to="/" />} />
        </Routes>
    );
};

export default DataStoreWrapper;
