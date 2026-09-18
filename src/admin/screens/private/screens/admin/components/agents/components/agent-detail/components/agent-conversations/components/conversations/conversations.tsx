import axios from 'axios';
import { FunnelIcon, RefreshCwIcon, TrashIcon, TriangleAlertIcon } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ExpandableText, InfiniteScrollTrigger, SearchInput } from '@/components';
import { Button } from '@/components/ui/button';
import ConfirmationModal from '@/components/ui/confirmation-modal';
import { Skeleton } from '@/components/ui/skeleton';
import { useInfiniteScroll } from '@/hooks';
import { appConversationApi } from '@/lib/api/app/conversation';
import { cn } from '@/lib/utils';
import type { AgentType } from '@/types/admin';
import type { HistoryType } from '@/types/chat';
import { showErrorToast, type CancelTokenSource } from '@/utils';
import { formatRelativeTime } from '@/utils/date';

import Filters, { DEFAULT_CONVERSATION_FILTERS, type ConversationFiltersValue } from '../filters';

import './conversations.scss';

interface StateType {
    loading: boolean;
    error: boolean;
    histories: HistoryType[];
    page: number;
    count: number;
    total_count: number;
    total_pages: number;
}

const DEFAULT_STATE: StateType = {
    loading: true,
    error: false,
    histories: [],
    page: 0,
    count: 0,
    total_count: 0,
    total_pages: 0,
};

interface Props {
    agent: AgentType;
}

