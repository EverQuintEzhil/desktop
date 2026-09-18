import { TrashIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import type { AssetType } from '@/types/admin';

interface Props {
    row: {
        original: AssetType;
    };
    canUserEdit: boolean;
    canUserDelete: boolean;
    setDeleteAsset: (value: AssetType | null) => void;
}

const Actions = (props: Props) => {
    const { row, canUserDelete, setDeleteAsset } = props;

    if (!canUserDelete) {
        return null;
    }

    return (
        <div className="action-button flex items-center gap-2">
            <SimpleTooltip content="Delete" side="bottom">
                <Button variant="destructive" size="icon-xs" onClick={() => setDeleteAsset(row.original)}>
                    <TrashIcon />
                </Button>
            </SimpleTooltip>
        </div>
    );
};

export default Actions;
