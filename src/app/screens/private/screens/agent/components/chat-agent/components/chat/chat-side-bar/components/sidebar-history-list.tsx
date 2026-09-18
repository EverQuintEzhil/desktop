import { HistoryIcon, PinIcon } from 'lucide-react';
import type { Ref } from 'react';

import type { ConversationHistoryState } from '@/components/agent-chat/types';
import InfiniteScrollTrigger from '@/components/infinite-scroll-trigger';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import Spinner from '@/components/ui/spinner';
import type { ChatAgentType } from '@/types/admin';
import type { HistoryType } from '@/types/chat';
import type { ProjectType } from '@/types/project';

import { CHAT_SIDEBAR_ACCORDION_TRIGGER_CLASS } from '../constants';
import SpaceItem from '../space-item';

import HistoryListItem from './history-list-item';

interface Props {
    agent: ChatAgentType;
    activePath: string;
    state: ConversationHistoryState;
    histories: HistoryType[];
    favoriteHistories: HistoryType[];
    pinnedProjects: ProjectType[];
    hasNextPinnedProjectsPage: boolean;
    isFetchingNextPinnedProjectsPage: boolean;
    fetchNextPinnedProjects: () => void;
    fetchFavorites: () => void;
    loadMoreRef: Ref<HTMLDivElement | null>;
    movingConversationIds: ReadonlySet<string>;
    unreadConversationIds: ReadonlySet<string>;
    renamingId: string | null;
    renameValue: string;
    isRenameSubmitting: boolean;
    isSpaceOwner: (project: ProjectType) => boolean;
    canEditSpace: (project: ProjectType) => boolean;
    onMobileClose?: () => void;
    onUnpinSpace: (project: ProjectType) => void;
    onEditSpace: (project: ProjectType) => void;
    onDeleteSpace: (project: ProjectType) => void;
    onShareSpace: (project: ProjectType) => void;
    onRenameValueChange: (value: string) => void;
    onStartRename: (history: HistoryType) => void;
    onCancelRename: () => void;
    onSubmitRename: (historyId: string) => void;
    onToggleFavorite: (history: HistoryType) => void;
    onAddToProject: (history: HistoryType, projectId: string | null) => void;
    onDeleteHistory: (history: HistoryType) => void;
    onHistoryClick: () => void;
}

