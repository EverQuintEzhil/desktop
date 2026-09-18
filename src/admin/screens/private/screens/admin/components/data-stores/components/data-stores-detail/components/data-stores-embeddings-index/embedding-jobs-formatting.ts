export const EMBEDDING_JOB_DATETIME_OPTIONS: Intl.DateTimeFormatOptions = {
    dateStyle: 'medium',
    timeStyle: 'short',
};

export function formatJobDuration(startedAt: string, finishedAt: string): string | null {
    const start = new Date(startedAt).getTime();
    const end = new Date(finishedAt).getTime();

    if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
        return null;
    }
    const sec = Math.round((end - start) / 1000);

    if (sec < 60) {
        return `${sec}s`;
    }
    const m = Math.floor(sec / 60);
    const s = sec % 60;

    return `${m}m ${s}s`;
}

export function formatEmbeddingJobDateTime(iso: string | undefined): string {
    if (!iso) {
        return 'N/A';
    }
    const t = new Date(iso).getTime();

    if (Number.isNaN(t)) {
        return 'N/A';
    }

    return new Date(iso).toLocaleString(undefined, EMBEDDING_JOB_DATETIME_OPTIONS);
}
