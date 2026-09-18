import { useQueryClient } from '@tanstack/react-query';
import { OctagonAlertIcon } from 'lucide-react';
import { Link, Navigate, Route, Routes, useParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import Spinner from '@/components/ui/spinner';
import { usePermissions } from '@/hooks';
import { DATA_STORES_QUERY_KEY, useDataStoreByIdQuery } from '@/lib/api/admin/data-stores';
import type { DataStoreType } from '@/types/admin';

import Header from '../../../header';
import { DataExplorerStep } from '../wizard-pages/data-explorer-step';

import {
    DataStoreFiles,
    DataStoresConnection,
    DataStoresCrawler,
    DataStoresEmbeddingsIndex,
    DataStoresFields,
    DataStoresFilesFolders,
    DataStoresInfo,
    DataStoresMeta,
    DataStoresOkf,
    DataStoresSpecification,
    DataStoresTools,
    DataStoresWebLinks,
} from './components';
import DataStoresActions from './components/data-stores-actions';
import './data-stores-detail.scss';

// OKF describes a store's own data, which file and blob stores don't have (files run
// their own metadata pipeline; s3/azure/sharepoint are container listings). The api
// refuses to generate for these providers, so the tab would only ever show "Not
// generated yet" with a button that 400s.
const OKF_EXCLUDED_PROVIDERS = ['files', 's3', 'azure-blob-storage', 'sharepoint'];

const DataStoresDetail = () => {
    const queryClient = useQueryClient();
    const { checkMultiplePermissions } = usePermissions();

    const params = useParams();
    const dataStoreId = params.dataStoreId!;

    const { data, isLoading, isError, refetch } = useDataStoreByIdQuery(dataStoreId);

    const [canUserEdit, canUserDelete] = checkMultiplePermissions([
        {
            module: 'dataStores',
            action: 'put',
        },
        {
            module: 'dataStores',
            action: 'delete',
        },
    ]);

    const updateDataStoreData = (value: DataStoreType) => {
        queryClient.setQueryData<DataStoreType>([...DATA_STORES_QUERY_KEY, 'detail', dataStoreId], (prev) =>
            prev ? { ...prev, ...value } : prev,
        );
    };

    const renderTabs = (store: DataStoreType) => {
        const activeSubTab = params['*']?.split('/').shift();

        return (
            <ul className="tab-list scrollbar-controller scrollbar-horizontal flex items-center gap-1 border-b border-border-secondary bg-card px-2 xl:gap-2">
                {canUserEdit && (
                    <li className={`tab-list-item ${activeSubTab === '' ? 'active' : ''}`}>
                        <Link to={`/admin/data-stores/${store._id}`}>
                            <span className="text-sm font-medium text-text-secondary">Info</span>
                        </Link>
                    </li>
                )}
                {canUserEdit &&
                    store.provider !== 'custom' &&
                    store.provider !== 'files' &&
                    store.provider !== 'weblinks' && (
                        <li className={`tab-list-item ${activeSubTab === 'connections' ? 'active' : ''}`}>
                            <Link to={`/admin/data-stores/${store._id}/connections`}>
                                <span className="text-sm font-medium text-text-secondary">Connections</span>
                            </Link>
                        </li>
                    )}
                {canUserEdit && store.provider === 'files' && (
                    <li className={`tab-list-item ${activeSubTab === 'files' ? 'active' : ''}`}>
                        <Link to={`/admin/data-stores/${store._id}/files`}>
                            <span className="text-sm font-medium text-text-secondary">Files</span>
                        </Link>
                    </li>
                )}
                {canUserEdit && store.provider === 'custom' && (
                    <li className={`tab-list-item ${activeSubTab === 'specification' ? 'active' : ''}`}>
                        <Link to={`/admin/data-stores/${store._id}/specification`}>
                            <span className="text-sm font-medium text-text-secondary">Specification</span>
                        </Link>
                    </li>
                )}
                {canUserEdit && store.provider === 'weblinks' && (
                    <li className={`tab-list-item ${activeSubTab === 'web-links' ? 'active' : ''}`}>
                        <Link to={`/admin/data-stores/${store._id}/web-links`}>
                            <span className="text-sm font-medium text-text-secondary">Web Links</span>
                        </Link>
                    </li>
                )}
                {canUserEdit && store.provider === 'weblinks' && (
                    <li className={`tab-list-item ${activeSubTab === 'crawler' ? 'active' : ''}`}>
                        <Link to={`/admin/data-stores/${store._id}/crawler`}>
                            <span className="text-sm font-medium text-text-secondary">Crawler</span>
                        </Link>
                    </li>
                )}
                {canUserEdit &&
                    store.provider !== 'files' &&
                    store.provider !== 'api' &&
                    store.provider !== 'weblinks' && (
                        <li
                            className={`tab-list-item ${activeSubTab === 'embeddings-index' || activeSubTab === 'fields' || activeSubTab === 'files-folders' ? 'active' : ''}`}
                        >
                            <Link to={`/admin/data-stores/${store._id}/embeddings-index`}>
                                <span className="text-sm font-medium text-text-secondary">Embeddings Index</span>
                            </Link>
                        </li>
                    )}
                {canUserEdit &&
                    store.provider !== 'custom' &&
                    store.provider !== 'azure-blob-storage' &&
                    store.provider !== 'sharepoint' && (
                        <li className={`tab-list-item ${activeSubTab === 'data-explorer' ? 'active' : ''}`}>
                            <Link to={`/admin/data-stores/${store._id}/data-explorer`}>
                                <span className="text-sm font-medium text-text-secondary">Data Explorer</span>
                            </Link>
                        </li>
                    )}
                {canUserEdit && (
                    <li className={`tab-list-item ${activeSubTab === 'tools' ? 'active' : ''}`}>
                        <Link to={`/admin/data-stores/${store._id}/tools`}>
                            <span className="text-sm font-medium text-text-secondary">Tools</span>
                        </Link>
                    </li>
                )}
                {!OKF_EXCLUDED_PROVIDERS.includes(store.provider) && (
                    <li className={`tab-list-item ${activeSubTab === 'okf' ? 'active' : ''}`}>
                        <Link to={`/admin/data-stores/${store._id}/okf`}>
                            <span className="text-sm font-medium text-text-secondary">OKF</span>
                        </Link>
                    </li>
                )}
            </ul>
        );
    };

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex h-full w-full items-center justify-center px-4 py-6">
                    <div className="flex flex-col items-center justify-center gap-4">
                        <Spinner className="scale-150" />
                        <div className="text-center">
                            <h3 className="mb-1 text-sm font-medium">Loading Data Store Details</h3>
                            <span className="text-sm">Fetching information...</span>
                        </div>
                    </div>
                </div>
            );
        }

        if (isError || !data) {
            return (
                <div className="flex min-h-[80svh] items-center justify-center py-4">
                    <div className="flex max-w-xs flex-col items-center justify-center gap-4 text-center">
                        <OctagonAlertIcon className="size-4 text-5xl! text-destructive!" />
                        <div className="flex flex-col items-center justify-center gap-2">
                            <h3 className="error-title text-xl font-medium text-(--text-primary)">
                                Failed to Load Data Store
                            </h3>
                            <span className="font-medium text-text-secondary">
                                Network issue or Data Store doesn&apos;t exist
                            </span>
                            <Button
                                type="button"
                                className="retry-button mt-2 min-w-[120px] justify-center rounded-full text-center"
                                onClick={() => {
                                    void refetch();
                                }}
                            >
                                Retry
                            </Button>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <>
                <div className="secondary-header data-stores-detail flex flex-col">
                    <DataStoresMeta dataStore={data} />
                    {renderTabs(data)}
                </div>
                <main className="tab-content-area flex h-full flex-1 flex-col">
                    <Routes>
                        {canUserEdit && (
                            <Route
                                path=""
                                element={
                                    <DataStoresInfo
                                        dataStore={data}
                                        canUserEdit={canUserEdit}
                                        onSubmit={updateDataStoreData}
                                    />
                                }
                            />
                        )}
                        {canUserEdit && data.provider !== 'api' && data.provider !== 'weblinks' && (
                            <Route
                                path="embeddings-index"
                                element={
                                    <DataStoresEmbeddingsIndex
                                        dataStore={data}
                                        canUserEdit={canUserEdit}
                                        onSubmit={updateDataStoreData}
                                    />
                                }
                            />
                        )}
                        {data.provider !== 'api' && data.provider !== 'weblinks' && (
                            <Route
                                path="fields"
                                element={
                                    <DataStoresFields
                                        dataStore={data}
                                        canUserEdit={canUserEdit}
                                        onSubmit={updateDataStoreData}
                                    />
                                }
                            />
                        )}
                        {data.provider !== 'api' && data.provider !== 'weblinks' && (
                            <Route
                                path="files-folders"
                                element={
                                    <DataStoresFilesFolders
                                        dataStore={data}
                                        canUserEdit={canUserEdit}
                                        onSubmit={updateDataStoreData}
                                    />
                                }
                            />
                        )}
                        {canUserEdit && (
                            <Route
                                path="tools"
                                element={
                                    <DataStoresTools
                                        dataStore={data}
                                        canUserEdit={canUserEdit}
                                        onSubmit={updateDataStoreData}
                                    />
                                }
                            />
                        )}
                        {!OKF_EXCLUDED_PROVIDERS.includes(data.provider) && (
                            <Route
                                path="okf"
                                element={
                                    <DataStoresOkf
                                        dataStore={data}
                                        canUserEdit={canUserEdit}
                                        onSubmit={updateDataStoreData}
                                    />
                                }
                            />
                        )}
                        {canUserEdit &&
                            data.provider !== 'custom' &&
                            data.provider !== 'files' &&
                            data.provider !== 'weblinks' && (
                                <Route
                                    path="connections"
                                    element={
                                        <DataStoresConnection
                                            dataStore={data}
                                            canUserEdit={canUserEdit}
                                            onSubmit={updateDataStoreData}
                                        />
                                    }
                                />
                            )}
                        {canUserEdit && data.provider !== 'custom' && data.provider === 'files' && (
                            <Route
                                path="files"
                                element={<DataStoreFiles dataStore={data} canUserEdit={canUserEdit} />}
                            />
                        )}
                        {canUserEdit && data.provider === 'custom' && (
                            <Route
                                path="specification"
                                element={
                                    <DataStoresSpecification
                                        dataStore={data}
                                        canUserEdit={canUserEdit}
                                        onSubmit={updateDataStoreData}
                                    />
                                }
                            />
                        )}
                        {canUserEdit && data.provider === 'weblinks' && (
                            <Route
                                path="web-links"
                                element={
                                    <DataStoresWebLinks
                                        dataStore={data}
                                        canUserEdit={canUserEdit}
                                        onSubmit={updateDataStoreData}
                                    />
                                }
                            />
                        )}
                        {canUserEdit && data.provider === 'weblinks' && (
                            <Route
                                path="crawler"
                                element={
                                    <DataStoresCrawler
                                        dataStore={data}
                                        canUserEdit={canUserEdit}
                                        onSubmit={updateDataStoreData}
                                    />
                                }
                            />
                        )}
                        {canUserEdit && data.provider !== 'azure-blob-storage' && data.provider !== 'sharepoint' && (
                            <Route
                                path="data-explorer"
                                element={<DataExplorerStep isWizardPage={false} commonData={{ dataStore: data }} />}
                            />
                        )}
                        <Route path="*" element={<Navigate to="/" />} />
                    </Routes>
                </main>
            </>
        );
    };

    return (
        <div className="data-stores-details-page flex h-full flex-col">
            <Header
                breadcrumbs={[
                    { to: '/admin/data-stores', title: 'Data Stores' },
                    {
                        to: `/admin/data-stores/${data?._id ?? dataStoreId}`,
                        title: isLoading ? 'Loading' : (data?.name ?? ''),
                    },
                ]}
                actions={
                    data && (
                        <DataStoresActions
                            dataStore={data}
                            canUserEdit={canUserEdit}
                            canUserDelete={canUserDelete}
                            onSubmit={updateDataStoreData}
                        />
                    )
                }
            />
            {renderContent()}
        </div>
    );
};

export default DataStoresDetail;
