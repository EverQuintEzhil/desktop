export const isPendingStatus = (status: string | null | undefined): boolean => {
    const value = String(status ?? '').toLowerCase();

    return value === 'running' || value === 'queued' || value === 'retry-queued';
};
