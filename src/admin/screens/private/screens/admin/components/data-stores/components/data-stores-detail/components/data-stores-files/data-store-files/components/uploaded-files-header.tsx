import { Loader2Icon, Trash2Icon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { SELECT_ALL_SHORTCUT_LABEL } from '../constants';

export interface Props {
    canUserEdit: boolean;
    allSelected: boolean;
    someSelected: boolean;
    isFileMutating: boolean;
    isDeletingSelected: boolean;
    totalCount: number;
    selectedCount: number;
    onSelectAllChange: (checked: boolean) => void;
    onDeleteSelected: () => void;
}

const UploadedFilesHeader = ({
    canUserEdit,
    allSelected,
    someSelected,
    isFileMutating,
    isDeletingSelected,
    totalCount,
    selectedCount,
    onSelectAllChange,
    onDeleteSelected,
}: Props) => (
    <div className="data-store-files-uploaded-header flex min-h-8 items-center justify-between gap-3 pl-4">
        <div className="data-store-files-uploaded-header-checkbox flex items-center gap-4">
            {canUserEdit && (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div onClick={(e) => e.stopPropagation()} role="presentation">
                            <Checkbox
                                checked={allSelected}
                                indeterminate={someSelected}
                                disabled={isFileMutating}
                                onChange={(_, checked) => onSelectAllChange(checked)}
                                className="cursor-pointer"
                            />
                        </div>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                        {allSelected ? 'Deselect all' : `Select all (${SELECT_ALL_SHORTCUT_LABEL})`}
                    </TooltipContent>
                </Tooltip>
            )}
            <span className="text-sm font-medium text-foreground">
                {`Uploaded Files${totalCount > 0 ? ` (${totalCount})` : ''}`}
            </span>
        </div>
        {canUserEdit && selectedCount > 0 && (
            <Button type="button" variant="destructive" size="sm" onClick={onDeleteSelected} disabled={isFileMutating}>
                {isDeletingSelected ? (
                    <Loader2Icon className="size-3.5 animate-spin" />
                ) : (
                    <Trash2Icon className="size-3.5" />
                )}
                {`Delete Selected (${selectedCount})`}
            </Button>
        )}
    </div>
);

export default UploadedFilesHeader;
