import { CircleAlert, RefreshCw } from 'lucide-react';
import type { FC } from 'react';

import { InfiniteScrollTrigger } from '@/components';
import { Button } from '@/components/ui/button';
import { useInfiniteScroll } from '@/hooks';
import { cn } from '@/lib/utils';

import type { CreateAgentConversation } from '../../../lib/builder-conversations-api';

interface RecentsPanelProps {
    conversations: CreateAgentConversation[];
    activeConversationId: string;
    hasMore: boolean;
    loadingMore: boolean;
    isError: boolean;
    loadMoreError: boolean;
    onRetry: () => void;
    onLoadMore: () => void;
    onSelectConversation: (conversationId: string) => void;
}

const cleanTitle = (raw: string): string => {
    if (!raw) return '';
    // Strip remark-directive mention markup like :skill[Label]{name=...} -> Label
    let out = raw.replace(/:[a-zA-Z][\w-]*\[([^\]]*)\](?:\{[^}]*\})?/g, '$1');

    // Decode URL-encoded fragments (e.g. %20)
    try {
        out = decodeURIComponent(out);
    } catch {
        // leave as-is if not valid encoding
    }

    return out.trim();
};

const titleFor = (conversation: CreateAgentConversation): string => cleanTitle(conversation.title) || 'New chat';

export const RecentsPanel: FC<RecentsPanelProps> = ({
    conversations,
    activeConversationId,
    hasMore,
    loadingMore,
    isError,
    loadMoreError,
    onRetry,
    onLoadMore,
    onSelectConversation,
}) => {
    const { loadMoreRef } = useInfiniteScroll({
        loading: false,
        showMoreLoading: loadingMore,
        hasMore,
        itemsLength: conversations.length,
        onLoadMore,
    });

    const renderEmpty = () => (
        <div className="recents-panel-empty mb-2 flex flex-col gap-2">
            <h5 className="text-[11px] font-semibold tracking-[0.06em] text-text-secondary uppercase opacity-70">
                Recents
            </h5>
            <p className="text-sm text-text-secondary opacity-70">No conversations yet.</p>
        </div>
    );

    const renderError = () => (
        <div className="recents-panel-error flex flex-col items-center gap-3 py-6 text-center">
            <h5 className="self-start text-[11px] font-semibold tracking-[0.06em] text-text-secondary uppercase opacity-70">
                Recents
            </h5>
            <span
                className={cn(
                    'flex size-9 items-center justify-center rounded-xl',
                    'bg-[color-mix(in_srgb,var(--destructive)_8%,var(--surface))] text-destructive',
                    'border border-[color-mix(in_srgb,var(--destructive)_14%,var(--border))]',
                )}
            >
                <CircleAlert size={16} aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold">Could not load conversations</span>
                <span className="text-xs leading-normal text-text-secondary">Check your connection and try again.</span>
            </div>
            <Button type="button" variant="secondary" size="sm" className="rounded-[10px]" onClick={onRetry}>
                <RefreshCw className="size-4" aria-hidden="true" />
                Retry
            </Button>
        </div>
    );

    const renderLoadMoreFailure = () => (
        <div className="recents-panel-load-more-error flex flex-col items-center gap-2 py-4 text-center">
            <span className="text-xs text-text-secondary">Could not load more conversations.</span>
            <Button type="button" variant="secondary" size="sm" className="rounded-[10px]" onClick={onRetry}>
                <RefreshCw className="size-4" aria-hidden="true" />
                Retry
            </Button>
        </div>
    );

    const renderListFooter = () => {
        if (loadMoreError) {
            return renderLoadMoreFailure();
        }

        return <InfiniteScrollTrigger isLoading={loadingMore} hasMore={hasMore} loadMoreRef={loadMoreRef} />;
    };

    const itemBaseClass =
        'block w-full text-left bg-transparent border border-transparent cursor-pointer' +
        ' px-3 py-2 text-sm text-foreground! font-normal! leading-snug rounded-lg truncate' +
        ' transition-colors duration-140 hover:bg-[color-mix(in_srgb,var(--primary)_9%,var(--surface))] hover:text-primary!';

    const itemActiveClass =
        'bg-[color-mix(in_srgb,var(--primary)_9%,var(--surface))]' +
        ' border-[color-mix(in_srgb,var(--primary)_18%,var(--border))] font-medium! text-primary!';

    if (isError && conversations.length === 0) {
        return <div className="scrollbar-controller scrollbar-vertical flex-1 p-4">{renderError()}</div>;
    }

    if (conversations.length === 0) {
        return <div className="scrollbar-controller scrollbar-vertical flex-1 p-4">{renderEmpty()}</div>;
    }

    return (
        <div className="recents-panel scrollbar-controller scrollbar-vertical flex flex-1 flex-col gap-3 pb-4">
            <div className="recents-panel-header sticky top-0 z-1 bg-background px-5 py-2">
                <h5 className="text-[11px] font-semibold tracking-[0.06em] text-text-secondary uppercase opacity-70">
                    Recents
                </h5>
            </div>
            <div className="recents-panel-content flex flex-col gap-0.5 px-2">
                {conversations.map((conversation) => {
                    const isActive = conversation._id === activeConversationId;
                    const itemClass = cn(itemBaseClass, isActive && itemActiveClass);
                    const title = titleFor(conversation);

                    return (
                        <button
                            key={conversation._id}
                            type="button"
                            className={itemClass}
                            title={title}
                            aria-current={isActive ? 'true' : undefined}
                            onClick={() => onSelectConversation(conversation._id)}
                        >
                            {title}
                        </button>
                    );
                })}
                {renderListFooter()}
            </div>
        </div>
    );
};
