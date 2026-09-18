import { ExternalLinkIcon, MessageSquareIcon, QuoteIcon, SparklesIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

import { CopyLinkButton } from '@/components/copy-button';
import { fileIconFor } from '@/components/file-list';
import InfiniteScrollTrigger from '@/components/infinite-scroll-trigger';
import Spinner from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import type { ChatAgentType } from '@/types/admin';
import type { ProjectActivityType } from '@/types/project';

import { ACTIVITY_EMPTY_STATE_ITEMS } from '../constants';
import { describeActivity } from '../utils/describe-activity';
import { formatShortDate } from '../utils/format-short-date';

import ActivityAvatar from './activity-avatar';
import EmptyStateCard from './empty-state-card';
import ListSkeleton from './list-skeleton';

export interface Props {
    agent: ChatAgentType;
    activities: ProjectActivityType[];
    isLoading: boolean;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    loadMoreRef: React.Ref<HTMLDivElement | null>;
}

const renderFileActivity = (fileName: string) => {
    const Icon = fileIconFor(fileName.split('.').pop()?.toLowerCase() || '');

    return (
        <div
            className={cn(
                'ml-11 flex w-fit max-w-[calc(100%-2.75rem)] items-center rounded-lg',
                'border border-border-secondary bg-background py-0.5 pr-3',
            )}
        >
            <span className="flex size-8 shrink-0 items-center justify-center text-text-secondary">
                <Icon className="size-4" />
            </span>
            <span className="truncate text-sm">{fileName}</span>
        </div>
    );
};

const renderChatActivity = (agent: ChatAgentType, chatTitle: string, chatPreview: string, chatId: string) => (
    <div className="ml-11 flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
        {chatPreview ? (
            <div className="flex gap-2.5">
                <QuoteIcon className="size-4 shrink-0 text-primary/60" />
                <p className="line-clamp-3 min-w-0 text-sm leading-relaxed text-foreground">{chatPreview}</p>
            </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-primary">
                <MessageSquareIcon className="size-4 shrink-0" />
                <span className="truncate">{chatTitle}</span>
            </span>
            {chatId ? (
                <div className="flex shrink-0 items-center gap-2">
                    <CopyLinkButton url={`${window.location.origin}/agent/${agent.slug}/chat/${chatId}`} />
                    <Link
                        to={`/agent/${agent.slug}/chat/${chatId}`}
                        className={cn(
                            'flex shrink-0 items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5',
                            'text-sm font-medium text-primary no-underline',
                            'transition-colors hover:bg-primary/15',
                            'outline-none focus-visible:ring-2 focus-visible:ring-(--color-focus-ring) focus-visible:ring-offset-2',
                        )}
                    >
                        <ExternalLinkIcon className="size-3.5" />
                        Open shared chat
                    </Link>
                </div>
            ) : null}
        </div>
    </div>
);

const ActivityList = ({ agent, activities, isLoading, hasNextPage, isFetchingNextPage, loadMoreRef }: Props) => {
    if (isLoading && activities.length === 0) {
        return <ListSkeleton />;
    }

    if (activities.length === 0) {
        return (
            <EmptyStateCard
                title="No activity yet"
                description="Member updates, shared chats, and knowledge changes will appear here as this space grows."
                Icon={SparklesIcon}
                supportItems={ACTIVITY_EMPTY_STATE_ITEMS}
            />
        );
    }

    return (
        <ul className="flex flex-col overflow-hidden rounded-2xl border border-border-secondary bg-card px-4">
            {activities.map((activity) => {
                const fileName = typeof activity.data?.name === 'string' ? activity.data.name : '';
                const chatTitle = typeof activity.data?.title === 'string' ? activity.data.title : '';
                const chatId = typeof activity.data?.conversationId === 'string' ? activity.data.conversationId : '';
                const chatPreviewRaw = [
                    activity.data?.preview,
                    activity.data?.messagePreview,
                    activity.data?.snippet,
                    activity.data?.lastMessage,
                    activity.data?.content,
                ].find((value) => typeof value === 'string' && value.trim().length > 0);
                const chatPreview = typeof chatPreviewRaw === 'string' ? chatPreviewRaw.trim() : '';
                const isFileActivity = activity.type === 'file_added' || activity.type === 'file_removed';
                const isChatActivity = activity.type === 'conversation_shared';

                return (
                    <li
                        key={activity._id}
                        className="flex flex-col gap-3 border-t border-border-secondary py-4 first:border-t-0"
                    >
                        <div className="flex items-start gap-3">
                            <ActivityAvatar label={activity.actorName} />
                            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <span className="text-sm text-foreground">
                                    <span className="font-semibold">{activity.actorName}</span>{' '}
                                    {describeActivity(activity)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {formatShortDate(activity.createdAt)}
                                </span>
                            </span>
                        </div>
                        {isFileActivity && fileName ? renderFileActivity(fileName) : null}
                        {isChatActivity && chatTitle ? renderChatActivity(agent, chatTitle, chatPreview, chatId) : null}
                    </li>
                );
            })}
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

export default ActivityList;
