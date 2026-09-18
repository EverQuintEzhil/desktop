import axios from 'axios';
import { PlusIcon, RefreshCwIcon, TrashIcon, TriangleAlertIcon } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { InfiniteScrollTrigger, SearchInput } from '@/components';
import { Button } from '@/components/ui/button';
import ConfirmationModal from '@/components/ui/confirmation-modal';
import { Skeleton } from '@/components/ui/skeleton';
import { useInfiniteScroll } from '@/hooks';
import { appConversationApi } from '@/lib/api/app/conversation';
import { cn } from '@/lib/utils';
import type { ChatAgentType } from '@/types/admin';
import { type HistoryType } from '@/types/chat';
import { showErrorToast, type CancelTokenSource } from '@/utils';
import { formatRelativeTime } from '@/utils/date';

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
    agent: ChatAgentType;
    newConversation: HistoryType | null;
    basePath?: string;
}

const Conversations = (props: Props) => {
    const { agent, newConversation, basePath } = props;
    const params = useParams();

    const [state, setState] = useState<StateType>(DEFAULT_STATE);
    const [search, setSearch] = useState('');
    const searchRef = useRef(search);

    searchRef.current = search;
    const navigate = useNavigate();
    const resolvedBasePath = basePath || `/admin/agents/${agent.slug}`;
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
            fetchConversations(page + 1, search);
            setPage((p) => p + 1);
        },
    });

    useEffect(() => {
        fetchConversations(0, '');
    }, []);

    useEffect(() => {
        if (!newConversation) return;
        setState((prev) => {
            const alreadyExists = prev.histories.some((h) => h._id === newConversation._id);

            if (alreadyExists) {
                return {
                    ...prev,
                    histories: prev.histories.map((history) =>
                        history._id === newConversation._id
                            ? { ...history, title: newConversation.title, updated_at: newConversation.updated_at }
                            : history,
                    ),
                };
            }

            // A filtered list holds only server-matched rows, so an unmatched
            // conversation would stay visible until the query changes.
            if (searchRef.current) return prev;

            return {
                ...prev,
                histories: [newConversation, ...prev.histories],
                total_count: prev.total_count + 1,
            };
        });
    }, [newConversation]);

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

    const fetchConversations = async (pageNo: number, query: string) => {
        if (cancelTokenRef.current) {
            cancelTokenRef.current.cancel('Request canceled due to new search');
        }
        cancelTokenRef.current = axios.CancelToken.source();
        try {
            const result = await appConversationApi.listConversations<HistoryType>(
                {
                    agentId: agent._id,
                    search: query,
                    page: pageNo,
                    size: 50,
                },
                {
                    cancelToken: cancelTokenRef.current.token,
                },
            );

            setState((prevState) => {
                const existingIds = new Set(prevState.histories.map((h) => h._id));
                const newHistories = result.values.filter((v) => !existingIds.has(v._id));

                return {
                    ...prevState,
                    loading: false,
                    error: false,
                    histories: [...prevState.histories, ...newHistories],
                    page: result.pageInfo.page,
                    count: result.values.length,
                    total_count: result.pageInfo.totalCount,
                    total_pages: result.pageInfo.totalPages,
                };
            });
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
                            fetchConversations(0, search);
                        }}
                    >
                        <RefreshCwIcon />
                        Retry
                    </Button>
                </li>
            );
        }
        const path = 'chat';

        return (
            <>
                {state.histories.map((history) => (
                    <li
                        className={cn(
                            'history-list-item conversation-list-item cursor-pointer px-4 py-2',
                            'border-b border-border-secondary hover:bg-muted',
                            params['*'] === `${path}/${history._id}` && 'active bg-muted',
                        )}
                        key={history._id}
                    >
                        <Link
                            to={`${resolvedBasePath}/playground/${path}/${history._id}`}
                            className="flex text-(--text-primary)"
                        >
                            <div className="conversations-subject flex w-full flex-col gap-1">
                                <div className="flex items-center justify-between">
                                    <span className="truncate text-sm text-(--text-primary)">{history.title}</span>
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
                                <div className="name-date flex items-center justify-end gap-2">
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
            <ul className="history-list conversation-list flex min-h-full flex-col">
                <div className="search-block sticky top-0 z-1 flex items-center gap-3 border-b border-border-secondary px-4 py-2">
                    <SearchInput
                        searchOnChange
                        placeholder="Search"
                        search={search}
                        inputClassName="shadow-none! focus:border-primary focus:ring-0!"
                        onChange={(value) => {
                            setSearch(value);
                            setPage(0);
                            setState((prev) => ({
                                ...prev,
                                ...DEFAULT_STATE,
                                loading: true,
                            }));
                            fetchConversations(0, value);
                        }}
                    />
                    <Button
                        size="sm"
                        className="shrink-0"
                        onClick={() => {
                            navigate(`${resolvedBasePath}/playground/new`);
                        }}
                    >
                        <PlusIcon />
                    </Button>
                </div>
                {renderList()}
            </ul>
            {renderConfirmationModal()}
        </>
    );
};

export default Conversations;
