import {
    BarChart3Icon,
    Clock3Icon,
    FrownIcon,
    HatGlassesIcon,
    MoreHorizontalIcon,
    PlusIcon,
    PinIcon,
    PinOffIcon,
    Trash2Icon,
    TrashIcon,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useInfiniteScroll, useStickyHeader } from '@/app/hooks';
import AgentTitlePrefix from '@/components/agent-chat/agent-title-prefix';
import { useAgentComposerContext } from '@/components/agent-chat/context/agent-composer-context';
import useConversationHistory from '@/components/agent-chat/hooks/use-conversation-history';
import DeleteConfirmationModal from '@/components/agent-chat/view/delete-confirmation-modal';
import InfiniteScrollTrigger from '@/components/infinite-scroll-trigger';
import SearchInput from '@/components/search-input';
import { Button } from '@/components/ui/button';
import ConfirmationModal from '@/components/ui/confirmation-modal';
import {
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRoot,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { ChatAgentType } from '@/types/admin';
import type { HistoryType } from '@/types/chat';
import { formatRelativeTime } from '@/utils/date';

import { TokenUsageDialog, useCanSeeUsage } from '../../../token-usage-dialog';
import { buildConversationUsage } from '../../../token-usage-dialog/conversation-usage';
import ExportConversationMenu from '../export-conversation-menu';

import './recents.scss';

interface Props {
    agent: ChatAgentType;
}

const Recents = (props: Props) => {
    const { agent } = props;
    const navigate = useNavigate();
    const params = useParams();
    const { composer } = useAgentComposerContext();
    const [searchQuery, setSearchQuery] = useState('');
    const {
        allHistories,
        state,
        fetchAllConversations,
        deleteConversation,
        clearAllConversations,
        favoriteConversation,
        isDeleteSubmitting,
    } = useConversationHistory(agent, { includeAll: true, search: searchQuery });

    const [selectedPopUpOpen, setSelectedPopUpOpen] = useState(-1);
    const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState<HistoryType | null>(null);
    const [usageDialogItem, setUsageDialogItem] = useState<HistoryType | null>(null);
    const [isClearAllSubmitting, setIsClearAllSubmitting] = useState<'permanent' | 'temporary' | ''>('');
    const [isClearAllConfirmationModalOpen, setIsClearAllConfirmationModalOpen] = useState<boolean>(false);
    const [isClearAllPermanentConfirmationModalOpen, setIsClearAllPermanentConfirmationModalOpen] =
        useState<boolean>(false);
    const listRef = useRef<HTMLUListElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    const isSticky = useStickyHeader(containerRef);
    const canSeeUsage = useCanSeeUsage(agent.uiConfig);

    const onConfirmClick = async () => {
        try {
            await deleteConversation(isConfirmationModalOpen!._id, () => {
                setIsConfirmationModalOpen(null);
            });
        } catch (error) {
            console.error(error);
        }
    };

    const closeConfirmModal = () => {
        setIsConfirmationModalOpen(null);
    };

    const onClearAllConfirmClick = async (force: boolean = false) => {
        setIsClearAllSubmitting(force ? 'permanent' : 'temporary');
        try {
            await clearAllConversations(force);
            setIsClearAllConfirmationModalOpen(false);
            setIsClearAllPermanentConfirmationModalOpen(false);
        } catch (error) {
            console.error(error);
        } finally {
            setIsClearAllSubmitting('');
        }
    };

    const closeClearAllConfirmModal = () => {
        setIsClearAllConfirmationModalOpen(false);
    };

    const closeClearAllPermanentConfirmModal = () => {
        setIsClearAllPermanentConfirmationModalOpen(false);
    };

    const onShowMore = useCallback(() => {
        if (state.allPages - state.allPage > 1) {
            fetchAllConversations(state.allPage + 1);
        }
    }, [fetchAllConversations, state.allPage, state.allPages]);

    const { loadMoreRef } = useInfiniteScroll({
        loading: state.allLoading,
        showMoreLoading: state.allShowMoreLoading,
        hasMore: state.allPages - state.allPage > 1,
        itemsLength: allHistories.length,
        onLoadMore: onShowMore,
    });

    const onClosePopUp = () => {
        setSelectedPopUpOpen(-1);
    };

    const onToggleFavorite = async (historyId: string) => {
        try {
            await favoriteConversation(historyId);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        const handleScroll = () => {
            if (selectedPopUpOpen !== -1) onClosePopUp();
        };

        const scrollingParent = listRef.current;

        if (scrollingParent) {
            scrollingParent.addEventListener('scroll', handleScroll, { passive: true });
        }

        return () => {
            if (scrollingParent) {
                scrollingParent.removeEventListener('scroll', handleScroll);
            }
        };
    }, [selectedPopUpOpen, onClosePopUp]);

    const renderUsageMenuItem = (history: HistoryType) => {
        if (!canSeeUsage || !buildConversationUsage(history.ai_info)) return null;

        return (
            <DropdownMenuItem
                className="cursor-pointer"
                onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setUsageDialogItem(history);
                }}
            >
                <BarChart3Icon className="size-3.5" />
                AI Usage Info
            </DropdownMenuItem>
        );
    };

    const renderUsageDialog = () => {
        const usage = buildConversationUsage(usageDialogItem?.ai_info);

        if (!canSeeUsage || !usageDialogItem || !usage) return null;

        return (
            <TokenUsageDialog
                open
                onOpenChange={(open) => {
                    if (!open) setUsageDialogItem(null);
                }}
                usage={usage}
                model={usageDialogItem.ai_info?.model}
            />
        );
    };

    const renderConfirmationModal = () => {
        return (
            <>
                <DeleteConfirmationModal
                    isOpen={Boolean(isConfirmationModalOpen)}
                    onClose={() => closeConfirmModal()}
                    onConfirm={() => onConfirmClick()}
                    isLoading={isDeleteSubmitting}
                />

                <ConfirmationModal
                    isOpen={isClearAllConfirmationModalOpen}
                    onClose={() => closeClearAllConfirmModal()}
                    title="Clear All Chats"
                    buttons={[
                        {
                            text: 'Cancel',
                            color: 'subtle',
                            onClick: () => closeClearAllConfirmModal(),
                        },
                        {
                            text: 'Permanently Delete',
                            icon: Trash2Icon,
                            color: 'danger',
                            onClick: () => {
                                closeClearAllConfirmModal();
                                setTimeout(() => {
                                    setIsClearAllPermanentConfirmationModalOpen(true);
                                }, 300);
                            },
                        },
                        {
                            text: 'Delete',
                            icon: Trash2Icon,
                            color: 'primary',
                            loading: isClearAllSubmitting === 'temporary',
                            onClick: () => onClearAllConfirmClick(false),
                        },
                    ]}
                >
                    <>
                        <div className="mx-auto flex flex-col items-center justify-center">
                            <span className="text-sm">
                                Are you sure you want to clear your entire chat history with this agent?
                            </span>
                        </div>
                        <div className="mt-4 flex flex-col items-start justify-start gap-1">
                            <span className="text-sm">
                                <span className="text-sm">Delete </span>
                                will move the chats to a recoverable state.
                            </span>
                            <span className="text-sm">
                                <span className="text-sm">Permanently Delete </span>
                                will erase them from the system.
                            </span>
                        </div>
                    </>
                </ConfirmationModal>

                <ConfirmationModal
                    isOpen={isClearAllPermanentConfirmationModalOpen}
                    onClose={() => closeClearAllPermanentConfirmModal()}
                    title="Clear All Chats Permanently?"
                    buttons={[
                        {
                            text: 'Cancel',
                            color: 'subtle',
                            onClick: () => closeClearAllPermanentConfirmModal(),
                        },
                        {
                            text: 'Yes, Delete Permanently',
                            icon: Trash2Icon,
                            color: 'danger',
                            loading: isClearAllSubmitting === 'permanent',
                            onClick: () => onClearAllConfirmClick(true),
                        },
                    ]}
                >
                    <div className="mx-auto flex flex-col items-center justify-center text-center">
                        <span className="text-sm">
                            This will <b>permanently</b> erase all chat history from the system and{' '}
                            <b>cannot be undone</b>. Continue?
                        </span>
                    </div>
                </ConfirmationModal>
            </>
        );
    };

    const renderList = () => {
        if (state.allLoading) {
            return (
                <>
                    <li className="recents-list-item rounded-lg p-4">
                        <div className="flex flex-col gap-2">
                            <Skeleton className="h-[18px] w-4/5 rounded-md" />
                            <Skeleton className="h-[18px] w-[200px] rounded-md" />
                        </div>
                    </li>
                    <li className="recents-list-item rounded-lg p-4">
                        <div className="flex flex-col gap-2">
                            <Skeleton className="h-[18px] w-4/5 rounded-md" />
                            <Skeleton className="h-[18px] w-[200px] rounded-md" />
                        </div>
                    </li>
                    <li className="recents-list-item rounded-lg p-4">
                        <div className="flex flex-col gap-2">
                            <Skeleton className="h-[18px] w-4/5 rounded-md" />
                            <Skeleton className="h-[18px] w-[200px] rounded-md" />
                        </div>
                    </li>
                </>
            );
        }
        if (state.allError) {
            return (
                <div className="flex items-center justify-center p-8">
                    <span className="text-sm">Error Occurred</span>
                </div>
            );
        }
        if (allHistories.length === 0) {
            return (
                <div className="mx-auto flex min-h-[calc(70svh-100px)] w-full max-w-[810px] flex-1 flex-col items-center justify-center gap-6 text-center">
                    <FrownIcon className="size-16 text-primary" />
                    <div className="flex w-full max-w-sm flex-col items-center justify-center gap-2">
                        <span className="leading-[20px] text-text-secondary">
                            {searchQuery.trim() ? 'No conversations found' : 'No conversations yet'}
                        </span>
                    </div>
                </div>
            );
        }
        const path = 'chat';

        return (
            <>
                {allHistories.map((history) => (
                    <li
                        className={`recents-list-item rounded-lg ${params['*'] === `${path}/${history._id}` ? 'active' : ''}`}
                        key={history._id}
                    >
                        <Link
                            to={`/agent/${agent.slug}/${path}/${history._id}`}
                            className="recents-list-item-link flex justify-between p-4 text-(--text-primary)"
                            title={history.title}
                        >
                            <div className="flex min-w-0 flex-col gap-2">
                                <div className="flex min-w-0 items-center gap-1.5">
                                    {history.favorited && (
                                        <PinIcon className="size-3.5 shrink-0 fill-current text-primary" />
                                    )}
                                    <span className="line-clamp-1 text-sm text-(--text-primary)">{history.title}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Clock3Icon className="size-4" />
                                    <span className="text-xs font-medium text-text-secondary">
                                        {formatRelativeTime(history.created_at, false)}
                                    </span>
                                </div>
                            </div>
                            <div className="recents-list-item-actions flex items-center gap-1">
                                <DropdownMenuRoot>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            className="popup delete-button rounded-full"
                                            size="icon-xs"
                                            variant="secondary"
                                            aria-label="Conversation actions"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                e.preventDefault();
                                            }}
                                        >
                                            <MoreHorizontalIcon />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" side="bottom">
                                        <DropdownMenuItem
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                e.preventDefault();
                                                onToggleFavorite(history._id);
                                            }}
                                            className="cursor-pointer"
                                        >
                                            {history.favorited ? (
                                                <PinOffIcon className="size-3.5" />
                                            ) : (
                                                <PinIcon className="size-3.5" />
                                            )}
                                            {history.favorited ? 'Unpin' : 'Pin'}
                                        </DropdownMenuItem>
                                        {renderUsageMenuItem(history)}
                                        <ExportConversationMenu
                                            agentId={agent._id}
                                            conversationId={history._id}
                                            title={history.title}
                                        />
                                        <DropdownMenuItem
                                            variant="destructive"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                e.preventDefault();
                                                setIsConfirmationModalOpen(history);
                                            }}
                                            className="cursor-pointer"
                                        >
                                            <TrashIcon className="size-3.5" />
                                            Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenuRoot>
                            </div>
                        </Link>
                    </li>
                ))}
                <InfiniteScrollTrigger
                    loadMoreRef={loadMoreRef}
                    isLoading={state.allShowMoreLoading}
                    hasMore={state.allPages - state.allPage > 1}
                />
            </>
        );
    };

    return (
        <div
            className="recents-container flex h-full w-full flex-col bg-background max-lg:pt-[50px]"
            ref={containerRef}
        >
            <div
                className={cn('recents-header top-0 z-1 mx-auto w-full bg-background pt-0 max-sm:gap-3 lg:py-4', {
                    sticky: isSticky,
                })}
            >
                <div className="inner-container mx-auto flex w-full max-w-[928px] flex-col gap-4 px-4">
                    <div className="flex w-full flex-wrap items-center justify-between gap-2">
                        <div className="recents-header-title flex min-w-0 items-center gap-1.5">
                            <AgentTitlePrefix agent={agent} />
                            <h2 className="shrink-0 text-xl font-bold">Search Chats</h2>
                        </div>
                        <div className="recents-header-actions flex flex-wrap items-center justify-end gap-2">
                            <Button
                                size="sm"
                                variant="destructive"
                                className="rounded-full"
                                disabled={allHistories.length === 0}
                                onClick={() => {
                                    setIsClearAllConfirmationModalOpen(true);
                                }}
                            >
                                <Trash2Icon />
                                Clear All
                            </Button>
                            <Button
                                size="sm"
                                className="rounded-full"
                                onClick={() => {
                                    if (agent.uiConfig?.home?.search?.isIncognitoEnabled && composer.isIncognitoMode) {
                                        composer.toggleIncognitoMode();
                                    }
                                    navigate(`/agent/${agent.slug}`);
                                }}
                            >
                                <PlusIcon />
                                New Chat
                            </Button>
                            {agent.uiConfig?.home?.search?.isIncognitoEnabled && (
                                <Button
                                    size="sm"
                                    className="rounded-full"
                                    variant="secondary"
                                    onClick={() => {
                                        if (!composer.isIncognitoMode) {
                                            composer.toggleIncognitoMode();
                                        }
                                        navigate(`/agent/${agent.slug}`);
                                    }}
                                >
                                    <HatGlassesIcon />
                                    New Temporary Chat
                                </Button>
                            )}
                        </div>
                    </div>
                    <SearchInput
                        search={searchQuery}
                        autoFocus
                        searchOnChange
                        onChange={(value) => {
                            setSearchQuery(value);
                        }}
                        placeholder="Search conversations..."
                        className="max-w-full"
                        inputClassName="rounded-3xl border-0 shadow-surface text-base h-[45px]"
                    />
                </div>
            </div>
            <div className="recents-list-block pt-2 pb-6">
                <ul
                    className="recents-list mx-auto flex w-full max-w-[928px] list-none flex-col gap-4 px-4"
                    ref={listRef}
                >
                    {renderList()}
                </ul>
            </div>
            {renderConfirmationModal()}
            {renderUsageDialog()}
        </div>
    );
};

export default Recents;
