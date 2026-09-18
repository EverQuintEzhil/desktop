import type { JobStatusEnum } from '@/types/admin';

export const JOB_STATUS_MAP: Record<
    JobStatusEnum,
    {
        label: string;
        variant: 'default' | 'secondary' | 'destructive' | 'outline';
    }
> = {
    queued: { label: 'Queued', variant: 'secondary' },
    running: { label: 'Running', variant: 'default' },
    completed: { label: 'Completed', variant: 'secondary' },
    failed: { label: 'Failed', variant: 'destructive' },
    'retry-queued': { label: 'Retrying', variant: 'outline' },
    killed: { label: 'Killed', variant: 'destructive' },
    cancelled: { label: 'Cancelled', variant: 'outline' },
};

/** API may return aliases (e.g. success) not in JobStatusEnum. */
export const EMBEDDING_JOB_STATUS_MAP: Record<
    string,
    {
        label: string;
        variant: 'default' | 'secondary' | 'destructive' | 'outline';
    }
> = {
    ...JOB_STATUS_MAP,
    success: { label: 'Completed', variant: 'secondary' },
};
