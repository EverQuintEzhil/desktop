import { unstable_useThreadMessageIds, useAui, useAuiState } from '@assistant-ui/react';
import { useQueryClient } from '@tanstack/react-query';
import isEqual from 'lodash/isEqual';
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import ArtifactPane from '@/components/agent-chat/artifact/artifact-pane';
import type { ArtifactPointer } from '@/components/agent-chat/artifact/artifact-types';
import { readArtifactPointer } from '@/components/agent-chat/artifact/artifact-types';
import ArtifactUrlSync from '@/components/agent-chat/artifact/artifact-url-sync';
import { WidgetSendContext } from '@/components/agent-chat/genui/widget-send-context';
import type { ResearchContent } from '@/components/agent-chat/research/research-contract';
import ResearchPane, { type RequestedResearchView } from '@/components/agent-chat/research/research-pane';
import { SelectionQuoteProvider } from '@/components/chat';
import { useChatClassNames, useChatHost } from '@/components/chat-host';
import type { ChatSidePane, ChatSidePanelController } from '@/components/chat-host';
import Dropzone from '@/components/dropzone';
import type { TextAreaRef } from '@/components/text-area';
import { cn } from '@/lib/utils';
import type { ChatAgentType, PromptType } from '@/types/admin';

import { useAgentComposerContext } from '../../context/agent-composer-context';
import { useChatShell } from '../../context/chat-shell-context';
import { useChatDraft } from '../../hooks/use-chat-draft';
import {
    getConversationAllQueryKey,
    getConversationFavoritesQueryKey,
    getConversationHistoryQueryKey,
    removeConversationHistoryData,
} from '../../hooks/use-conversation-history';
import { useForkConversation } from '../../hooks/use-fork-conversation';
import type { ChatSource, ConversationHistoryQueryData } from '../../types';
import { FindProvider } from '../chat-find-bar';
import { ChatThread } from '../chat-thread';
import { ChatViewContext } from '../chat-view-context';
import DeleteConfirmationModal from '../delete-confirmation-modal';
import ShareChatModal from '../share-chat-modal';
import ChatConversationLoading from '../shared/chat-conversation-loading';
import SourcePane from '../source-pane/source-pane';

import ChatViewComposerSlot from './components/chat-view-composer-slot';
import ChatViewHeader from './components/chat-view-header';
import useChatQueue from './hooks/use-chat-queue';
import useShareConversation from './hooks/use-share-conversation';
import './chat-view.scss';

interface SelectedArtifact {
    pointer: ArtifactPointer;
    openNonce: number;
}

interface Props {
    agent: ChatAgentType;
    conversationId?: string | null;
    isConversationLoading?: boolean;
    isPendingGeneration?: boolean;
    backgroundReloadNonce?: number;
    isFromAdmin?: boolean;
    artifactLinksEnabled?: boolean;
    isForeignConversation?: boolean;
    branchedFromConversation?: { id: string; title: string; messageId?: string | null } | null;
    isMessageInterrupted?: (id: string) => boolean;
    onPromptAdded?: (prompt: PromptType) => void;
    onLoadOlderMessages?: () => void;
    hasMoreOlderMessages?: boolean;
    isLoadingOlderMessages?: boolean;
    /**
     * Enables the composer's "Add to space" picker for this existing conversation.
     * Selecting a space moves the conversation immediately.
     */
    spaceMove?: {
        selectedProjectId?: string | null;
        onMove: (space: { _id: string; name: string } | null) => void;
    };
    /**
     * Name of the space/project this conversation belongs to, when it is in one.
     * Drives the "share in project" wording in the share modal.
     */
    spaceName?: string | null;
}

