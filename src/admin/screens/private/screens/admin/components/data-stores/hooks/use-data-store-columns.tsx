import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';

import { CopyButton } from '@/components';
import type { DataStoreType } from '@/types/admin';
import { formatDateTime } from '@/utils/date';
import type { Action, Module } from '@/utils/permissions';

import { Actions } from '../components';

interface UseDataStoreColumnsParams {
    canUserEdit: boolean;
    canUserDelete: boolean;
    canAccessible: (module: Module, action: Action, resourceContext?: { creatorId?: string }) => boolean;
    onEdit: (dataStore: DataStoreType) => void;
    onDelete: (dataStore: DataStoreType) => void;
}

const columnHelper = createColumnHelper<DataStoreType>();

const renderUserCell = (val: { name?: { first?: string; last?: string } } | undefined) => {
    if (val?.name) {
        return (
            <p>
                {val.name.first} {val.name.last}
            </p>
        );
    }

    return <p> - </p>;
};

export const useDataStoreColumns = ({
    canUserEdit,
    canUserDelete,
    canAccessible,
    onEdit,
    onDelete,
}: UseDataStoreColumnsParams): ColumnDef<DataStoreType>[] =>
    [
        columnHelper.accessor('_id', {
            id: '_id',
            header: 'ID',
            size: 270,
            enableSorting: false,
            cell: ({ getValue }) => {
                const val = getValue();

                return (
                    <div className="data-stores-id-cell flex items-center justify-start gap-2">
                        <span className="text-sm">{val}</span>
                        <CopyButton text={val} className="copy-button" />
                    </div>
                );
            },
        }),
        columnHelper.accessor('name', {
            id: 'name',
            header: 'Name',
            cell: ({ getValue }) => <span className="text-sm">{getValue()}</span>,
        }),
        columnHelper.accessor('provider', {
            id: 'provider',
            header: 'Provider',
            cell: ({ getValue }) => <span className="text-sm">{getValue()}</span>,
        }),
        columnHelper.accessor('refName', {
            id: 'refName',
            header: 'Ref Name',
            cell: ({ getValue }) => <span className="text-sm">{getValue()}</span>,
        }),
        columnHelper.accessor('description', {
            id: 'description',
            header: 'Description',
            size: 250,
            enableSorting: false,
            cell: ({ getValue }) => <p>{getValue()}</p>,
        }),
        columnHelper.accessor('updatedBy', {
            id: 'updatedBy',
            header: 'Updated User',
            size: 250,
            enableSorting: false,
            cell: ({ getValue }) => renderUserCell(getValue()),
        }),
        columnHelper.accessor('updatedAt', {
            id: 'updatedAt',
            header: 'Updated Time',
            size: 220,
            cell: ({ getValue }) => <p>{formatDateTime(getValue())}</p>,
        }),
        columnHelper.accessor('creator', {
            id: 'creator',
            header: 'Created User',
            size: 250,
            enableSorting: false,
            cell: ({ getValue }) => renderUserCell(getValue()),
        }),
        columnHelper.accessor('createdAt', {
            id: 'createdAt',
            header: 'Created Time',
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
                              canUserEdit={canAccessible('dataStores', 'put', {
                                  creatorId: row.original.creator?._id,
                              })}
                              canUserDelete={canAccessible('dataStores', 'delete', {
                                  creatorId: row.original.creator?._id,
                              })}
                              onEdit={onEdit}
                              onDelete={onDelete}
                          />
                      ),
                  }),
              ]
            : []),
    ] as ColumnDef<DataStoreType>[];
