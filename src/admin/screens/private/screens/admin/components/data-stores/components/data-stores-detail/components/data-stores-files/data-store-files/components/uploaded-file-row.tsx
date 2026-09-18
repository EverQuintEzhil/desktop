import { DownloadIcon, Loader2Icon, MoreVerticalIcon, Trash2Icon } from 'lucide-react';

import { EmbeddingStatusBadge, SURFACE_HOVER_CLASS_NAME, formatFileDate, formatFileSize } from '@/components/file-list';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRoot,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { DataStoreFileRecord } from '@/lib/api/admin/data-stores';
import { cn } from '@/lib/utils';

import { isPreviewableRecord } from '../utils/preview';

import FileThumb from './file-thumb';

export interface Props {
    record: DataStoreFileRecord;
    canUserEdit: boolean;
    isSelected: boolean;
    isFileMutating: boolean;
    isDownloading: boolean;
    isDeleting: boolean;
    onToggleSelect: (id: string, checked: boolean) => void;
    onPreview: (record: DataStoreFileRecord) => void;
    onDownload: (record: DataStoreFileRecord) => void;
    onDeleteRequest: (record: DataStoreFileRecord) => void;
}

const UploadedFileRow = ({
    record,
    canUserEdit,
    isSelected,
    isFileMutating,
    isDownloading,
    isDeleting,
    onToggleSelect,
    onPreview,
    onDownload,
    onDeleteRequest,
}: Props) => {
    const meta = [formatFileSize(record.meta?.size), record.type, formatFileDate(record.created_at)]
        .filter(Boolean)
        .join(' · ');
    const previewable = isPreviewableRecord(record);

    const handleActivate = () => {
        if (previewable) {
            onPreview(record);

            return;
        }
        if (canUserEdit && !isFileMutating) {
            onToggleSelect(record._id, !isSelected);
        }
    };

    return (
        <li
            className={cn(
                'group flex items-center gap-3 border-t border-border-secondary px-4 py-3 first:border-t-0',
                'transition-colors duration-140',
                SURFACE_HOVER_CLASS_NAME,
                (previewable || canUserEdit) && 'cursor-pointer',
            )}
            role={previewable || canUserEdit ? 'button' : undefined}
            tabIndex={previewable || canUserEdit ? 0 : undefined}
            onClick={handleActivate}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleActivate();
                }
            }}
        >
            {canUserEdit && (
                <div onClick={(e) => e.stopPropagation()} role="presentation">
                    <Checkbox
                        checked={isSelected}
                        disabled={isFileMutating}
                        className="cursor-pointer"
                        onChange={(_, checked) => onToggleSelect(record._id, checked)}
                    />
                </div>
            )}

            <FileThumb record={record} />

            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="line-clamp-1 text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                    {record.name}
                </span>
                {meta && <span className="text-xs text-text-secondary">{meta}</span>}
            </span>

            <EmbeddingStatusBadge status={record.embedding_status} error={record.embedding_error} />

            <div
                className={cn(
                    'flex shrink-0 items-center opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100',
                    (isDownloading || isDeleting) && 'opacity-100',
                )}
                onClick={(e) => e.stopPropagation()}
                role="presentation"
            >
                <DropdownMenuRoot>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Actions for ${record.name}`}
                            className="cursor-pointer text-text-secondary hover:text-foreground"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <MoreVerticalIcon />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[160px]">
                        <DropdownMenuItem
                            className="cursor-pointer"
                            disabled={isDownloading}
                            onSelect={(e) => e.preventDefault()}
                            onClick={() => onDownload(record)}
                        >
                            {isDownloading ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />}
                            <span>Download</span>
                        </DropdownMenuItem>
                        {canUserEdit ? (
                            <DropdownMenuItem
                                variant="destructive"
                                className="cursor-pointer"
                                disabled={isFileMutating || isDeleting}
                                onSelect={(e) => e.preventDefault()}
                                onClick={() => onDeleteRequest(record)}
                            >
                                {isDeleting ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />}
                                <span>Delete</span>
                            </DropdownMenuItem>
                        ) : null}
                    </DropdownMenuContent>
                </DropdownMenuRoot>
            </div>
        </li>
    );
};

export default UploadedFileRow;
