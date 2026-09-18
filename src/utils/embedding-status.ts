export type EmbeddingStatusVariant = 'default' | 'secondary' | 'destructive' | 'outline';

export const formatEmbeddingStatusLabel = (status: string): string => {
    const normalized = status.trim().toLowerCase();

    if (normalized === 'not-available') return 'Not searchable';
    if (normalized === 'document-converting') return 'Reading document';
    if (normalized === 'md-available') return 'Analyzing content';
    if (normalized === 'chunked') return 'Indexing content';
    if (normalized === 'indexed') return 'Content Searchable';
    if (normalized === 'failed') return 'Failed';

    return status.replace(/[-_]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};

export const isEmbeddingInProgress = (status: string): boolean => {
    const normalized = status.trim().toLowerCase();

    return normalized !== 'indexed' && normalized !== 'failed' && normalized !== 'not-available';
};

export const shouldPollEmbeddingStatus = (status: string): boolean => {
    const normalized = status.trim().toLowerCase();

    return normalized !== 'indexed' && normalized !== 'failed';
};

export const getEmbeddingStatusVariant = (status: string): EmbeddingStatusVariant => {
    const normalized = status.trim().toLowerCase();

    if (normalized === 'failed') return 'destructive';
    if (normalized === 'indexed') return 'default';
    if (normalized === 'chunked') return 'secondary';
    if (normalized === 'document-converting') return 'secondary';
    if (normalized === 'md-available') return 'secondary';

    return 'outline';
};