const Conversations = (props: Props) => {
    const { agent } = props;
    const params = useParams();

    const [state, setState] = useState<StateType>(DEFAULT_STATE);
    const [search, setSearch] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [filters, setFilters] = useState<ConversationFiltersValue>(DEFAULT_CONVERSATION_FILTERS);
    const [page, setPage] = useState(0);
    const [showMoreLoading, setShowMoreLoading] = useState(false);
    const [isDeletePending, setIsDeletePending] = useState(false);
    const cancelTokenRef = useRef<CancelTokenSource | null>(null);
    const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState<HistoryType | null>(null);

    const { loadMoreRef } = useInfiniteScroll({
        loading: state.loading,
        showMoreLoading,
        hasMore: state.total_count > state.histories.length,
        itemsLength: state.histories.length,
        onLoadMore: () => {
            setShowMoreLoading(true);
            fetchConversations(page + 1, search, filters);
            setPage((p) => p + 1);
        },
    });

    useEffect(() => {
        fetchConversations(0, '', DEFAULT_CONVERSATION_FILTERS);
    }, []);

    const onConfirmClick = async () => {
        try {
            setIsDeletePending(true);
            await appConversationApi.deleteConversation(isConfirmationModalOpen!._id, { agentId: agent._id });

            const newHistories = state.histories.filter(
                (history) => isConfirmationModalOpen && history._id != isConfirmationModalOpen._id,
            );

            setState((prevState) => ({
                ...prevState,
                histories: newHistories,
                total_count: prevState.total_count - 1,
            }));
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

    const fetchConversations = async (pageNo: number, query: string, appliedFilters: ConversationFiltersValue) => {
        if (cancelTokenRef.current) {
            cancelTokenRef.current.cancel('Request canceled due to new search');
        }
        cancelTokenRef.current = axios.CancelToken.source();
        const userIds = appliedFilters.users.map((user) => user.value) as string[];

        try {
            const result = await appConversationApi.listConversationsNew<HistoryType>(
                agent._id,
                {
                    search: query,
                    page: pageNo,
                    size: 20,
                    sort: [appliedFilters.sortBy.value],
                    userIds: userIds.length > 0 ? userIds : undefined,
                    createdStartDate: appliedFilters.createdRange.from || undefined,
                    createdEndDate: appliedFilters.createdRange.to || undefined,
                    updatedStartDate: appliedFilters.updatedRange.from || undefined,
                    updatedEndDate: appliedFilters.updatedRange.to || undefined,
                },
                {
                    cancelToken: cancelTokenRef.current.token,
                },
            );

            setState((prevState) => ({
                ...prevState,
                loading: false,
                error: false,
                histories: [...prevState.histories, ...result.values],
                page: result.pageInfo.page,
                count: result.values.length,
                total_count: result.pageInfo.totalCount,
                total_pages: result.pageInfo.totalPages,
            }));
            setShowMoreLoading(false);
        } catch (err) {
            if (axios.isCancel(err)) {
                return;
            }
            console.error(err);
            setState((prev) => ({
                ...prev,
                loading: false,
                error: true,
                histories: [],
            }));
        }
    };

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
                        onClick={() => {
                            setPage(0);
                            setState((prev) => ({
                                ...prev,
                                ...DEFAULT_STATE,
                                loading: true,
                            }));
                            fetchConversations(0, search, filters);
                        }}
                    >
                        <RefreshCwIcon />
                        Retry
                    </Button>
                </li>
            );
        }

        return (
            <>
                {state.histories.map((history) => (
                    <li
                        className={cn(
                            'history-list-item conversation-list-item cursor-pointer px-4 py-2',
                            'border-b border-border-secondary hover:bg-muted',
                            params['*'] === `${history._id}` && 'active bg-muted',
                        )}
                        key={history._id}
                    >
                        <Link
                            to={`/admin/agents/${agent.slug}/conversations/${history._id}`}
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
                                        <span className="text-sm text-(--text-primary)">{history.title}</span>
                                    </ExpandableText>
                                    <Button
                                        variant="destructive"
                                        size="icon-xs"
                                        className="delete-button conversation-delete-button rounded-full opacity-0 max-lg:opacity-100"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            setIsConfirmationModalOpen(history);
                                        }}
                                    >
                                        <TrashIcon />
                                    </Button>
                                </div>
                                <div className="name-date flex items-center justify-between gap-2">
                                    <span className="text-xs font-medium text-text-secondary">
                                        {history.user?.name
                                            ? `${history.user.name.first} ${history.user.name.last}`
                                            : 'Unknown User'}
                                    </span>
                                    <span className="shrink-0 text-xs font-medium text-text-secondary">
                                        {formatRelativeTime(history.updated_at)}
                                    </span>
                                </div>
                            </div>
                        </Link>
                    </li>
                ))}
                <li>
                    <InfiniteScrollTrigger
                        isLoading={showMoreLoading}
                        hasMore={state.total_count > state.histories.length}
                        loadMoreRef={loadMoreRef}
                    />
                </li>
            </>
        );
    };

    const renderFilter = () => {
        return (
            <Filters
                isOpen={isOpen}
                value={filters}
                onClose={() => {
                    setIsOpen(false);
                }}
                onApply={(appliedFilters) => {
                    setFilters(appliedFilters);
                    setPage(0);
                    setState((prev) => ({
                        ...prev,
                        ...DEFAULT_STATE,
                        loading: true,
                    }));
                    fetchConversations(0, search, appliedFilters);
                    setIsOpen(false);
                }}
            />
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
            <ul
                className={cn(
                    'history-list conversation-list flex min-h-full flex-col',
                    isOpen && 'h-full overflow-hidden',
                )}
            >
                <div className="search-block sticky top-0 z-1 flex items-center gap-3 border-b border-border-secondary px-4 py-2">
                    <Button
                        variant="secondary"
                        size="icon-sm"
                        aria-label="Filter conversations"
                        onClick={() => {
                            setIsOpen(true);
                        }}
                    >
                        <FunnelIcon />
                    </Button>
                    <SearchInput
                        searchOnChange
                        placeholder="Search"
                        search={search}
                        onChange={(value) => {
                            setSearch(value);
                            setPage(0);
                            setState((prev) => ({
                                ...prev,
                                ...DEFAULT_STATE,
                                loading: true,
                            }));
                            fetchConversations(0, value, filters);
                        }}
                    />
                </div>
                {renderList()}
            </ul>
            {renderFilter()}
            {renderConfirmationModal()}
        </>
    );
};

export default Conversations;
