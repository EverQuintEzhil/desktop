import { PencilIcon, TrashIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import type { DataStoreType } from '@/types/admin';

interface Props {
    row: {
        original: DataStoreType;
        index: number;
    };
    canUserEdit: boolean;
    canUserDelete: boolean;
    onEdit: (dataStore: DataStoreType) => void;
    onDelete: (dataStore: DataStoreType) => void;
}

const Actions = (props: Props) => {
    const { row, canUserEdit, canUserDelete, onEdit, onDelete } = props;

    if (!canUserEdit && !canUserDelete) {
        return null;
    }

    return (
        <div className="action-button flex items-center gap-2">
            {canUserEdit && (
                <SimpleTooltip content="Edit" side="bottom">
                    <Button
                        variant="secondary"
                        size="icon-xs"
                        onClick={() => {
                            onEdit(row.original);
                        }}
                    >
                        <PencilIcon />
                    </Button>
                </SimpleTooltip>
            )}
            {canUserDelete && (
                <SimpleTooltip content="Delete" side="bottom">
                    <Button
                        variant="destructive"
                        size="icon-xs"
                        onClick={() => {
                            onDelete(row.original);
                        }}
                    >
                        <TrashIcon />
                    </Button>
                </SimpleTooltip>
            )}
        </div>
    );
};

export default Actions;
