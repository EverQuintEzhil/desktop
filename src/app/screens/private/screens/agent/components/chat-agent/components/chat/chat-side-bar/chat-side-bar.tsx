import { useQueryClient } from '@tanstack/react-query';
import type { KeyboardEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { markConversationUnread, useInfiniteScroll, useUnreadConversations } from '@/app/hooks';
import { useCanSeeRoutines } from '@/app/screens/private/screens/routines/routines-visibility';
import { AvatarMenu } from '@/components';
import { useAgentComposerContext } from '@/components/agent-chat/context/agent-composer-context';
import { useChatShell } from '@/components/agent-chat/context/chat-shell-context';
import useConversationHistory from '@/components/agent-chat/hooks/use-conversation-history';
import { useConversationStatusPoll } from '@/components/agent-chat/hooks/use-conversation-status-poll';
import { usePinnedProjects } from '@/components/agent-chat/hooks/use-projects';
import { useUnpinnedProjects } from '@/components/agent-chat/hooks/use-unpinned-projects';
import { useAllRoutineRunsQuery } from '@/lib/api/app/routines';
import { cn } from '@/lib/utils';
import { selectTenant, selectUser } from '@/store/selectors';
import type { ChatAgentType } from '@/types/admin';
import type { HistoryType } from '@/types/chat';
import type { ProjectType } from '@/types/project';
import {
    safeJsonParse,
    safeLocalStorageGetItem,
    safeLocalStorageSetItem,
    showErrorToast,
    showSuccessToast,
} from '@/utils';

import { moveConversationToSpace } from '../../../hooks/use-conversation-space-move';

import ChatSidebarResizeHandle from './components/chat-sidebar-resize-handle';
import SidebarDialogs from './components/sidebar-dialogs';
import SidebarHeader from './components/sidebar-header';
import SidebarHistoryList from './components/sidebar-history-list';
import SidebarNavList from './components/sidebar-nav-list';
import { ROUTINES_EXPANDED_STORAGE_KEY, SPACES_EXPANDED_STORAGE_KEY } from './constants';
import { useChatSidebarWidth } from './hooks/use-chat-sidebar-width';
import { usePersistedExpansion } from './hooks/use-persisted-expansion';

interface Props {
    agent: ChatAgentType;
    isMobileOpen?: boolean;
    /** Held out of the status poll while this tab streams its turn — see the handler in chat-agent. */
    liveTurnConversationId?: string | null;
    onMobileClose?: () => void;
}

const SideBar = (props: Props) => {
    const { agent, isMobileOpen = false, liveTurnConversationId = null, onMobileClose } = props;
    const navigate = useNavigate();
    const { isPreview, onExit } = useChatShell();
    const params = useParams();
    const location = useLocation();
    const queryClient = useQueryClient();
    const activePath = params['*'] ?? '';
    const isLibraryActive = activePath.startsWith('library');
    const tenant = useSelector(selectTenant);
    const user = useSelector(selectUser);
    const { composer } = useAgentComposerContext();
    const [isCollapsed, setIsCollapsed] = useState(() => {
        const stored = safeLocalStorageGetItem('sidebarCollapsed');

        return safeJsonParse(stored, false);
    });
    const {
        histories,
        favoriteHistories,
        state,
        fetchConversations,
        fetchFavorites,
        deleteConversation,
        renameConversation,
        favoriteConversation,
        isDeleteSubmitting,
        isRenameSubmitting,
    } = useConversationHistory(agent);
    const areRoutinesEnabled = useCanSeeRoutines(agent.uiConfig);
    const { data: routineRunsData } = useAllRoutineRunsQuery(undefined, { enabled: areRoutinesEnabled });

    /**
     * A run's conversation belongs to its routine, not to the chat history — it appears under
     * Routines instead, so listing it twice would make a scheduled report look like a chat the
     * user started.
     */
    const visibleHistories = useMemo(() => {
        if (!areRoutinesEnabled) return histories;

        const runConversationIds = new Set(
            (routineRunsData?.values ?? []).map((run) => run.conversationId).filter(Boolean),
        );

        if (runConversationIds.size === 0) return histories;

        return histories.filter((history) => !runConversationIds.has(history._id));
    }, [histories, routineRunsData, areRoutinesEnabled]);

    const polledHistories = useMemo(
        () => [...visibleHistories, ...favoriteHistories],
        [visibleHistories, favoriteHistories],
    );
    const unreadConversationIds = useUnreadConversations(agent._id);
    const openConversationId = activePath.startsWith('chat/') ? activePath.slice('chat/'.length) : null;

    const handleConversationSettled = useCallback(
        (conversationId: string) => {
            // An answer the reader is already looking at is not news.
            if (conversationId === openConversationId) return;

            markConversationUnread(agent._id, conversationId);
        },
        [agent._id, openConversationId],
    );

    useConversationStatusPoll({
        agentId: agent._id,
        histories: polledHistories,
        skipConversationId: liveTurnConversationId,
        onSettled: handleConversationSettled,
    });

    const areSpacesEnabled = Boolean(agent.uiConfig.spaces?.enabled);
    const {
        pinnedProjects,
        hasNextPinnedProjectsPage,
        isFetchingNextPinnedProjectsPage,
        fetchNextPinnedProjects,
        pinnedActions: spaceActions,
    } = usePinnedProjects(agent._id, areSpacesEnabled);
    const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState<HistoryType | null>(null);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [shareProjectId, setShareProjectId] = useState<string | null>(null);
    const [editProjectId, setEditProjectId] = useState<string | null>(null);
    const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
    const [isSpaceDeleting, setIsSpaceDeleting] = useState(false);
    const [movingConversationIds, setMovingConversationIds] = useState<ReadonlySet<string>>(new Set());
    const {
        isExpanded: isSpacesExpanded,
        onToggleClick: handleSpacesToggleClick,
        onToggleKeyDown: handleSpacesToggleKeyDown,
    } = usePersistedExpansion(SPACES_EXPANDED_STORAGE_KEY);
    const {
        isExpanded: isRoutinesExpanded,
        onToggleClick: handleRoutinesToggleClick,
        onToggleKeyDown: handleRoutinesToggleKeyDown,
    } = usePersistedExpansion(ROUTINES_EXPANDED_STORAGE_KEY);
    const unpinnedSpaces = useUnpinnedProjects(agent._id, areSpacesEnabled && isSpacesExpanded);

    // Resolved from the live lists on every render, never held in state: the share modal
    // reads members straight from this project, so a snapshot would show the pre-mutation
    // member list after an add/remove.
    const findSpace = (projectId: string | null) => {
        if (!projectId) return null;

        return (
            pinnedProjects.find((project) => project._id === projectId) ??
            unpinnedSpaces.unpinnedProjects.find((project) => project._id === projectId) ??
            null
        );
    };

    const shareProject = findSpace(shareProjectId);
    const editProject = findSpace(editProjectId);
    const deleteProject = findSpace(deleteProjectId);

    const isSpaceOwner = (project: ProjectType) => project.creator?._id === user._id;
    const canEditSpace = (project: ProjectType) =>
        isSpaceOwner(project) ||
        project.members?.some((m) => m._id === user._id && (m.role === 'editor' || m.role === 'owner'));

    const onShowMore = useCallback(() => {
        if (state.pages - state.page > 1) {
            fetchConversations(state.page + 1);
        }
    }, [fetchConversations, state.page, state.pages]);

    const { loadMoreRef } = useInfiniteScroll({
        loading: state.loading,
        showMoreLoading: state.showMoreLoading,
        hasMore: state.pages - state.page > 1,
        itemsLength: visibleHistories.length,
        onLoadMore: onShowMore,
    });

    const toggleSidebar = () => {
        setIsCollapsed((prev: boolean) => {
            const newValue = !prev;

            safeLocalStorageSetItem('sidebarCollapsed', JSON.stringify(newValue));

            return newValue;
        });
    };

    const [selectedPopUpOpen, setSelectedPopUpOpen] = useState(-1);

    const onClosePopUp = () => {
        setSelectedPopUpOpen(-1);
    };

    const { asideRef, isResizing, handleProps, style: sidebarWidthStyle } = useChatSidebarWidth();

    useEffect(() => {
        const handleScroll = () => {
            if (selectedPopUpOpen !== -1) onClosePopUp();
        };

        const scrollingParent = asideRef.current;

        if (scrollingParent) {
            scrollingParent.addEventListener('scroll', handleScroll, { passive: true });
        }

        return () => {
            if (scrollingParent) {
                scrollingParent.removeEventListener('scroll', handleScroll);
            }
        };
    }, [selectedPopUpOpen, onClosePopUp]);

    useEffect(() => {
        if (!isMobileOpen) return undefined;

        document.body.classList.add('sidebar-mobile-open');

        return () => document.body.classList.remove('sidebar-mobile-open');
    }, [isMobileOpen]);

    const onConfirmClick = async () => {
        try {
            await deleteConversation(isConfirmationModalOpen!._id, () => {
                setIsConfirmationModalOpen(null);
            });
            if (agent.slug) {
                if (agent.uiConfig?.home?.startPage === 'library') {
                    navigate(`/agent/${agent.slug}/library`);
                } else {
                    if (activePath.includes(`chat/${isConfirmationModalOpen!._id}`)) {
                        navigate(`/agent/${agent.slug}`);
                    }
                }
            }
        } catch (error) {
            console.error(error);
        }
    };

    const onToggleFavorite = async (history: HistoryType) => {
        try {
            await favoriteConversation(history._id);
        } catch (error) {
            console.error(error);
        }
    };

    const setConversationMoving = (conversationId: string, isMoving: boolean) => {
        setMovingConversationIds((current) => {
            const next = new Set(current);

            if (isMoving) next.add(conversationId);
            else next.delete(conversationId);

            return next;
        });
    };

    const handleAddToProject = async (history: HistoryType, projectId: string | null) => {
        setConversationMoving(history._id, true);
        try {
            await moveConversationToSpace(queryClient, {
                agentId: agent._id,
                conversationId: history._id,
                nextProjectId: projectId,
            });
        } finally {
            setConversationMoving(history._id, false);
        }
    };

    const startRenaming = (history: HistoryType) => {
        setRenamingId(history._id);
        setRenameValue(history.title);
    };

    const cancelRenaming = () => {
        setRenamingId(null);
        setRenameValue('');
    };

    const submitRename = async (historyId: string) => {
        const trimmed = renameValue.trim();

        if (!trimmed) {
            cancelRenaming();

            return;
        }
        try {
            await renameConversation(historyId, trimmed, () => {
                setRenamingId(null);
                setRenameValue('');
            });
        } catch (error) {
            console.error(error);
        }
    };

    const handleUnpinSpace = async (project: ProjectType) => {
        try {
            await spaceActions.unpinProject(project._id);
            showSuccessToast('Space unpinned');
        } catch {
            showErrorToast('Failed to unpin space');
        }
    };

    const handlePinSpace = async (project: ProjectType) => {
        try {
            await unpinnedSpaces.pinProject(project._id);
            showSuccessToast('Space pinned');
        } catch {
            showErrorToast('Failed to pin space');
        }
    };

    const confirmSpaceDelete = async () => {
        if (!deleteProject) return;

        setIsSpaceDeleting(true);
        try {
            await spaceActions.deleteProject(deleteProject._id);
            if (activePath.includes(`spaces/${deleteProject._id}`)) {
                navigate(`/agent/${agent.slug}/spaces`);
            }
            setDeleteProjectId(null);
        } catch {
            showErrorToast('Failed to delete space');
        } finally {
            setIsSpaceDeleting(false);
        }
    };

    const handleHistoryClick = () => {
        onMobileClose?.();

        if (composer.isIncognitoMode) {
            composer.toggleIncognitoMode();
        }
    };

    const handleIncognitoKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key !== 'Enter' && e.key !== ' ') {
            return;
        }

        // The toggle sits inside a Link, so an unhandled Space would scroll the page.
        e.preventDefault();
        composer.toggleIncognitoMode();
    };

    const handleBrandBack = () => {
        onMobileClose?.();

        if (isPreview) {
            onExit?.();

            return;
        }

        navigate('/');
    };

    return (
        <>
            <aside
                className={cn(
                    'aside chat-sidebar scrollbar-primary scrollbar-vertical flex scrollbar-gutter-stable flex-col',
                    isMobileOpen && 'open',
                    isResizing && 'resizing',
                    isCollapsed ? 'collapsed' : 'scrollbar-controller',
                )}
                style={sidebarWidthStyle}
                ref={asideRef}
            >
                <SidebarHeader
                    tenant={tenant}
                    isPreview={isPreview}
                    isCollapsed={isCollapsed}
                    onMobileClose={onMobileClose}
                    onBrandBack={handleBrandBack}
                    onToggleSidebar={toggleSidebar}
                />
                <div className="aside-body flex flex-col">
                    <SidebarNavList
                        agent={agent}
                        activePath={activePath}
                        showHomeState={Boolean(location.state?.showHome)}
                        isLibraryActive={isLibraryActive}
                        isCollapsed={isCollapsed}
                        composer={composer}
                        spaces={{
                            isExpanded: isSpacesExpanded,
                            onToggleClick: handleSpacesToggleClick,
                            onToggleKeyDown: handleSpacesToggleKeyDown,
                            list: {
                                spaces: unpinnedSpaces,
                                isOwner: isSpaceOwner,
                                canEdit: canEditSpace,
                                onMobileClose,
                                onTogglePin: handlePinSpace,
                                onEdit: (target) => setEditProjectId(target._id),
                                onDelete: (target) => setDeleteProjectId(target._id),
                                onShare: (target) => setShareProjectId(target._id),
                            },
                        }}
                        routines={{
                            isExpanded: isRoutinesExpanded,
                            onToggleClick: handleRoutinesToggleClick,
                            onToggleKeyDown: handleRoutinesToggleKeyDown,
                        }}
                        onMobileClose={onMobileClose}
                        onIncognitoKeyDown={handleIncognitoKeyDown}
                    />
                    <div className="chat-sidebar-nav-list nav-list flex flex-col px-2">
                        <SidebarHistoryList
                            agent={agent}
                            activePath={activePath}
                            state={state}
                            histories={visibleHistories}
                            favoriteHistories={favoriteHistories}
                            pinnedProjects={pinnedProjects}
                            hasNextPinnedProjectsPage={hasNextPinnedProjectsPage}
                            isFetchingNextPinnedProjectsPage={isFetchingNextPinnedProjectsPage}
                            fetchNextPinnedProjects={fetchNextPinnedProjects}
                            fetchFavorites={fetchFavorites}
                            loadMoreRef={loadMoreRef}
                            movingConversationIds={movingConversationIds}
                            unreadConversationIds={unreadConversationIds}
                            renamingId={renamingId}
                            renameValue={renameValue}
                            isRenameSubmitting={isRenameSubmitting}
                            isSpaceOwner={isSpaceOwner}
                            canEditSpace={canEditSpace}
                            onMobileClose={onMobileClose}
                            onUnpinSpace={handleUnpinSpace}
                            onEditSpace={(target) => setEditProjectId(target._id)}
                            onDeleteSpace={(target) => setDeleteProjectId(target._id)}
                            onShareSpace={(target) => setShareProjectId(target._id)}
                            onRenameValueChange={setRenameValue}
                            onStartRename={startRenaming}
                            onCancelRename={cancelRenaming}
                            onSubmitRename={submitRename}
                            onToggleFavorite={onToggleFavorite}
                            onAddToProject={handleAddToProject}
                            onDeleteHistory={setIsConfirmationModalOpen}
                            onHistoryClick={handleHistoryClick}
                        />
                    </div>
                </div>
                <div className="aside-footer mt-auto flex items-center">
                    <div className="avatar-menu-wrapper flex-1">
                        <AvatarMenu showName />
                    </div>
                </div>

                <SidebarDialogs
                    agent={agent}
                    user={user}
                    activePath={activePath}
                    spaceActions={spaceActions}
                    isConfirmationModalOpen={isConfirmationModalOpen}
                    onCloseConfirmModal={() => setIsConfirmationModalOpen(null)}
                    onConfirmDeleteHistory={onConfirmClick}
                    isDeleteSubmitting={isDeleteSubmitting}
                    editProject={editProject}
                    onCloseEditSpace={() => setEditProjectId(null)}
                    deleteProject={deleteProject}
                    onCloseDeleteSpace={() => setDeleteProjectId(null)}
                    onConfirmDeleteSpace={confirmSpaceDelete}
                    isSpaceDeleting={isSpaceDeleting}
                    shareProject={shareProject}
                    onCloseShareSpace={() => setShareProjectId(null)}
                    onNavigateToSpaces={() => navigate(`/agent/${agent.slug}/spaces`)}
                />
            </aside>
            {!isCollapsed && <ChatSidebarResizeHandle {...handleProps} />}
        </>
    );
};

export default SideBar;