const SidebarHistoryList = (props: Props) => {
    const {
        agent,
        activePath,
        state,
        histories,
        favoriteHistories,
        pinnedProjects,
        hasNextPinnedProjectsPage,
        isFetchingNextPinnedProjectsPage,
        fetchNextPinnedProjects,
        fetchFavorites,
        loadMoreRef,
        movingConversationIds,
        unreadConversationIds,
        renamingId,
        renameValue,
        isRenameSubmitting,
        isSpaceOwner,
        canEditSpace,
        onMobileClose,
        onUnpinSpace,
        onEditSpace,
        onDeleteSpace,
        onShareSpace,
        onRenameValueChange,
        onStartRename,
        onCancelRename,
        onSubmitRename,
        onToggleFavorite,
        onAddToProject,
        onDeleteHistory,
        onHistoryClick,
    } = props;

    const renderHistoryItem = (history: HistoryType, showIcon = false) => (
        <HistoryListItem
            key={history._id}
            history={history}
            agentId={agent._id}
            agentSlug={agent.slug}
            spacesEnabled={Boolean(agent.uiConfig.spaces?.enabled)}
            isActive={activePath === `chat/${history._id}`}
            isMoving={movingConversationIds.has(history._id)}
            isUnread={unreadConversationIds.has(history._id)}
            showIcon={showIcon}
            isRenaming={renamingId === history._id}
            renameValue={renameValue}
            isRenameSubmitting={isRenameSubmitting}
            onRenameValueChange={onRenameValueChange}
            onRenameSubmit={() => onSubmitRename(history._id)}
            onRenameCancel={onCancelRename}
            onStartRename={() => onStartRename(history)}
            onToggleFavorite={() => onToggleFavorite(history)}
            onAddToProject={(projectId) => onAddToProject(history, projectId)}
            onDelete={() => onDeleteHistory(history)}
            onHistoryClick={onHistoryClick}
        />
    );

    const renderPinnedProjectsShowMore = () => {
        if (!hasNextPinnedProjectsPage) {
            return null;
        }

        return (
            <li className="nav-list-item">
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-center text-sm text-(--sidebar-foreground) hover:bg-(--sidebar-primary) hover:text-(--sidebar-primary-foreground)"
                    disabled={isFetchingNextPinnedProjectsPage}
                    onClick={() => fetchNextPinnedProjects()}
                >
                    {isFetchingNextPinnedProjectsPage ? (
                        <Spinner className="text-sidebar-foreground" />
                    ) : (
                        'Show more spaces'
                    )}
                </Button>
            </li>
        );
    };

    const renderFavoritesShowMore = () => {
        if (state.favoritesPages - state.favoritesPage <= 1) {
            return null;
        }

        return (
            <li className="nav-list-item">
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-center text-sm text-(--sidebar-foreground) hover:bg-(--sidebar-primary) hover:text-(--sidebar-primary-foreground)"
                    disabled={state.favoritesShowMoreLoading}
                    onClick={() => fetchFavorites()}
                >
                    {state.favoritesShowMoreLoading ? <Spinner className="text-sidebar-foreground" /> : 'Show more'}
                </Button>
            </li>
        );
    };

    if (state.loading) {
        return (
            <div className="mt-1 flex flex-col gap-0.5">
                <div className="flex items-center gap-2 px-2 py-2">
                    <Skeleton className="size-4 rounded-md" />
                    <Skeleton className="h-4 w-24 rounded-md" />
                </div>
                <ul className="flex flex-col gap-0.5">
                    {['title', 'recent', 'older'].map((skeletonKey) => (
                        <li key={skeletonKey} className="nav-list-item">
                            <div className="px-2 py-1">
                                <Skeleton className="h-5 w-full rounded-md" />
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        );
    }
    if (state.error) {
        return (
            <div className="mt-4">
                <span className="text-sm">Error Occured</span>
            </div>
        );
    }

    const recentHistories = histories.filter((history) => !history.favorited);

    return (
        <Accordion
            type="multiple"
            defaultValue={['pinned', 'recents']}
            className="chat-sidebar-accordion flex flex-col"
        >
            {(pinnedProjects.length > 0 || favoriteHistories.length > 0) && (
                <AccordionItem value="pinned" className="flex flex-col gap-0.5 border-b-0">
                    <AccordionTrigger className={CHAT_SIDEBAR_ACCORDION_TRIGGER_CLASS}>
                        <span className="flex items-center gap-2">
                            <PinIcon className="size-4" />
                            Pinned
                        </span>
                    </AccordionTrigger>
                    <AccordionContent className="py-0">
                        <ul className="flex flex-col gap-0.5">
                            {pinnedProjects.map((project) => (
                                <SpaceItem
                                    key={project._id}
                                    project={project}
                                    agent={agent}
                                    isOwner={isSpaceOwner(project)}
                                    canEdit={canEditSpace(project)}
                                    onMobileClose={onMobileClose}
                                    onTogglePin={onUnpinSpace}
                                    onEdit={onEditSpace}
                                    onDelete={onDeleteSpace}
                                    onShare={onShareSpace}
                                />
                            ))}
                            {renderPinnedProjectsShowMore()}
                            {favoriteHistories.map((history) => renderHistoryItem(history, true))}
                            {renderFavoritesShowMore()}
                        </ul>
                    </AccordionContent>
                </AccordionItem>
            )}
            <AccordionItem value="recents" className="flex flex-col gap-0.5 border-b-0">
                <AccordionTrigger className={CHAT_SIDEBAR_ACCORDION_TRIGGER_CLASS}>
                    <span className="flex items-center gap-2">
                        <HistoryIcon className="size-4" />
                        Recents
                    </span>
                </AccordionTrigger>
                <AccordionContent className="py-0">
                    <ul className="flex flex-col gap-0.5">
                        {recentHistories.map((history) => renderHistoryItem(history))}
                        <InfiniteScrollTrigger
                            loadMoreRef={loadMoreRef}
                            isLoading={state.showMoreLoading}
                            hasMore={state.pages - state.page > 1}
                            renderLoader={() => (
                                <div className="flex items-center justify-center px-4 py-8">
                                    <Spinner className="text-sidebar-foreground" />
                                </div>
                            )}
                        />
                    </ul>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    );
};

export type { Props as SidebarHistoryListProps };
export default SidebarHistoryList;
