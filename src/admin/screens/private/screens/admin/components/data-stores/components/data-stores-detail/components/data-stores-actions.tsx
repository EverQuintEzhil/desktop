import { PencilIcon, TrashIcon } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import type { DataStoreType } from '@/types/admin';

import DeleteDataStore from '../../delete-data-store';
import EditDataStore from '../../edit-data-store';

interface Props {
    dataStore: DataStoreType;
    canUserEdit: boolean;
    canUserDelete: boolean;
    onSubmit: (value: DataStoreType) => void;
}

const DataStoresActions = (props: Props) => {
    const { dataStore, canUserEdit, canUserDelete, onSubmit } = props;
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    return (
        <>
            {canUserEdit && (
                <SimpleTooltip content="Edit" side="bottom">
                    <Button variant="secondary" size="icon-sm" onClick={() => setIsOpen(true)}>
                        <PencilIcon />
                    </Button>
                </SimpleTooltip>
            )}
            {canUserDelete && (
                <SimpleTooltip content="Delete" side="bottom">
                    <Button variant="destructive" size="icon-sm" onClick={() => setIsDeleteModalOpen(true)}>
                        <TrashIcon />
                    </Button>
                </SimpleTooltip>
            )}
            {isOpen && (
                <EditDataStore
                    isOpen={isOpen}
                    onClose={() => setIsOpen(false)}
                    dataStore={dataStore}
                    onEditSuccess={onSubmit}
                />
            )}
            {isDeleteModalOpen && (
                <DeleteDataStore
                    isOpen={isDeleteModalOpen}
                    onClose={() => setIsDeleteModalOpen(false)}
                    onDeleteSuccess={() => {
                        setIsDeleteModalOpen(false);
                        navigate('/admin/data-stores');
                    }}
                    dataStore={dataStore}
                />
            )}
        </>
    );
};

export default DataStoresActions;
