import axios from 'axios';
import { FunnelIcon, RefreshCwIcon, TrashIcon, TriangleAlertIcon } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ExpandableText, InfiniteScrollTrigger, SearchInput } from '@/components';
import { type SelectSuggestionItem } from '@/components';
import { Button } from '@/components/ui/button';
import ConfirmationModal from '@/components/ui/confirmation-modal';
import { Skeleton } from '@/components/ui/skeleton';
import { useInfiniteScroll } from '@/hooks';
import { appMediaApi } from '@/lib/api/app/media';
import { cn } from '@/lib/utils';
import type { AgentType } from '@/types/admin';
import type { GeneratedItem } from '@/types/gallery';
import { type CancelTokenSource } from '@/utils';
import { formatRelativeTime } from '@/utils/date';

import Filters from '../filters';

import './histories.scss';

interface StateType {
    loading: boolean;
    error: boolean;
    files: GeneratedItem[];
    page: number;
    totalCount: number;
    totalPages: number;
}

const DEFAULT_STATE: StateType = {
    loading: true,
    error: false,
    files: [],
    page: 0,
    totalCount: 0,
    totalPages: 0,
};

interface Props {
    agent: AgentType;
}

const Histories = (props: Props) => {
    const { agent } = props;

    const params = useParams();
    const selectedId = params['*'];

    const [state, setState] = useState<StateType>(DEFAULT_STATE);
    const [search, setSearch] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [sortBy, setSortBy] = useState<SelectSuggestionItem<string>>({
        label: 'Updated At(Desc)',
        value: 'updated_at:desc',
    });
    const [creatorId, setCreatorId] = useState<string | null>(null);
    const [showMoreLoading, setShowMoreLoading] = useState(false);
    const cancelTokenRef = useRef<CancelTokenSource | null>(null);

    const [isDeleteSubmitting, setIsDeleteSubmitting] = useState(false);
    const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState<GeneratedItem | null>(null);

    const hasMore = state.totalCount > state.files.length && state.page + 1 < state.totalPages;

    const { loadMoreRef } = useInfiniteScroll({
        loading: state.loading,
        showMoreLoading,
        hasMore,
        itemsLength: state.files.length,
        onLoadMore: () => {
            if (!hasMore) return;

            setShowMoreLoading(true);
            fetchFiles(state.page + 1, search, sortBy.value as string, creatorId);
        },
    });

    const onConfirmClick = async () => {
        setIsDeleteSubmitting(true);
        try {
            await appMediaApi.deleteFile(isConfirmationModalOpen!._id);

            setState((prevState) => ({
                ...prevState,
                files: prevState.files.filter((f) => f._id !== isConfirmationModalOpen!._id),
                totalCount: prevState.totalCount - 1,
            }));
            setIsConfirmationModalOpen(null);
        } catch (error) {
            console.error(error);
        } finally {
            setIsDeleteSubmitting(false);
        }
    };

    const closeConfirmModal = () => {
        setIsConfirmationModalOpen(null);
    };

    useEffect(() => {
        fetchFiles(0, '', sortBy.value as string, creatorId);
    }, []);

    const fetchFiles = async (pageNo: number, query: string, sort: string, creator: string | null) => {
        if (cancelTokenRef.current) {
            cancelTokenRef.current.cancel('Request canceled due to new search');
        }
        cancelTokenRef.current = axios.CancelToken.source();
        try {
            const result = await appMediaApi.listFiles<GeneratedItem>(
                {
                    agentId: agent._id,
                    search: query || undefined,
                    sortBy: sort,
                    page: pageNo,
                    size: 20,
                    creatorId: creator || undefined,
                    all: 'true',
                },
                { cancelToken: cancelTokenRef.current.token },
            );

            setState((prevState) => ({
                ...prevState,
                loading: false,
                error: false,
                files: pageNo === 0 ? result.values : [...prevState.files, ...result.values],
                page: result.pageInfo.page,
                totalCount: result.pageInfo.totalCount,
                totalPages: result.pageInfo.totalPages,
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
                files: [],
            }));
        }
    };

    const renderList = () => {
        if (state.loading) {
            return (
                <>
                    <li className="history-list-item">
                        <Skeleton className="h-[18px] w-full rounded-md" />
                    </li>
                    <li className="history-list-item">
                        <Skeleton className="h-[18px] w-full rounded-md" />
                    </li>
                    <li className="history-list-item">
                        <Skeleton className="h-[18px] w-full rounded-md" />
                    </li>
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
                        <p className="text-xs text-muted-foreground">Couldn&apos;t load history. Please try again.</p>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() => {
                            setState((prev) => ({
                                ...prev,
                                ...DEFAULT_STATE,
                                loading: true,
                            }));
                            fetchFiles(0, search, sortBy.value as string, creatorId);
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
                {state.files.map((file) => (
                    <li
                        className={cn(
                            'history-list-item conversation-list-item cursor-pointer px-4 py-2',
                            'border-b border-border-secondary hover:bg-muted',
                            selectedId === file._id && 'active bg-muted',
                        )}
                        key={file._id}
                    >
                        <Link
                            to={`/admin/agents/${agent.slug}/history/${file._id}`}
                            className="flex text-(--text-primary)"
                        >
                            <div className="histories-subject flex w-full flex-col">
                                <div className="flex w-full items-center justify-between">
                                    <ExpandableText
                                        maxLines={2}
                                        showMoreText="Read more"
                                        showLessText="Read less"
                                        textClassName="text-sm text-(--text-primary)"
                                    >
                                        <span className="text-sm text-(--text-primary)">{file.title ?? file._id}</span>
                                    </ExpandableText>
                                    <Button
                                        variant="destructive"
                                        size="icon-xs"
                                        className="delete-button conversation-delete-button rounded-full opacity-0 max-lg:opacity-100"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            setIsConfirmationModalOpen(file);
                                        }}
                                    >
                                        <TrashIcon />
                                    </Button>
                                </div>
                                <div className="name-date flex items-center justify-between gap-2">
                                    <span className="text-xs text-text-secondary">{file.creator_name ?? ''}</span>
                                    {file.created_at && (
                                        <span className="text-xs text-text-secondary">
                                            {formatRelativeTime(file.created_at)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </Link>
                    </li>
                ))}
                <li>
                    <InfiniteScrollTrigger
                        isLoading={showMoreLoading}
                        hasMore={state.totalCount > state.files.length}
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
                onClose={() => {
                    setIsOpen(false);
                }}
                onApply={(sortByArg, creatorIdArg) => {
                    setSortBy(sortByArg);
                    setCreatorId(creatorIdArg);
                    setState((prev) => ({
                        ...prev,
                        ...DEFAULT_STATE,
                        loading: true,
                    }));
                    setShowMoreLoading(false);
                    fetchFiles(0, search, sortByArg.value as string, creatorIdArg);
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
                    isButtonLoading={isDeleteSubmitting}
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
            <ul className={cn('history-list conversation-list flex flex-col', isOpen && 'h-full overflow-hidden')}>
                <div className="search-block sticky top-0 z-1 flex items-center gap-3 border-b border-border-secondary bg-card px-4 py-2">
                    <Button
                        variant="ghost"
                        size="icon-sm"
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
                            setState((prev) => ({
                                ...prev,
                                ...DEFAULT_STATE,
                                loading: true,
                            }));
                            setShowMoreLoading(false);
                            fetchFiles(0, value, sortBy.value as string, creatorId);
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

export default Histories;
