import type { AxiosError } from 'axios';
import { ArrowLeftIcon, LockIcon, PaperclipIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { useInfiniteScroll } from '@/app/hooks';
import ProjectFiles from '@/app/screens/private/screens/agent/components/chat-agent/components/project-files/project-files';
import ProjectOriginFiles from '@/app/screens/private/screens/agent/components/chat-agent/components/project-origin-files/project-origin-files';
import { useCanSeeRoutines } from '@/app/screens/private/screens/routines/routines-visibility';
import { useAgentComposerContext } from '@/components/agent-chat/context/agent-composer-context';
import useConversationHistory from '@/components/agent-chat/hooks/use-conversation-history';
import { useProject } from '@/components/agent-chat/hooks/use-projects';
import type { HomeSubmitPayload } from '@/components/agent-chat/types';
import ChatComposer from '@/components/agent-chat/view/agent-chat-composer';
import { useFileDropzone } from '@/components/file-list';
import type { TextAreaRef } from '@/components/text-area';
import { Button } from '@/components/ui/button';
import ConfirmationModal from '@/components/ui/confirmation-modal';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { selectUser } from '@/store/selectors';
import type { ChatAgentType } from '@/types/admin';
import { acceptValidFilesFromInput } from '@/utils';

import ChatToolsPanel from './chat-tools-panel';
import ActivityList from './components/activity-list';
import ChatsList from './components/chats-list';
import ProjectHeader from './components/project-header';
import ProjectShareModal from './components/project-share-modal';
import ProjectTabsBar from './components/project-tabs-bar';
import SharedChatsList from './components/shared-chats-list';
import SpaceEditDialog from './components/space-edit-dialog';
import { PROJECT_TABS } from './constants';
import { ACCEPTED_FILE_TYPES } from './file-upload';
import {
    useChatRowActions,
    useComposerFileDrag,
    useFilesDropPrompt,
    useSpaceActions,
    useStickyTabsOffset,
} from './hooks';
import SpaceInstructionsCard from './space-instructions-card';
import SpaceRoutinesCard from './space-routines-card';
import type { ProjectTab } from './types';
import { useProjectFileActions } from './use-file-actions';

export interface Props {
    agent: ChatAgentType;
    onSubmit: (payload: HomeSubmitPayload) => void;
}

const renderAccessDeniedState = (agent: ChatAgentType) => (
    <div className="flex min-h-[60svh] w-full flex-col items-center justify-center gap-4 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground shadow-(--shadow-sm)">
            <LockIcon className="size-6" aria-hidden="true" />
        </div>
        <div className="max-w-[280px] space-y-1.5">
            <h3 className="text-lg font-medium tracking-[-0.02em] text-(--text-primary)">Access Denied</h3>
            <p className="text-[13px] leading-snug text-text-secondary">
                You don&apos;t have access to this space, or it may have been deleted.
            </p>
        </div>
        <Button variant="secondary" size="sm" asChild className="mt-2 rounded-xl px-4">
            <Link to={`/agent/${agent.slug}/spaces`}>Back to spaces</Link>
        </Button>
    </div>
);

const renderLoadFailedState = () => (
    <div className="flex min-h-[60svh] w-full flex-col items-center justify-center gap-4">
        <span className="text-sm text-text-secondary">Couldn&apos;t load this space</span>
        <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
            Retry
        </Button>
    </div>
);

const isAccessDeniedError = (error: unknown): boolean => {
    const axiosError = error as AxiosError<{ message?: string }>;
    const status = axiosError?.response?.status;
    // apiClient throws a custom Error (status 200) when the backend returns
    // { success: false }, so fall back to the message for that case.
    const errorMsg = axiosError?.response?.data?.message || axiosError?.message || '';

    return status === 404 || status === 403 || errorMsg.includes('There is no such project with');
};

const ProjectDetail = (props: Props) => {
    const { agent, onSubmit } = props;
    const params = useParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const canSeeRoutines = useCanSeeRoutines(props.agent.uiConfig);
    const user = useSelector(selectUser);
    const projectId = params.projectId;
    const { favoriteConversation } = useConversationHistory(agent, { enabled: false });

    const tabParam = searchParams.get('tab');
    const activeTab: ProjectTab = PROJECT_TABS.some((tab) => tab.value === tabParam)
        ? (tabParam as ProjectTab)
        : 'chats';

    const handleTabChange = (value: string) => {
        setSearchParams(
            (prev) => {
                const next = new URLSearchParams(prev);

                next.set('tab', value);

                return next;
            },
            { replace: true },
        );
    };

    const [chatsSearch, setChatsSearch] = useState('');
    const [sharedChatsSearch, setSharedChatsSearch] = useState('');

    const {
        isError,
        error,
        project,
        chats,
        activities,
        actions,
        isChatsLoading,
        hasNextChatsPage,
        isFetchingNextChatsPage,
        fetchNextChatsPage,
        sharedChats,
        isSharedChatsLoading,
        hasNextSharedChatsPage,
        isFetchingNextSharedChatsPage,
        fetchNextSharedChatsPage,
        isActivitiesLoading,
        hasNextActivitiesPage,
        isFetchingNextActivitiesPage,
        fetchNextActivitiesPage,
    } = useProject(agent._id, projectId, {
        sharedChatsEnabled: activeTab === 'shared',
        chatsSearch,
        sharedChatsSearch,
    });

    const { loadMoreRef: chatsLoadMoreRef } = useInfiniteScroll({
        loading: isChatsLoading,
        showMoreLoading: isFetchingNextChatsPage,
        hasMore: hasNextChatsPage,
        itemsLength: chats.length,
        onLoadMore: fetchNextChatsPage,
    });

    const { loadMoreRef: sharedChatsLoadMoreRef } = useInfiniteScroll({
        loading: isSharedChatsLoading,
        showMoreLoading: isFetchingNextSharedChatsPage,
        hasMore: hasNextSharedChatsPage,
        itemsLength: sharedChats.length,
        onLoadMore: fetchNextSharedChatsPage,
    });

    const { loadMoreRef: activitiesLoadMoreRef } = useInfiniteScroll({
        loading: isActivitiesLoading,
        showMoreLoading: isFetchingNextActivitiesPage,
        hasMore: hasNextActivitiesPage,
        itemsLength: activities.length,
        onLoadMore: fetchNextActivitiesPage,
    });

    const [prompt, setPrompt] = useState('');
    const composerTextAreaRef = useRef<TextAreaRef>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const spaceActions = useSpaceActions(agent, actions);
    const chatRowActions = useChatRowActions({
        agentId: agent._id,
        projectId,
        actions,
        favoriteConversation,
    });

    const myRole = project?.members.find((member) => member._id === user._id)?.role;
    const isOwnerCurrentUser = Boolean(project) && project?.creator?._id === user._id;
    const canEdit = isOwnerCurrentUser || myRole === 'editor' || myRole === 'owner';

    const { uploadFiles, uploadingFiles, removeUploadingFile, retryFailedFiles } = useProjectFileActions(actions);

    // Bottom region (tabs / files list) → uploads into the space's file library.
    const { isDragging: isDraggingFiles, dropzoneProps: filesDropzoneProps } = useFileDropzone({
        enabled: canEdit && activeTab === 'sources',
        onFiles: uploadFiles,
        accept: ACCEPTED_FILE_TYPES,
    });

    const { filesRegionRef, filesPromptRect, measureFilesPrompt } = useFilesDropPrompt(isDraggingFiles);

    const tabsBarRef = useRef<HTMLDivElement>(null);

    // Both refs are null until `project` lands (the region is behind an early return), so gate on
    // it — otherwise the effect's only run measures nothing and never retries.
    useStickyTabsOffset(filesRegionRef, tabsBarRef, Boolean(project));

    const { filesState } = useAgentComposerContext();
    const composerFilesEnabled = Boolean(agent.uiConfig?.home?.search?.files);
    const composerAccept = agent.uiConfig?.home?.search?.accept || '';
    const { isDraggingComposer, dropzoneProps: composerDropzoneProps } = useComposerFileDrag(
        composerFilesEnabled,
        composerAccept,
        filesState,
    );

    if (isError && !project) {
        return isAccessDeniedError(error) ? renderAccessDeniedState(agent) : renderLoadFailedState();
    }

    if (!project) {
        return <div className="min-h-[60svh] w-full" />;
    }

    const handleComposerSubmit = (payload: HomeSubmitPayload) => {
        onSubmit({ ...payload, projectId: project._id });
    };

    const onFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
        // Re-validate file type (extension + MIME); toasts + resets input on rejection.
        const selected = acceptValidFilesFromInput(event);

        if (fileInputRef.current) fileInputRef.current.value = '';
        if (selected.length > 0) uploadFiles(selected);
    };

    const renderComposer = () => (
        <ChatComposer
            agent={agent}
            onSubmit={handleComposerSubmit}
            value={prompt}
            onChange={setPrompt}
            textAreaRef={composerTextAreaRef}
            wrapperClassName="w-full"
            fixedSpaceName={project.name}
        />
    );

    const renderTabContent = () => {
        if (activeTab === 'sources') {
            return (
                <ProjectFiles
                    agent={agent}
                    uploadingFiles={uploadingFiles}
                    onUploadFiles={uploadFiles}
                    onRemoveUploadingFile={removeUploadingFile}
                    onRetryFailedFiles={retryFailedFiles}
                />
            );
        }

        if (activeTab === 'files') {
            return <ProjectOriginFiles projectId={projectId} agentId={agent._id} />;
        }

        if (activeTab === 'shared') {
            return (
                <SharedChatsList
                    agent={agent}
                    chats={sharedChats}
                    search={sharedChatsSearch}
                    onSearchChange={setSharedChatsSearch}
                    isLoading={isSharedChatsLoading}
                    hasNextPage={hasNextSharedChatsPage}
                    isFetchingNextPage={isFetchingNextSharedChatsPage}
                    loadMoreRef={sharedChatsLoadMoreRef}
                />
            );
        }

        if (activeTab === 'activity') {
            return (
                <ActivityList
                    agent={agent}
                    activities={activities}
                    isLoading={isActivitiesLoading}
                    hasNextPage={hasNextActivitiesPage}
                    isFetchingNextPage={isFetchingNextActivitiesPage}
                    loadMoreRef={activitiesLoadMoreRef}
                />
            );
        }

        return (
            <ChatsList
                agent={agent}
                projectId={projectId}
                chats={chats}
                search={chatsSearch}
                onSearchChange={setChatsSearch}
                isLoading={isChatsLoading}
                hasNextPage={hasNextChatsPage}
                isFetchingNextPage={isFetchingNextChatsPage}
                loadMoreRef={chatsLoadMoreRef}
                pendingPin={chatRowActions.pendingPin}
                pendingVisibility={chatRowActions.pendingVisibility}
                openMenuChatId={chatRowActions.openMenuChatId}
                changingChatSpaceId={chatRowActions.changingChatSpaceId}
                onOpenMenuChange={(chatId, open) =>
                    chatRowActions.setOpenMenuChatId((prev) => {
                        if (open) return chatId;

                        // Only clear if this row is still the open one, so opening another
                        // row's menu (which fires this row's close) doesn't wipe its id.
                        return prev === chatId ? null : prev;
                    })
                }
                onTogglePin={chatRowActions.handleToggleChatPin}
                onOpenRename={chatRowActions.openChatRename}
                onToggleVisibility={chatRowActions.handleToggleChatVisibility}
                onChangeSpace={chatRowActions.handleChangeChatSpace}
                onRemove={chatRowActions.setChatRemoveId}
                onDelete={chatRowActions.setChatDeleteId}
            />
        );
    };

    return (
        <div className="projects-container relative flex h-fit min-h-svh w-full min-w-0 flex-col bg-background max-lg:pt-[50px]">
            <div className="mx-auto flex w-full max-w-7xl items-start justify-center gap-6 px-4">
                <div className="project-detail-container flex w-full max-w-[928px] min-w-0 flex-col gap-6 pt-4 pb-8">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-fit rounded-full px-2 text-text-secondary hover:text-primary"
                        asChild
                    >
                        <Link to={`/agent/${agent.slug}/spaces`}>
                            <ArrowLeftIcon className="size-4" />
                            All spaces
                        </Link>
                    </Button>

                    <div className="project-detail-content flex flex-col gap-6">
                        <ProjectHeader
                            agent={agent}
                            project={project}
                            canEdit={canEdit}
                            isOwnerCurrentUser={isOwnerCurrentUser}
                            isPinningSpace={spaceActions.isPinningSpace}
                            onPin={() => spaceActions.handlePin(project.pinnedAt)}
                            onEdit={spaceActions.openEdit}
                            onDelete={() => spaceActions.setIsDeleteOpen(true)}
                            onShare={() => spaceActions.setIsShareOpen(true)}
                            onSetInstructions={actions.setInstructions}
                        />

                        <div className="relative" {...composerDropzoneProps}>
                            {renderComposer()}
                            {isDraggingComposer ? (
                                <div
                                    className={cn(
                                        'pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-2',
                                        'rounded-3xl border border-dashed border-border-secondary bg-background/90 text-center backdrop-blur-xs',
                                    )}
                                >
                                    <PaperclipIcon className="size-5 text-text-secondary" />
                                    <p className="text-sm font-semibold text-foreground">
                                        Drop to attach to your message
                                    </p>
                                </div>
                            ) : null}
                        </div>

                        <div
                            ref={filesRegionRef}
                            className="project-detail-tabs relative flex flex-col gap-4"
                            {...filesDropzoneProps}
                            onDragOverCapture={measureFilesPrompt}
                        >
                            {isDraggingFiles ? (
                                <>
                                    {/* Border/blur covers the full (tall) region… */}
                                    <div
                                        className={cn(
                                            'pointer-events-none absolute inset-0 z-20',
                                            'rounded-3xl border border-dashed border-border-secondary bg-background/90 backdrop-blur-xs',
                                        )}
                                    />
                                    {/* …while the prompt stays centered within the visible band of the region. */}
                                    <div
                                        className="pointer-events-none fixed z-20 flex -translate-y-1/2 flex-col items-center gap-3 text-center"
                                        style={{
                                            top: filesPromptRect?.top ?? '50%',
                                            left: filesPromptRect?.left ?? 0,
                                            width: filesPromptRect?.width ?? '100%',
                                        }}
                                    >
                                        <img
                                            src="/assets/images/file-illustration.svg"
                                            alt=""
                                            className="shared-drag-illustration"
                                        />
                                        <p className="text-sm font-semibold text-foreground">
                                            Drop to add to space files
                                        </p>
                                    </div>
                                </>
                            ) : null}

                            <ProjectTabsBar barRef={tabsBarRef} activeTab={activeTab} onTabChange={handleTabChange} />
                            {renderTabContent()}
                        </div>
                    </div>
                </div>

                <aside className="sticky top-[-20px] hidden w-80 shrink-0 self-start py-8 lg:block">
                    <div className="flex flex-col gap-5">
                        <SpaceInstructionsCard
                            instructions={project.instructions || ''}
                            canEdit={canEdit}
                            onSave={actions.setInstructions}
                        />
                        <ChatToolsPanel agent={agent} />
                        {canSeeRoutines ? (
                            <SpaceRoutinesCard agent={agent} projectId={project._id} projectName={project.name} />
                        ) : null}
                    </div>
                </aside>
            </div>

            <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                accept={ACCEPTED_FILE_TYPES}
                onChange={onFilesSelected}
            />

            <SpaceEditDialog
                open={spaceActions.isEditOpen}
                initial={{
                    name: project.name,
                    description: project.description || '',
                    instructions: project.instructions || '',
                    folderPath: project.folderPath || '',
                }}
                onOpenChange={spaceActions.setIsEditOpen}
                onSave={(patch) => actions.updateProject(patch)}
            />

            <ConfirmationModal
                isOpen={spaceActions.isDeleteOpen}
                onClose={() => spaceActions.setIsDeleteOpen(false)}
                onConfirm={spaceActions.confirmDelete}
                title="Delete space?"
                message={`"${project.name}" and its chats will be removed. This cannot be undone.`}
                confirmButtonText="Delete"
                cancelButtonText="Cancel"
                isButtonLoading={spaceActions.isDeleting}
            />

            <Dialog
                open={Boolean(chatRowActions.chatRename)}
                onOpenChange={(open) => {
                    if (!open) chatRowActions.setChatRename(null);
                }}
            >
                <DialogContent className="max-w-[440px]">
                    <DialogHeader>
                        <DialogTitle>Rename chat</DialogTitle>
                    </DialogHeader>
                    <DialogBody className="py-4">
                        <Input
                            autoFocus
                            value={chatRowActions.chatRenameValue}
                            onChange={(e) => chatRowActions.setChatRenameValue(e.currentTarget.value)}
                            onEnter={chatRowActions.submitChatRename}
                        />
                    </DialogBody>
                    <DialogFooter className="justify-end">
                        <Button variant="secondary" size="sm" onClick={() => chatRowActions.setChatRename(null)}>
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            disabled={!chatRowActions.chatRenameValue.trim() || chatRowActions.isChatActioning}
                            onClick={chatRowActions.submitChatRename}
                        >
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmationModal
                isOpen={Boolean(chatRowActions.chatDeleteId)}
                onClose={() => chatRowActions.setChatDeleteId(null)}
                onConfirm={chatRowActions.confirmChatDelete}
                title="Delete chat?"
                message="This chat will be permanently deleted."
                confirmButtonText="Delete"
                cancelButtonText="Cancel"
                isButtonLoading={chatRowActions.isChatActioning}
            />

            <ConfirmationModal
                isOpen={Boolean(chatRowActions.chatRemoveId)}
                onClose={() => chatRowActions.setChatRemoveId(null)}
                onConfirm={chatRowActions.confirmChatRemove}
                title="Remove from space?"
                message="This chat will be removed from this space but won't be deleted."
                confirmButtonText="Remove"
                cancelButtonText="Cancel"
                isButtonLoading={chatRowActions.isChatActioning}
            />

            <ProjectShareModal
                isOpen={spaceActions.isShareOpen}
                projectName={project.name}
                members={project.members}
                owner={
                    project.creator
                        ? {
                              _id: project.creator._id,
                              name: project.creator.name,
                              email: project.creator.email,
                              avatar: project.creator.avatar,
                          }
                        : {
                              _id: user._id ?? '',
                              name:
                                  [user.name?.first, user.name?.last].filter(Boolean).join(' ') || user.email || 'You',
                              email: user.email ?? '',
                              avatar: user.avatar ?? undefined,
                          }
                }
                currentUserId={user._id ?? ''}
                shareUrl={`${window.location.origin}/agent/${agent.slug}/spaces/${project._id}`}
                onClose={() => spaceActions.setIsShareOpen(false)}
                onAddMember={actions.addMember}
                onChangeRole={actions.changeMemberRole}
                onRemoveMember={actions.removeMember}
                onLeaveSpace={() => {
                    spaceActions.setIsShareOpen(false);
                    navigate(`/agent/${agent.slug}/spaces`, { replace: true });
                }}
            />
        </div>
    );
};

export default ProjectDetail;
