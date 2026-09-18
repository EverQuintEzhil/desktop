import React, { useRef, useCallback, useEffect, useState } from 'react';

interface UseInfiniteScrollOptions {
    loading: boolean;
    showMoreLoading: boolean;
    hasMore: boolean;
    itemsLength: number;
    onLoadMore: () => void;
    threshold?: number;
    rootMargin?: string;
}

interface UseInfiniteScrollReturn {
    loadMoreRef: React.Ref<HTMLDivElement | null>;
}

const useInfiniteScroll = ({
    loading,
    showMoreLoading,
    hasMore,
    itemsLength,
    onLoadMore,
    threshold = 0.1,
    rootMargin = '50px',
}: UseInfiniteScrollOptions): UseInfiniteScrollReturn => {
    const observerRef = useRef<IntersectionObserver | null>(null);
    const [sentinelNode, setSentinelNode] = useState<HTMLDivElement | null>(null);

    const loadMoreRef = useCallback((node: HTMLDivElement | null) => {
        setSentinelNode(node);
    }, []);

    const handleIntersection = useCallback(
        (entries: IntersectionObserverEntry[]) => {
            const [entry] = entries;

            if (entry.isIntersecting && !showMoreLoading && hasMore && itemsLength > 0) {
                onLoadMore();
            }
        },
        [showMoreLoading, hasMore, itemsLength, onLoadMore],
    );

    useEffect(() => {
        if (observerRef.current) {
            observerRef.current.disconnect();
            observerRef.current = null;
        }

        if (hasMore && !loading && sentinelNode) {
            observerRef.current = new IntersectionObserver(handleIntersection, {
                threshold,
                rootMargin,
            });
            observerRef.current.observe(sentinelNode);
        }

        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
                observerRef.current = null;
            }
        };
    }, [handleIntersection, hasMore, loading, threshold, rootMargin, sentinelNode]);

    return {
        loadMoreRef,
    };
};

export default useInfiniteScroll;
