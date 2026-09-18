import React from 'react';

import Spinner from '../ui/spinner';

interface InfiniteScrollTriggerProps {
    isLoading: boolean;
    hasMore: boolean;
    loadMoreRef: React.Ref<HTMLDivElement | null>;
    renderLoader?: () => React.ReactNode;
}

const InfiniteScrollTrigger = (props: InfiniteScrollTriggerProps) => {
    const { isLoading, hasMore, loadMoreRef, renderLoader } = props;

    if (isLoading) {
        if (renderLoader) {
            return renderLoader();
        }

        return (
            <div className="flex items-center justify-center px-4 py-8">
                <Spinner />
            </div>
        );
    }
    if (hasMore) {
        return <div ref={loadMoreRef} className="my-[40px] h-px w-full" />;
    }

    return null;
};

export default InfiniteScrollTrigger;
