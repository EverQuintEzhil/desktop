import { MessageSquareIcon } from 'lucide-react';
import { useMemo } from 'react';

import { useCanSeeRoutines } from '@/app/screens/private/screens/routines/routines-visibility';
import InfiniteScrollTrigger from '@/components/infinite-scroll-trigger';
import Spinner from '@/components/ui/spinner';
import { useAllRoutineRunsQuery } from '@/lib/api/app/routines';
import type { ChatAgentType } from '@/types/admin';
import type { ProjectChatType } from '@/types/project';

import { CHAT_EMPTY_STATE_ITEMS } from '../../constants';
import ChatsSearchBar from '../chats-search-bar';
import ChatsSearchEmpty from '../chats-search-empty';
import EmptyStateCard from '../empty-state-card';
import ListSkeleton from '../list-skeleton';

import ChatRow, { type PendingPin, type PendingVisibility } from './chat-row';

export interface Props {
    agent: ChatAgentType;
    projectId?: string;
    chats: ProjectChatType[];
    search: string;
    onSearchChange: (next: string) => void;
    isLoading: boolean;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    loadMoreRef: React.Ref<HTMLDivElement | null>;
    pendingPin: PendingPin | null;
    pendingVisibility: PendingVisibility | null;
    openMenuChatId: string | null;
    changingChatSpaceId: string | null;
    onOpenMenuChange: (chatId: string, open: boolean) => void;
    onTogglePin: (chatId: string, currentFavorited: boolean, source: 'button' | 'menu') => void;
    onOpenRename: (chatId: string, title: string) => void;
    onToggleVisibility: (chatId: string, currentIsPublic: boolean) => void;
    onChangeSpace: (chatId: string, targetProjectId: string | null) => void;
    onRemove: (chatId: string) => void;
    onDelete: (chatId: string) => void;
}

const ChatsList = ({
    agent,
    projectId,
    chats,
    search,
    onSearchChange,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    loadMoreRef,
    pendingPin,
    pendingVisibility,
    openMenuChatId,
    changingChatSpaceId,
    onOpenMenuChange,
    onTogglePin,
    onOpenRename,
    onToggleVisibility,
    onChangeSpace,
    onRemove,
    onDelete,
}: Props) => {
    const areRoutinesVisible = useCanSeeRoutines(agent.uiConfig);
    // One feed for the whole list: a per-row lookup would be a request per chat. Capped at the feed's
    // default page — `/routines/runs` takes no `conversationId`, so an older run's chat is not flagged.
    const { data: runsData } = useAllRoutineRunsQuery(undefined, { enabled: areRoutinesVisible });
    const routineConversationIds = useMemo(
        () => new Set((runsData?.values ?? []).flatMap((run) => (run.conversationId ? [run.conversationId] : []))),
        [runsData],
    );

    const trimmedSearch = search.trim();
    // An empty space has nothing to search, so the box only earns its place once there are rows.
    // The active term keeps it mounted regardless — a search matching nothing must not remove the
    // input the user is still typing in.
    const showSearch = Boolean(trimmedSearch) || chats.length > 0;

    const renderEmpty = () => {
        if (trimmedSearch) {
            return <ChatsSearchEmpty search={trimmedSearch} subject="chats" />;
        }

        return (
            <EmptyStateCard
                title="No chats in this space yet"
                description="Start a conversation with the composer above. New chats stay organized here and remain private until you share them."
                Icon={MessageSquareIcon}
                supportItems={CHAT_EMPTY_STATE_ITEMS}
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
                    <ChatRow
                        key={chat._id}
                        agent={agent}
                        chat={chat}
                        projectId={projectId}
                        isRoutineRun={routineConversationIds.has(chat._id)}
                        pendingPin={pendingPin}
                        pendingVisibility={pendingVisibility}
                        openMenuChatId={openMenuChatId}
                        changingChatSpaceId={changingChatSpaceId}
                        onOpenMenuChange={onOpenMenuChange}
                        onTogglePin={onTogglePin}
                        onOpenRename={onOpenRename}
                        onToggleVisibility={onToggleVisibility}
                        onChangeSpace={onChangeSpace}
                        onRemove={onRemove}
                        onDelete={onDelete}
                    />
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
        <div className="chats-list flex w-full flex-col gap-4">
            {showSearch ? (
                <ChatsSearchBar
                    className="chats-list-search"
                    search={search}
                    onChange={onSearchChange}
                    placeholder="Search chats"
                />
            ) : null}
            {renderBody()}
        </div>
    );
};

export default ChatsList;
