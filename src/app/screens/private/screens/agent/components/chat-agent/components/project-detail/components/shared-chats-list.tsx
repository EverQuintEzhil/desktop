import { UsersIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

import InfiniteScrollTrigger from '@/components/infinite-scroll-trigger';
import Avatar from '@/components/ui/avatar';
import Spinner from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import type { ChatAgentType } from '@/types/admin';
import type { ProjectChatType } from '@/types/project';

import { ROW_HOVER_CLASS_NAME, SHARED_CHAT_EMPTY_STATE_ITEMS } from '../constants';
import { formatShortDate } from '../utils/format-short-date';

import ChatsSearchBar from './chats-search-bar';
import ChatsSearchEmpty from './chats-search-empty';
import EmptyStateCard from './empty-state-card';
import ListSkeleton from './list-skeleton';

export interface Props {
    agent: ChatAgentType;
    chats: ProjectChatType[];
    search: string;
    onSearchChange: (next: string) => void;
    isLoading: boolean;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    loadMoreRef: React.Ref<HTMLDivElement | null>;
}

const renderChatCreator = (chat: ProjectChatType) => {
    if (!chat.creator) return null;

    return (
        <>
            <Avatar
                size="sm"
                className="size-5 border-border-secondary"
                alt={chat.creator.name}
                src={chat.creator.avatar}
            />
            <span className="truncate font-medium text-foreground">{chat.creator.name}</span>
            <span aria-hidden>·</span>
        </>
    );
};

const SharedChatsList = ({
    agent,
    chats,
    search,
    onSearchChange,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    loadMoreRef,
}: Props) => {
    const trimmedSearch = search.trim();
    // See ChatsList: nothing to search until rows exist, but an active term always keeps the
    // input mounted so a zero-result search cannot pull it out from under the user.
    const showSearch = Boolean(trimmedSearch) || chats.length > 0;

    const renderEmpty = () => {
        if (trimmedSearch) {
            return <ChatsSearchEmpty search={trimmedSearch} subject="shared chats" />;
        }

        return (
            <EmptyStateCard
                title="No shared chats yet"
                description="Chats that other members share in this space will appear here so you can read along."
                Icon={UsersIcon}
                supportItems={SHARED_CHAT_EMPTY_STATE_ITEMS}
            />
        );
    };

    const renderBody = () => {
        // Covers a new search term too: its query starts empty, and without this the empty
        // state would flash before the results land.
        if (isLoading && chats.length === 0) {
            return <ListSkeleton />;
        }

        if (chats.length === 0) {
            return renderEmpty();
        }

        return (
            <ul className="flex flex-col overflow-hidden rounded-2xl border border-border-secondary bg-card">
                {chats.map((chat) => (
                    <li
                        key={chat._id}
                        className={cn(
                            'group flex items-center gap-3 border-t border-border-secondary px-4 py-3 first:border-t-0',
                            ROW_HOVER_CLASS_NAME,
                        )}
                    >
                        <Link
                            to={`/agent/${agent.slug}/chat/${chat._id}`}
                            className="flex min-w-0 flex-1 flex-col gap-1 text-foreground no-underline"
                        >
                            <span className="truncate text-sm font-medium text-foreground! transition-colors group-hover:text-primary!">
                                {chat.title}
                            </span>
                            <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                                {renderChatCreator(chat)}
                                <span className="shrink-0">Last message {formatShortDate(chat.updatedAt)}</span>
                            </span>
                        </Link>
                    </li>
                ))}
                <li className="list-none">
                    <InfiniteScrollTrigger
                        loadMoreRef={loadMoreRef}
                        isLoading={isFetchingNextPage}
                        hasMore={hasNextPage}
                        renderLoader={() => (
                            <div className="flex justify-center py-4">
                                <Spinner />
                            </div>
                        )}
                    />
                </li>
            </ul>
        );
    };

    return (
        <div className="shared-chats-list flex w-full flex-col gap-4">
            {showSearch ? (
                <ChatsSearchBar
                    className="shared-chats-list-search"
                    search={search}
                    onChange={onSearchChange}
                    placeholder="Search shared chats"
                />
            ) : null}
            {renderBody()}
        </div>
    );
};

export default SharedChatsList;
