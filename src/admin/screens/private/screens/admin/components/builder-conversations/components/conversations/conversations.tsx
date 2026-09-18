import { MessagesSquareIcon, RefreshCwIcon, SearchXIcon, TrashIcon, TriangleAlertIcon } from 'lucide-react';
import { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import {
    getCreateAgentConversationsPage,
    deleteCreateAgentConversation,
    CREATE_AGENT_CONVERSATIONS_PAGE_SIZE,
    type CreateAgentConversation,
} from '@/app/screens/private/screens/create-agent/lib/builder-conversations-api';
import { ExpandableText, InfiniteScrollTrigger, SearchInput } from '@/components';
import { Button } from '@/components/ui/button';
import ConfirmationModal from '@/components/ui/confirmation-modal';
import { Skeleton } from '@/components/ui/skeleton';
import { useInfiniteScroll } from '@/hooks';
import { cn } from '@/lib/utils';
import type { AgentType } from '@/types/admin';
import { showErrorToast } from '@/utils';
import { formatRelativeTime } from '@/utils/date';

import { BUILDER_CONVERSATIONS_PATH } from '../../constants';

import './conversations.scss';

interface StateType {
    loading: boolean;
    error: boolean;
    conversations: CreateAgentConversation[];
    page: number;
    count: number;
    total_count: number;
    total_pages: number;
}

const DEFAULT_STATE: StateType = {
    loading: true,
    error: false,
    conversations: [],
    page: 0,
    count: 0,
    total_count: 0,
    total_pages: 0,
};

interface Props {
    agent: AgentType;
    selectedConversationId?: string;
}

const Conversations = (props: Props) => {
    const { agent, selectedConversationId } = props;
    const navigate = useNavigate();

    const [state, setState] = useState<StateType>(DEFAULT_STATE);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(0);
    const [showMoreLoading, setShowMoreLoading] = useState(false);
    const [loadMoreError, setLoadMoreError] = useState(false);
    const [isDeletePending, setIsDeletePending] = useState(false);
    const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState<CreateAgentConversation | null>(null);
    const isFetchingRef = useRef(false);
    const failedPageRef = useRef(0);
    const requestIdRef = useRef(0);

    // The API pages by message while the list is deduped by conversation and filtered by agent,
    // so `conversations.length` can never reach `total_count` and only the page index can say
    // when the list is exhausted.
    const hasMore = state.page + 1 < state.total_pages;

    const { loadMoreRef } = useInfiniteScroll({
        loading: state.loading,
        showMoreLoading,
        hasMore,
        itemsLength: state.conversations.length,
        onLoadMore: () => {
            void fetchConversations(page + 1);
        },
    });

    const fetchConversations = useCallback(
        async (pageNo: number, reset: boolean = false) => {
            if (isFetchingRef.current && !reset) return;
            isFetchingRef.current = true;

            // A reset for a newly selected agent can overtake an in-flight load-more. Every write
            // made after the await belongs to the newest request only, or the previous agent's rows
            // land under the current agent's slug.
            requestIdRef.current += 1;
            const requestId = requestIdRef.current;
            const isLatestRequest = () => requestIdRef.current === requestId;

            // Every write that tracks an in-flight request sits past the guard: a bailed-out call
            // that cleared the failure notice would drop the retry, and one that left the scroll
            // sentinel mounted lets `useInfiniteScroll` refire once per render while the reset runs.
            setLoadMoreError(false);

            if (reset) {
                setState((prev) => ({ ...prev, loading: true }));
            } else {
                setShowMoreLoading(true);
            }

            try {
                const result = await getCreateAgentConversationsPage(
                    agent._id,
                    pageNo,
                    CREATE_AGENT_CONVERSATIONS_PAGE_SIZE,
                );

                if (!isLatestRequest()) return;

                setState((prevState) => ({
                    ...prevState,
                    loading: false,
                    error: false,
                    conversations: reset ? result.conversations : [...prevState.conversations, ...result.conversations],
                    // The requested page, not the echoed one, so termination does not depend on the
                    // server's page-index convention.
                    page: pageNo,
                    count: result.conversations.length,
                    total_count: result.pageInfo.totalCount,
                    total_pages: result.pageInfo.totalPages,
                }));
                // `onLoadMore` reads this to pick the next page to request, so it advances only once
                // the page it names is actually in the list — a failed load-more cannot make it skip
                // ahead. Request-id gated by the early return above.
                setPage(reset ? 0 : pageNo);
            } catch (err) {
                console.error(err);
                if (!isLatestRequest()) return;

                failedPageRef.current = pageNo;
                setState((prev) => ({
                    ...prev,
                    loading: false,
                    error: reset ? true : prev.error,
                    conversations: reset ? [] : prev.conversations,
                }));
                setLoadMoreError(!reset);
            } finally {
                if (isLatestRequest()) {
                    setShowMoreLoading(false);
                    isFetchingRef.current = false;
                }
            }
        },
        [agent._id],
    );

    useEffect(() => {
        fetchConversations(0, true);
    }, [fetchConversations]);

    const onRetryFirstPageClick = () => {
        setState((prev) => ({
            ...prev,
            ...DEFAULT_STATE,
            loading: true,
        }));
        void fetchConversations(0, true);
    };

    const onRetryLoadMoreClick = () => {
        void fetchConversations(failedPageRef.current);
    };

    const onConfirmClick = async () => {
        if (!isConfirmationModalOpen) return;
        try {
            setIsDeletePending(true);
            await deleteCreateAgentConversation(isConfirmationModalOpen._id, agent._id);

            setState((prevState) => ({
                ...prevState,
                conversations: prevState.conversations.filter((conv) => conv._id !== isConfirmationModalOpen._id),
                total_count: prevState.total_count - 1,
            }));

            // The open conversation is addressed by the URL, so deleting it has to clear the
            // path too or the detail panel keeps requesting a conversation that is gone.
            if (selectedConversationId === isConfirmationModalOpen._id) {
                navigate(`${BUILDER_CONVERSATIONS_PATH}/${agent.slug}`);
            }

            setIsConfirmationModalOpen(null);
        } catch (error) {
            console.error(error);
            showErrorToast(error instanceof Error ? error.message : 'Failed to delete conversation. Please try again.');
        } finally {
            setIsDeletePending(false);
        }
    };

    const closeConfirmModal = () => {
        setIsConfirmationModalOpen(null);
    };

    const filteredConversations = search
        ? state.conversations.filter((conv) => conv.title.toLowerCase().includes(search.toLowerCase()))
        : state.conversations;

    const renderList = () => {
        if (state.loading) {
            return (
                <>
                    {Array.from({ length: 6 }, (_, index) => (
                        <li
                            key={`skeleton-${index}`}
                            className="history-list-item skeleton-list-item flex flex-col gap-2 px-4 py-2"
                        >
                            <Skeleton className="h-4 w-full rounded-md" />
                            <div className="flex items-center justify-between">
                                <Skeleton className="h-[17px] w-2/5 rounded-md" />
                                <Skeleton className="h-[17px] w-2/5 rounded-md" />
                            </div>
                        </li>
                    ))}
                </>
            );
        }
        if (state.error) {
            return (
                <li className="flex flex-1 list-none flex-col items-center justify-center gap-4 px-6 py-12 text-center">
                    <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                        <TriangleAlertIcon className="size-5" aria-hidden="true" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <p className="text-sm font-medium text-foreground">Something went wrong</p>
                        <p className="text-xs text-muted-foreground">
                            Couldn&apos;t load conversations. Please try again.
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={onRetryFirstPageClick}
                    >
                        <RefreshCwIcon />
                        Retry
                    </Button>
                </li>
            );
        }

        // A page can dedupe down to no new rows, so an empty list is only really empty once
        // there is nothing left to fetch. Until then the footer keeps the sentinel mounted.
        if (filteredConversations.length === 0) {
            return (
                <>
                    {!hasMore && !showMoreLoading && renderEmptyState()}
                    {renderListFooter()}
                </>
            );
        }

        return (
            <>
                {filteredConversations.map((conversation) => (
                    <li
                        className={cn(
                            'history-list-item conversation-list-item cursor-pointer px-4 py-2',
                            'border-b border-border-secondary hover:bg-muted',
                            selectedConversationId === conversation._id && 'active bg-muted',
                        )}
                        key={conversation._id}
                    >
                        <Link
                            to={`${BUILDER_CONVERSATIONS_PATH}/${agent.slug}/${conversation._id}`}
                            className="flex text-(--text-primary)"
                        >
                            <div className="conversations-subject flex w-full flex-col gap-1">
                                <div className="flex items-start justify-between">
                                    <ExpandableText
                                        maxLines={2}
                                        showMoreText="Read more"
                                        showLessText="Read less"
                                        textClassName="text-sm"
                                    >
                                        <span className="text-sm text-(--text-primary)">{conversation.title}</span>
                                    </ExpandableText>
                                    <Button
                                        variant="destructive"
                                        size="icon-xs"
                                        className="delete-button conversation-delete-button rounded-full opacity-0 max-lg:opacity-100"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            setIsConfirmationModalOpen(conversation);
                                        }}
                                    >
                                        <TrashIcon />
                                    </Button>
                                </div>
                                <div className="name-date flex items-center justify-between gap-2">
                                    {/* <span className="text-xs font-medium text-text-secondary">
                                            {conversation.user?.name ? `${conversation.user.name.first} ${conversation.user.name.last}` : 'Unknown User'}
                                        </span> */}
                                    {conversation.updated_at && (
                                        <span className="shrink-0 text-xs font-medium text-text-secondary">
                                            {formatRelativeTime(conversation.updated_at)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </Link>
                    </li>
                ))}
                {renderListFooter()}
            </>
        );
    };

    const renderEmptyStateShell = (
        icon: React.ReactNode,
        title: string,
        description: string,
        action?: React.ReactNode,
    ) => {
        return (
            <li className="conversation-empty-state flex flex-1 list-none flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                <div className="flex size-10 items-center justify-center rounded-full bg-muted text-text-secondary">
                    {icon}
                </div>
                <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-foreground">{title}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
                </div>
                {action}
            </li>
        );
    };

    const renderEmptyState = () => {
        const query = search.trim();

        if (query) {
            return renderEmptyStateShell(
                <SearchXIcon className="size-5" aria-hidden="true" />,
                'No matching conversations',
                `Nothing here matches "${query}".`,
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => setSearch('')}
                >
                    Clear search
                </Button>,
            );
        }

        return renderEmptyStateShell(
            <MessagesSquareIcon className="size-5" aria-hidden="true" />,
            'No builder conversations',
            `${agent.name} has no builder conversations yet.`,
        );
    };

    // The failure notice replaces the scroll sentinel rather than sitting beside it, so the
    // observer cannot immediately re-request the page that just failed.
    const renderListFooter = () => {
        if (loadMoreError) {
            return (
                <li className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="text-xs text-muted-foreground">Could not load more conversations.</span>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={onRetryLoadMoreClick}
                    >
                        <RefreshCwIcon />
                        Retry
                    </Button>
                </li>
            );
        }

        return (
            <li>
                <InfiniteScrollTrigger isLoading={showMoreLoading} hasMore={hasMore} loadMoreRef={loadMoreRef} />
            </li>
        );
    };

    const renderConfirmationModal = () => {
        if (isConfirmationModalOpen) {
            return (
                <ConfirmationModal
                    isOpen={isConfirmationModalOpen ? true : false}
                    onClose={() => closeConfirmModal()}
                    onConfirm={() => onConfirmClick()}
                    title="Delete Confirmation"
                    confirmButtonText="Confirm"
                    cancelButtonText="Cancel"
                    isButtonLoading={isDeletePending}
                >
                    <div className="mx-auto flex flex-col items-center justify-center text-center">
                        <span className="text-sm">Are you sure you want to Delete ?</span>
                    </div>
                </ConfirmationModal>
            );
        }

        return null;
    };

    return (
        <>
            <ul className={cn('history-list conversation-list flex min-h-full flex-col')}>
                <div className="search-block sticky top-0 z-1 flex items-center gap-3 border-b border-border-secondary px-4 py-2">
                    <SearchInput
                        searchOnChange
                        placeholder="Search"
                        search={search}
                        onChange={(value) => {
                            setSearch(value);
                        }}
                    />
                </div>
                {renderList()}
            </ul>
            {renderConfirmationModal()}
        </>
    );
};

export default Conversations;
