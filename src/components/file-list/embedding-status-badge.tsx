import { CheckCircleIcon, CircleOffIcon, CircleXIcon, Loader2Icon, type LucideIcon } from 'lucide-react';

import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { cn } from '@/lib/utils';
import { formatEmbeddingStatusLabel, isEmbeddingInProgress } from '@/utils';

interface EmbeddingStatusBadgeProps {
    status?: string | null;
    error?: string | null;
    className?: string;
}

const getEmbeddingStatusIcon = (status: string): LucideIcon => {
    const normalizedStatus = status.trim().toLowerCase();

    if (normalizedStatus === 'indexed') return CheckCircleIcon;
    if (normalizedStatus === 'failed') return CircleXIcon;
    if (normalizedStatus === 'not-available') return CircleOffIcon;

    return Loader2Icon;
};

const getEmbeddingStatusIconColor = (status: string): string => {
    const normalizedStatus = status.trim().toLowerCase();

    if (normalizedStatus === 'indexed') return 'text-primary';
    if (normalizedStatus === 'failed') return 'text-destructive';
    if (normalizedStatus === 'not-available') return 'text-text-secondary';

    return 'text-primary';
};

const EmbeddingStatusBadge = ({ status, error, className }: EmbeddingStatusBadgeProps) => {
    if (!status) return null;

    const label = formatEmbeddingStatusLabel(status);
    const inProgress = isEmbeddingInProgress(status);
    const StatusIcon = getEmbeddingStatusIcon(status);
    const tooltip = error || label;
    const spin = StatusIcon === Loader2Icon;

    return (
        <SimpleTooltip content={tooltip} side="top">
            <span
                aria-label={label}
                className={cn(
                    'flex size-6 shrink-0 items-center justify-center',
                    getEmbeddingStatusIconColor(status),
                    className,
                )}
            >
                <StatusIcon className={cn('size-4', spin && 'animate-spin', inProgress && !spin && 'animate-pulse')} />
            </span>
        </SimpleTooltip>
    );
};

export default EmbeddingStatusBadge;
