import type { DataStoreType } from '@/types/admin';

type OkfStatus = NonNullable<DataStoreType['okfStatus']>;

/**
 * Status pill styling per okfStatus value. A tinted dot + label reads as a status
 * at a glance, where the muted `secondary` Badge rendered as plain unlabelled text.
 */
export const OKF_STATUS_MAP: Record<OkfStatus, { label: string; dotClassName: string; pillClassName: string }> = {
    pending: {
        label: 'Pending',
        dotClassName: 'bg-text-secondary',
        pillClassName: 'bg-muted text-text-secondary',
    },
    generating: {
        label: 'Generating',
        dotClassName: 'bg-primary',
        pillClassName: 'bg-primary/10 text-primary',
    },
    completed: {
        label: 'Completed',
        dotClassName: 'bg-success',
        pillClassName: 'bg-success/10 text-success',
    },
    failed: {
        label: 'Failed',
        dotClassName: 'bg-destructive',
        pillClassName: 'bg-destructive/10 text-destructive',
    },
};