const ChatView = ({
    agent,
    conversationId = null,
    isConversationLoading = false,
    isPendingGeneration = false,
    backgroundReloadNonce = 0,
    isFromAdmin = false,
    artifactLinksEnabled = false,
    isForeignConversation = false,
    branchedFromConversation = null,
    isMessageInterrupted,
    onPromptAdded,
    onLoadOlderMessages,
    hasMoreOlderMessages = false,
    isLoadingOlderMessages = false,
    spaceMove,
    spaceName,
}: Props) => {
    const { composer, filesState, onStopGeneration } = useAgentComposerContext();
    const { variant } = useChatShell();
    const fillParent = isFromAdmin || variant === 'panel';
    const { session, conversations, navigation, slots } = useChatHost();
    const classNames = useChatClassNames();
    const conversationsRef = useRef(conversations);

    conversationsRef.current = conversations;
    const user = session.user;
    const aui = useAui();
    const isRunning = useAuiState((s) => s.thread.isRunning);
    const { fork, isPending: isForkPending, canFork } = useForkConversation(conversationId);
    const queryClient = useQueryClient();
    const launcher = slots?.useAgentLauncher?.(agent) ?? {};
    const slotSidePanel = slots?.useSidePanel?.();

    const [pendingQuote, setPendingQuoteState] = useState<string | null>(null);
    const composerTextAreaRef = useRef<TextAreaRef>(null);
    const { draft, onDraftChange, clearDraft } = useChatDraft({
        agentId: agent._id,
        conversationId,
        userId: user?.id ?? null,
        isIncognito: composer.isIncognitoMode,
        textAreaRef: composerTextAreaRef,
    });

    const setPendingQuote = useCallback((text: string) => {
        setPendingQuoteState(text);
        composerTextAreaRef.current?.focusAtEnd();
    }, []);

    const clearPendingQuote = useCallback(() => {
        setPendingQuoteState(null);
    }, []);

    const {
        queue,
        editingQueuedId,
        cancelQueued,
        handleSubmit,
        submitWidgetMessage,
        handleEditQueued,
        handleCancelEditQueued,
        handleSendNowQueued,
    } = useChatQueue({
        aui,
        conversationId,
        pendingQuote,
        clearPendingQuote,
        clearDraft,
        onDraftChange,
        composerTextAreaRef,
        onStopGeneration,
        isPendingGeneration,
        backgroundReloadNonce,
    });

    const [isEditingMessage, setIsEditingMessage] = useState(false);
    const [fallbackPane, setFallbackPane] = useState<ChatSidePane>(null);
    const [selectedSources, setSelectedSources] = useState<ChatSource[]>([]);
    const [selectedResearch, setSelectedResearch] = useState<{
        messageId: string;
        content: ResearchContent;
        isRunning: boolean;
        view: RequestedResearchView;
        /** Bumped on every explicit navigation, so asking for the level already stored still moves. */
        viewNonce: number;
    } | null>(null);
    const [selectedArtifact, setSelectedArtifact] = useState<SelectedArtifact | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDeleteLoading, setIsDeleteLoading] = useState(false);
    const canManageConversation = Boolean(conversationId && !isForeignConversation && !isFromAdmin);

    // Fallback controller for hosts that don't supply the useSidePanel slot (e.g.
    // the SDK / admin). It knows only the panes chat-view itself renders, and keeps
    // the same single-active-pane invariant as the app-level coordinator.
    const fallbackOpen = useCallback((pane: Exclude<ChatSidePane, null>) => {
        setFallbackPane(pane);
    }, []);

    const fallbackClose = useCallback(() => {
        setFallbackPane(null);
    }, []);

    const fallbackToggle = useCallback((pane: Exclude<ChatSidePane, null>) => {
        setFallbackPane((prev) => (prev === pane ? null : pane));
    }, []);

    const fallbackController = useMemo<ChatSidePanelController>(
        () => ({
            activePane: fallbackPane,
            open: fallbackOpen,
            close: fallbackClose,
            toggle: fallbackToggle,
        }),
        [fallbackPane, fallbackOpen, fallbackClose, fallbackToggle],
    );

    const sidePanel = slotSidePanel ?? fallbackController;

    const isResearchPaneOpen = sidePanel.activePane === 'research';
    const isArtifactPaneOpen = sidePanel.activePane === 'artifact';
    const threadMessageIds = unstable_useThreadMessageIds();

    // A branch switch, edit-fork or regenerate replaces the message the pane is describing;
    // leaving it open would show one branch's trace beside another branch's answer.
    useEffect(() => {
        if (!selectedResearch || threadMessageIds.includes(selectedResearch.messageId)) return;

        setSelectedResearch(null);
        if (isResearchPaneOpen) sidePanel.close();
    }, [threadMessageIds, selectedResearch, isResearchPaneOpen, sidePanel]);

    const share = useShareConversation({ conversationId, conversationsRef });

    const previousConversationIdRef = useRef(conversationId);

    useEffect(() => {
        // A new conversation mints its id mid-turn (null -> id), which is not a move to another
        // conversation: a research trace opened during that first turn must survive it. Same
        // exception `ChatSidePanelProvider` and the composer options already make.
        const leftAnExistingConversation = Boolean(previousConversationIdRef.current);

        previousConversationIdRef.current = conversationId;

        setSelectedSources([]);
        // The fallback controller takes the same exemption as `ChatSidePanelProvider`: a pane
        // opened during the first turn must survive that turn minting the conversation id.
        if (leftAnExistingConversation) {
            setFallbackPane(null);
            setSelectedResearch(null);
            setSelectedArtifact(null);
        }
        setPendingQuoteState(null);
        share.resetOnConversationChange();
        // `share` is intentionally omitted: the hook returns a fresh object every render, so
        // depending on it re-runs this reset on every render — and setSelectedSources([]) then
        // makes that a render loop. resetOnConversationChange is a stable useCallback.
    }, [conversationId]);

    const handleShowSources = useCallback(
        (sources: ChatSource[]) => {
            const prevKey = selectedSources.map((s) => s.url).join(',');
            const nextKey = sources.map((s) => s.url).join(',');

            if (prevKey === nextKey) {
                sidePanel.toggle('sources');

                return;
            }
            setSelectedSources(sources);
            sidePanel.open('sources');
        },
        [selectedSources, sidePanel],
    );

    const handleCloseSources = useCallback(() => {
        sidePanel.close();
    }, [sidePanel]);

    const handleShowResearch = useCallback(
        (messageId: string, content: ResearchContent, isRunning: boolean, view?: RequestedResearchView) => {
            // Re-pushes arrive per streamed chunk; keeping the identity when nothing changed
            // stops the context value — and every consumer of it — from churning for a whole run.
            setSelectedResearch((prev) => {
                // No view asked for means this is a snapshot refresh, not a navigation: whatever
                // level the reader is on has to survive it, or an open report snaps back to the
                // trace on the next streamed chunk.
                const nextView = view ?? (prev?.messageId === messageId ? prev.view : 'trace');
                const nonce = prev?.viewNonce ?? 0;

                // An explicit level is a navigation and must always land, even when the pane is
                // already storing that level — the reader may have walked away from it in-pane.
                if (view !== undefined) return { messageId, content, isRunning, view, viewNonce: nonce + 1 };

                return prev?.messageId === messageId &&
                    prev.isRunning === isRunning &&
                    prev.view === nextView &&
                    isEqual(prev.content, content)
                    ? prev
                    : { messageId, content, isRunning, view: nextView, viewNonce: nonce };
            });
            sidePanel.open('research');
        },
        [sidePanel],
    );

    const handleCloseResearch = useCallback(() => {
        sidePanel.close();
    }, [sidePanel]);

    const handleShowArtifact = useCallback(
        (pointer: ArtifactPointer) => {
            setSelectedArtifact((previous) => ({ pointer, openNonce: (previous?.openNonce ?? 0) + 1 }));
            sidePanel.open('artifact');
        },
        [sidePanel],
    );

    const handleCloseArtifact = useCallback(() => {
        sidePanel.close();
    }, [sidePanel]);

    const resolveArtifactBySlug = useCallback(
        (slug: string): ArtifactPointer | null => {
            let latest: ArtifactPointer | null = null;

            for (const message of aui.thread.getState().messages) {
                const parts = message.parts as unknown as { type: string; name?: string; data?: unknown }[];

                for (const part of parts) {
                    const pointer = readArtifactPointer(part);

                    if (!pointer || pointer.slug !== slug) continue;
                    if (!latest || pointer.versionNumber > latest.versionNumber) latest = pointer;
                }
            }

            return latest;
        },
        [aui],
    );

    const selectionQuoteContextValue = useMemo(
        () => ({
            pendingQuote,
            setPendingQuote,
            clearPendingQuote,
        }),
        [pendingQuote, setPendingQuote, clearPendingQuote],
    );

    const handleDeleteConfirm = useCallback(async () => {
        if (!conversationId) return;
        setIsDeleteLoading(true);
        try {
            await conversationsRef.current.delete(conversationId);
            queryClient.setQueryData<ConversationHistoryQueryData | undefined>(
                getConversationHistoryQueryKey(agent._id),
                (currentData) => removeConversationHistoryData(currentData, conversationId),
            );
            queryClient.invalidateQueries({ queryKey: getConversationAllQueryKey(agent._id) });
            queryClient.invalidateQueries({ queryKey: getConversationFavoritesQueryKey(agent._id) });
            setIsDeleteModalOpen(false);
            navigation.startNewConversation();
        } finally {
            setIsDeleteLoading(false);
        }
    }, [conversationId, agent._id, navigation, queryClient]);

    const handleEditStart = useCallback(() => {
        setIsEditingMessage(true);
    }, []);

    const handleEditEnd = useCallback(() => {
        setIsEditingMessage(false);
    }, []);

    // Keep the context value stable so GenUI bridges (memoized on sendMessage)
    // do not remake when queue routing identity changes mid-run.
    const submitWidgetMessageRef = useRef(submitWidgetMessage);

    submitWidgetMessageRef.current = submitWidgetMessage;
    const onWidgetSend = useCallback((text: string) => {
        submitWidgetMessageRef.current(text);
    }, []);

    const contextValue = useMemo(
        () => ({
            agent,
            conversationId,
            onShowSources: handleShowSources,
            onShowResearch: handleShowResearch,
            activeResearchMessageId: isResearchPaneOpen ? (selectedResearch?.messageId ?? null) : null,
            onShowArtifact: handleShowArtifact,
            activeArtifactId: isArtifactPaneOpen ? (selectedArtifact?.pointer.artifactId ?? null) : null,
            isFromAdmin,
            onPromptAdded,
            onEditStart: handleEditStart,
            onEditEnd: handleEditEnd,
            branchedFromConversation,
            isForeignConversation,
            isMessageInterrupted,
            isPendingGeneration,
        }),
        [
            agent,
            conversationId,
            handleShowSources,
            handleShowResearch,
            isResearchPaneOpen,
            selectedResearch,
            handleShowArtifact,
            isArtifactPaneOpen,
            selectedArtifact,
            isFromAdmin,
            onPromptAdded,
            handleEditStart,
            handleEditEnd,
            branchedFromConversation,
            isForeignConversation,
            isMessageInterrupted,
            isPendingGeneration,
        ],
    );

    const renderBody = () => {
        if (isConversationLoading) return <ChatConversationLoading />;

        return (
            <>
                <Dropzone
                    multiple
                    global
                    accept={agent.uiConfig?.home?.search?.accept || ''}
                    onChange={filesState.onChangeFile as (e: ChangeEvent<HTMLInputElement>) => void}
                    uploading={filesState.isUploading}
                    disabled={!agent.uiConfig?.home?.search?.files}
                    className={cn(
                        'left-side flex min-h-0 w-full flex-col overflow-hidden',
                        fillParent ? 'h-full min-h-0 flex-1' : 'h-svh',
                    )}
                >
                    <FindProvider
                        isEnabled={!slots?.renderHeader}
                        hasMoreOlderMessages={hasMoreOlderMessages}
                        isLoadingOlderMessages={isLoadingOlderMessages}
                        onLoadOlderMessages={onLoadOlderMessages}
                    >
                        <ChatViewHeader
                            agent={agent}
                            conversationId={conversationId}
                            slots={slots}
                            launcher={launcher}
                            headerClassName={classNames.header}
                            canManageConversation={canManageConversation}
                            isForeignConversation={isForeignConversation}
                            onShare={share.openShare}
                            onDeleteClick={() => setIsDeleteModalOpen(true)}
                        />

                        <ChatThread
                            className="flex min-h-0 flex-1 flex-col"
                            viewportClassName="conversation-panel scroll-to-top overflow-y-auto"
                            messagesClassName="message-list conversation-block max-w-[810px] w-full mx-auto flex flex-col gap-6 px-4 rounded-3xl"
                            isPendingGeneration={isPendingGeneration}
                            onLoadOlderMessages={onLoadOlderMessages}
                            hasMoreOlderMessages={hasMoreOlderMessages}
                            isLoadingOlderMessages={isLoadingOlderMessages}
                            enableMessageNav
                            isSidePanelOpen={sidePanel.activePane !== null}
                            composer={
                                <ChatViewComposerSlot
                                    agent={agent}
                                    slots={slots}
                                    isForeignConversation={isForeignConversation}
                                    isForkPending={isForkPending}
                                    canFork={canFork}
                                    onFork={() => {
                                        void fork();
                                    }}
                                    isRunning={isRunning}
                                    onSubmit={handleSubmit}
                                    draft={draft}
                                    onDraftChange={onDraftChange}
                                    composerTextAreaRef={composerTextAreaRef}
                                    isEditingMessage={isEditingMessage}
                                    editingQueuedId={editingQueuedId}
                                    queue={queue}
                                    onEditQueued={handleEditQueued}
                                    onSendNowQueued={handleSendNowQueued}
                                    onCancelQueued={cancelQueued}
                                    onCancelEditQueued={handleCancelEditQueued}
                                    spaceMove={spaceMove}
                                />
                            }
                        />
                    </FindProvider>
                </Dropzone>

                <SourcePane
                    isVisible={sidePanel.activePane === 'sources'}
                    sources={selectedSources}
                    onClose={handleCloseSources}
                    isFromAdmin={isFromAdmin}
                />

                <ResearchPane
                    isVisible={isResearchPaneOpen}
                    runId={selectedResearch?.messageId ?? null}
                    content={selectedResearch?.content ?? null}
                    isRunning={selectedResearch?.isRunning ?? false}
                    requestedView={selectedResearch?.view ?? 'trace'}
                    requestedViewNonce={selectedResearch?.viewNonce ?? 0}
                    onClose={handleCloseResearch}
                    isFromAdmin={isFromAdmin}
                />

                <ArtifactPane
                    isVisible={isArtifactPaneOpen}
                    agentId={agent._id}
                    agentSlug={artifactLinksEnabled ? agent.slug : undefined}
                    artifact={selectedArtifact?.pointer ?? null}
                    openNonce={selectedArtifact?.openNonce ?? 0}
                    onClose={handleCloseArtifact}
                    isFromAdmin={isFromAdmin}
                />

                {artifactLinksEnabled && (
                    <ArtifactUrlSync
                        conversationId={conversationId}
                        openSlug={isArtifactPaneOpen ? (selectedArtifact?.pointer.slug ?? null) : null}
                        resolveKey={`${threadMessageIds.join(',')}|${isRunning}`}
                        resolveSlug={resolveArtifactBySlug}
                        onOpen={handleShowArtifact}
                        onClose={handleCloseArtifact}
                    />
                )}

                {conversationId && slots?.renderChatSidePanel?.({ agent, conversationId })}

                {/* The assistant panel's own chrome row owns the info icon and this sidesheet,
                    so rendering it here too would mount a second, unreachable copy. */}
                {variant !== 'panel' && launcher.renderAgentDetailsSidesheet?.()}
            </>
        );
    };

    return (
        <ChatViewContext.Provider value={contextValue}>
            <SelectionQuoteProvider value={selectionQuoteContextValue}>
                <WidgetSendContext.Provider value={onWidgetSend}>{renderBody()}</WidgetSendContext.Provider>
            </SelectionQuoteProvider>
            <DeleteConfirmationModal
                isOpen={isDeleteModalOpen}
                isLoading={isDeleteLoading}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDeleteConfirm}
                title="Delete Conversation"
                message="Are you sure you want to delete this conversation? This action cannot be undone."
            />
            <ShareChatModal
                isOpen={share.isShareModalOpen}
                onClose={share.closeShare}
                shareUrl={
                    (conversationId ? slots?.resolveShareUrl?.(conversationId) : undefined) ??
                    (typeof window !== 'undefined' ? window.location.href : '')
                }
                isPublic={share.isConversationPublic}
                isLoadingState={share.isShareStateLoading}
                isUpdating={share.isShareUpdating}
                onSetVisibility={share.handleSetVisibility}
                spaceName={spaceName}
            />
        </ChatViewContext.Provider>
    );
};

export default ChatView;
