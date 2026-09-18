import { useQueries } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { shouldPollEmbeddingStatus } from '@/utils';

const EMBEDDING_POLL_INTERVAL_MS = 10000;

interface UseEmbeddingStatusPollOptions<TItem> {
    items: TItem[];
    getId: (item: TItem) => string;
    getStatus: (item: TItem) => string | undefined;
    fetchFile: (id: string, signal?: AbortSignal) => Promise<TItem>;
    onUpdate: (item: TItem) => void;
}

export const useEmbeddingStatusPoll = <TItem>({
    items,
    getId,
    getStatus,
    fetchFile,
    onUpdate,
}: UseEmbeddingStatusPollOptions<TItem>): void => {
    const pendingIds = items
        .filter((item) => {
            const status = getStatus(item);

            return status ? shouldPollEmbeddingStatus(status) : false;
        })
        .map(getId);

    const results = useQueries({
        queries: pendingIds.map((id) => ({
            queryKey: ['embedding-status-poll', id],
            queryFn: ({ signal }: { signal: AbortSignal }) => fetchFile(id, signal),
            refetchInterval: EMBEDDING_POLL_INTERVAL_MS,
            refetchOnWindowFocus: false,
        })),
    });

    const appliedRef = useRef<Map<string, number>>(new Map());

    useEffect(() => {
        results.forEach((result, index) => {
            const id = pendingIds[index];

            if (!id || !result.data || !result.dataUpdatedAt) return;
            if (appliedRef.current.get(id) === result.dataUpdatedAt) return;

            appliedRef.current.set(id, result.dataUpdatedAt);
            onUpdate(result.data);
        });
    }, [results, pendingIds, onUpdate]);
};
