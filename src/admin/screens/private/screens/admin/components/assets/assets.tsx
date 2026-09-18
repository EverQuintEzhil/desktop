import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';
import { PlusIcon } from 'lucide-react';
import { useRef, useState } from 'react';

import QueryStateBoundary from '@/admin/components/query-state-boundary';
import { Table } from '@/components';
import { Button } from '@/components/ui/button';
import { usePermissions, useTableUrlParams } from '@/hooks';
import { useAssetsQuery, useUploadAssetMutation } from '@/lib/api/admin/assets';
import type { AssetType } from '@/types/admin';
import { showErrorToast } from '@/utils';
import { formatDateTime } from '@/utils/date';

import Header from '../header';

import { Actions, DeleteAsset } from './components';
import './assets.scss';

const columnHelper = createColumnHelper<AssetType>();

const Assets = () => {
    const { canAccessible, checkMultiplePermissions } = usePermissions();

    const [canUserAdd, canUserEdit, canUserDelete] = checkMultiplePermissions([
        {
            module: 'assets',
            action: 'post',
            noConditionCheck: true,
        },
        {
            module: 'assets',
            action: 'put',
            noConditionCheck: true,
        },
        {
            module: 'assets',
            action: 'delete',
            noConditionCheck: true,
        },
    ]);

    const { pageIndex, pageSize, search, sort, setSearch, setSort, setPagination } = useTableUrlParams({
        storageKey: 'admin:assets-table',
    });

    const [deleteAsset, setDeleteAsset] = useState<AssetType | null>(null);

    const { data, isLoading, isFetching, isError, refetch } = useAssetsQuery({
        pageIndex,
        pageSize,
        search,
        sort,
    });
    const uploadMutation = useUploadAssetMutation();

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (file: File) => {
        try {
            const formData = new FormData();

            formData.append('file', file);
            await uploadMutation.mutateAsync(formData);
        } catch (error) {
            console.error(error);
            const axiosError = error as { response?: { data?: { message?: string }; status?: number } };

            showErrorToast(axiosError.response?.data?.message || 'Something went wrong. Please try again.');
        } finally {
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const columns = [
        columnHelper.accessor('key', {
            id: 'key',
            header: 'Key',
            size: 270,
            cell: ({ getValue }) => <span className="text-sm">{getValue()}</span>,
        }),
        columnHelper.accessor('url', {
            id: 'url',
            header: 'URL',
            size: 370,
            cell: ({ getValue }) => <span className="text-sm">{getValue()}</span>,
        }),
        columnHelper.accessor('creator', {
            id: 'creator',
            header: 'Created User',
            size: 250,
            enableSorting: false,
            cell: ({ getValue }) => {
                const val = getValue();

                return val ? (
                    <p>
                        {val?.name?.first} {val?.name?.last}
                    </p>
                ) : (
                    <p> - </p>
                );
            },
        }),
        columnHelper.accessor('createdAt', {
            id: 'createdAt',
            header: 'Created Time',
            size: 220,
            cell: ({ getValue }) => <p>{formatDateTime(getValue())}</p>,
        }),
        columnHelper.accessor('updatedBy', {
            id: 'updatedBy',
            header: 'Updated User',
            size: 250,
            enableSorting: false,
            cell: ({ getValue }) => {
                const val = getValue();

                return val ? (
                    <p>
                        {val?.name?.first} {val?.name?.last}
                    </p>
                ) : (
                    <p> - </p>
                );
            },
        }),
        columnHelper.accessor('updatedAt', {
            id: 'updatedAt',
            header: 'Updated Time',
            size: 220,
            cell: ({ getValue }) => <p>{formatDateTime(getValue())}</p>,
        }),
        ...(canUserEdit || canUserDelete
            ? [
                  columnHelper.display({
                      id: 'actions',
                      header: 'Actions',
                      enableSorting: false,
                      size: 115,
                      cell: ({ row }) => (
                          <Actions
                              row={row}
                              canUserEdit={canAccessible('assets', 'put', { creatorId: row.original.creator._id })}
                              canUserDelete={canAccessible('assets', 'delete', { creatorId: row.original.creator._id })}
                              setDeleteAsset={setDeleteAsset}
                          />
                      ),
                  }),
              ]
            : []),
    ] as ColumnDef<AssetType>[];

    const handleListDeleteSuccess = () => {
        const itemsOnPage = data?.values?.length ?? 0;

        if (itemsOnPage !== 1) return;

        setPagination({ pageIndex: Math.max(0, pageIndex - 1), pageSize });
    };

    const renderDeleteAssetModal = () => {
        if (!deleteAsset) return null;

        return (
            <DeleteAsset
                isOpen={!!deleteAsset}
                onClose={() => setDeleteAsset(null)}
                asset={deleteAsset}
                onDeleteSuccess={handleListDeleteSuccess}
            />
        );
    };

    return (
        <div>
            <Header breadcrumbs={[{ to: '/admin/assets', title: 'Assets' }]} />
            <div className="page-container assets-wrapper flex flex-col gap-4">
                <QueryStateBoundary isError={isError} hasData={data !== undefined} onRetry={refetch}>
                    <Table
                        columnLayoutKey="admin:assets-table"
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
                        renderRightHeader={
                            canUserAdd
                                ? () => (
                                      <>
                                          <input
                                              ref={fileInputRef}
                                              type="file"
                                              className="hidden"
                                              onChange={(e) => {
                                                  const file = e.target.files?.[0];

                                                  if (file) handleFileUpload(file);
                                              }}
                                          />
                                          <Button
                                              className="h-8 rounded-full font-normal"
                                              disabled={uploadMutation.isPending}
                                              onClick={() => fileInputRef.current?.click()}
                                          >
                                              <PlusIcon />
                                              {uploadMutation.isPending ? 'Uploading...' : 'Add Asset'}
                                          </Button>
                                      </>
                                  )
                                : undefined
                        }
                    />
                </QueryStateBoundary>
                {renderDeleteAssetModal()}
            </div>
        </div>
    );
};

export default Assets;
