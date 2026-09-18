import { ArrowLeftIcon, PlusIcon } from 'lucide-react';
import { useCallback, type FC } from 'react';

import useConversationHistory from '@/components/agent-chat/hooks/use-conversation-history';
import { useChatClassNames } from '@/components/chat-host';
import InfiniteScrollTrigger from '@/components/infinite-scroll-trigger';
import useInfiniteScroll from '@/hooks/use-infinite-scroll';
import { cn } from '@/lib/utils';
import type { ChatAgentType } from '@/types/admin';
import type { HistoryType } from '@/types/chat';

interface RecentsPanelProps {
    /** Agent the conversation history belongs to. */
    agent: ChatAgentType;
    /** Id of the conversation currently open, for the active-item highlight. */
    activeConversationId: string | null;
    /** Load an existing conversation into the widget. */
    onSelectConversation: (conversationId: string) => void;
    /** Start a fresh conversation from the panel. */
    onNewChat: () => void;
    /** Return to the conversation view. */
    onClose: () => void;
    /** Suppress the panel's own header (the floating widget renders one instead). */
    hideHeader?: boolean;
}

const cleanTitle = (raw: string): string => {
    if (!raw) return '';

    // Strip remark-directive mention markup like :skill[Label]{name=...} -> Label
    let out = raw.replace(/:[a-zA-Z][\w-]*\[([^\]]*)\](?:\{[^}]*\})?/g, '$1');

    try {
        out = decodeURIComponent(out);
    } catch {
        // Leave as-is when the value is not valid percent-encoding.
    }

    return out.trim();
};

const titleFor = (history: HistoryType): string => cleanTitle(history.title) || 'New chat';

const headingClass = 'text-[11px] font-semibold uppercase tracking-[0.06em] text-text-secondary opacity-70';

const RecentsPanel: FC<RecentsPanelProps> = ({
    agent,
    activeConversationId,
    onSelectConversation,
    onNewChat,
    onClose,
    hideHeader = false,
}) => {
    const classNames = useChatClassNames();
    const { allHistories, state, fetchAllConversations } = useConversationHistory(agent, { includeAll: true });
    const hasMore = state.allPages - state.allPage > 1;

    const handleLoadMore = useCallback(() => {
        if (state.allPages - state.allPage > 1) {
            void fetchAllConversations(state.allPage + 1);
        }
    }, [fetchAllConversations, state.allPage, state.allPages]);

    const { loadMoreRef } = useInfiniteScroll({
        loading: state.allLoading,
        showMoreLoading: state.allShowMoreLoading,
        hasMore,
        itemsLength: allHistories.length,
        onLoadMore: handleLoadMore,
    });

    const itemBaseClass =
        'block w-full text-left bg-transparent border border-transparent cursor-pointer' +
        ' px-3 py-2 text-sm text-foreground! font-normal! leading-snug rounded-lg truncate' +
        ' transition-colors duration-140 hover:bg-[color-mix(in_srgb,var(--primary)_9%,var(--surface))] hover:text-primary!';

    const itemActiveClass =
        'bg-[color-mix(in_srgb,var(--primary)_9%,var(--surface))]' +
        ' border-[color-mix(in_srgb,var(--primary)_18%,var(--border))] font-medium! text-primary!';

    const renderContent = () => {
        if (state.allLoading && allHistories.length === 0) {
            return (
                <div className="flex flex-col gap-2 px-4 py-2">
                    {[0, 1, 2, 3].map((row) => (
                        <div key={row} className="h-8 rounded-lg bg-muted" />
                    ))}
                </div>
            );
        }

        if (state.allError) {
            return <p className="px-4 py-2 text-sm text-text-secondary opacity-70">Failed to load conversations.</p>;
        }

        if (allHistories.length === 0) {
            return <p className="px-4 py-2 text-sm text-text-secondary opacity-70">No conversations yet.</p>;
        }

        return (
            <div className="recents-panel-content flex flex-col gap-0.5 px-2">
                {allHistories.map((history) => {
                    const isActive = history._id === activeConversationId;
                    const title = titleFor(history);

                    return (
                        <button
                            key={history._id}
                            type="button"
                            className={cn(itemBaseClass, isActive && itemActiveClass)}
                            title={title}
                            aria-current={isActive ? 'true' : undefined}
                            onClick={() => onSelectConversation(history._id)}
                        >
                            {title}
                        </button>
                    );
                })}
                <InfiniteScrollTrigger
                    isLoading={state.allShowMoreLoading}
                    hasMore={hasMore}
                    loadMoreRef={loadMoreRef}
                />
            </div>
        );
    };

    const renderHeader = () => {
        if (hideHeader) return null;

        return (
            <div className="recents-panel-header flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
                <button
                    type="button"
                    className="flex size-8 cursor-pointer items-center justify-center rounded-md border border-transparent bg-transparent text-text-secondary transition-colors duration-140 hover:bg-[color-mix(in_srgb,var(--primary)_7%,var(--surface))] hover:text-primary"
                    aria-label="Back to chat"
                    onClick={onClose}
                >
                    <ArrowLeftIcon size={16} aria-hidden="true" />
                </button>
                <h5 className={cn(headingClass, 'flex-1')}>Recents</h5>
                <button
                    type="button"
                    className="flex size-8 cursor-pointer items-center justify-center rounded-md border border-transparent bg-transparent text-text-secondary transition-colors duration-140 hover:bg-[color-mix(in_srgb,var(--primary)_7%,var(--surface))] hover:text-primary"
                    aria-label="New chat"
                    onClick={onNewChat}
                >
                    <PlusIcon size={16} aria-hidden="true" />
                </button>
            </div>
        );
    };

    return (
        <div className={cn('recents-panel absolute inset-0 z-20 flex flex-col bg-background', classNames.recents)}>
            {renderHeader()}
            <div className="scrollbar-controller scrollbar-vertical min-h-0 flex-1 py-2">{renderContent()}</div>
        </div>
    );
};

export default RecentsPanel;
