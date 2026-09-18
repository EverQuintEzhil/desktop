import { RotateCcwIcon } from 'lucide-react';

import { type StagedFileStatus, StagedUploadRow } from '@/components/file-list';
import { Button } from '@/components/ui/button';

export interface Props {
    stagedFiles: StagedFileStatus[];
    canUserEdit: boolean;
    onRetryFailed: () => void;
    onRemove: (id: string) => void;
}

const StagedFilesList = ({ stagedFiles, canUserEdit, onRetryFailed, onRemove }: Props) => {
    if (stagedFiles.length === 0) return null;

    const isUploadingAny = stagedFiles.some((f) => f.isUploading || f.isAwaitingSync);
    const failedStagedCount = stagedFiles.filter((f) => f.hasError).length;

    const getStagedStatusLabel = () => {
        if (isUploadingAny) return ' uploading';
        if (failedStagedCount > 0) return ` failed (${failedStagedCount})`;

        return ' pending';
    };

    const renderRetryAction = () => {
        if (failedStagedCount === 0 || !canUserEdit) return null;

        return (
            <Button type="button" variant="outline" size="sm" onClick={onRetryFailed} className="shrink-0">
                <RotateCcwIcon className="size-3.5" />
                {`Retry failed (${failedStagedCount})`}
            </Button>
        );
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-foreground">
                    {stagedFiles.length}
                    {' file'}
                    {stagedFiles.length === 1 ? '' : 's'}
                    {getStagedStatusLabel()}
                </span>
                {renderRetryAction()}
            </div>

            <ul className="flex flex-col overflow-hidden rounded-2xl border border-border-secondary bg-card">
                {stagedFiles.map((staged) => (
                    <StagedUploadRow key={staged.id} staged={staged} onRemove={onRemove} />
                ))}
            </ul>
        </div>
    );
};

export default StagedFilesList;
