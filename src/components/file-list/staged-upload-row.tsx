import { AlertCircleIcon, CheckCircle2Icon, LoaderCircleIcon, XIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

import { ACTION_BUTTON_CLASS_NAME, fileIconFor, formatFileSize, type StagedFileStatus } from './file-list-utils';

interface StagedUploadRowProps {
    staged: StagedFileStatus;
    onRemove?: (id: string) => void;
}

const clampProgress = (value: number): number => Math.min(100, Math.max(0, Math.round(value || 0)));

const getStatusLabel = (staged: StagedFileStatus): string => {
    if (staged.hasError) return 'Upload failed';
    if (staged.isAwaitingSync) return 'Uploading';
    if (staged.isSuccess) return 'Complete';
    if (staged.isUploading) return 'Uploading';

    return 'Queued';
};

const getStatusIcon = (staged: StagedFileStatus) => {
    if (staged.hasError) return AlertCircleIcon;
    if (staged.isAwaitingSync) return LoaderCircleIcon;
    if (staged.isSuccess) return CheckCircle2Icon;

    return LoaderCircleIcon;
};

const StagedUploadRow = ({ staged, onRemove }: StagedUploadRowProps) => {
    const progress = clampProgress(staged.progress);
    const extension = staged.file.name.split('.').pop();
    const Icon = fileIconFor(extension);
    const isComplete = Boolean(staged.isSuccess);
    const isAwaitingSync = Boolean(staged.isAwaitingSync);
    const statusLabel = getStatusLabel(staged);
    const StatusIcon = getStatusIcon(staged);
    const canRemove = Boolean(onRemove) && !isComplete && !isAwaitingSync;

    return (
        <li
            aria-busy={isAwaitingSync || undefined}
            className={cn(
                'group relative flex items-center gap-3 overflow-hidden border-t border-border-secondary px-4 py-3 first:border-t-0',
                'bg-card transition-colors duration-140',
                'hover:bg-[color-mix(in_srgb,var(--primary)_6%,var(--surface))]',
                staged.hasError && 'bg-destructive/5 hover:bg-destructive/10',
            )}
        >
            <span
                className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-xl',
                    'bg-primary/10 text-primary',
                    staged.hasError && 'bg-destructive/10 text-destructive',
                )}
            >
                <Icon className="size-5" />
            </span>

            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="line-clamp-1 text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                    {staged.file.name}
                </span>
                <span className="text-xs text-text-secondary">{formatFileSize(staged.file.size)}</span>
            </span>

            <span
                className={cn(
                    'flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                    'bg-primary/10 text-primary',
                    staged.hasError && 'bg-destructive/10 text-destructive',
                    isComplete && !isAwaitingSync && 'bg-emerald-500/10 text-emerald-600',
                )}
            >
                <StatusIcon
                    className={cn(
                        'size-3.5',
                        (isAwaitingSync || (staged.isUploading && !isComplete)) && !staged.hasError && 'animate-spin',
                    )}
                />
                {statusLabel}
            </span>

            <Progress
                value={staged.hasError ? 100 : progress}
                className={cn(
                    'absolute inset-x-0 bottom-0 h-1 rounded-none bg-primary/15',
                    staged.hasError && 'bg-destructive/15 **:data-[slot=progress-indicator]:bg-destructive',
                )}
            />

            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={staged.isUploading ? `Cancel upload for ${staged.file.name}` : `Remove ${staged.file.name}`}
                className={cn(ACTION_BUTTON_CLASS_NAME, 'opacity-100 hover:bg-destructive/10 hover:text-destructive')}
                disabled={!canRemove}
                onClick={() => onRemove?.(staged.id)}
            >
                <XIcon className="size-4" />
            </Button>
        </li>
    );
};

export default StagedUploadRow;
