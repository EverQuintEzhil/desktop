import { AssistantRuntimeProvider, Tools, useAui, type Toolkit } from '@assistant-ui/react';
import { useQueryClient } from '@tanstack/react-query';
import type { ChatOnFinishCallback } from 'ai';
import { MenuIcon } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useSelector } from 'react-redux';
import { matchPath, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import ChatCompletionNotifier from '@/app/components/chat-completion-notifier/chat-completion-notifier';
import ChatKeyboardLayer from '@/app/components/chat-keyboard-layer/chat-keyboard-layer';
import { markConversationRead, markConversationUnread, useAppDispatch } from '@/app/hooks';
import { AgentComposerContext } from '@/components/agent-chat/context/agent-composer-context';
import { useChatShell } from '@/components/agent-chat/context/chat-shell-context';
import { ToolApprovalProvider } from '@/components/agent-chat/context/tool-approval-context';
import { useAgentComposerOptions } from '@/components/agent-chat/hooks/use-agent-composer-options';
import { useAgentRuntime } from '@/components/agent-chat/hooks/use-agent-runtime';
import { useBranchHeadSync } from '@/components/agent-chat/hooks/use-branch-head-sync';
import {
    getConversationAllQueryKey,
    getConversationFavoritesQueryKey,
    getConversationHistoryQueryKey,
    prependConversationHistoryData,
    setConversationStatusInCache,
    updateConversationHistoryData,
} from '@/components/agent-chat/hooks/use-conversation-history';
import { useConversationLoader } from '@/components/agent-chat/hooks/use-conversation-loader';
import { useConversationPendingPoll } from '@/components/agent-chat/hooks/use-conversation-pending-poll';
import { projectsKeys } from '@/components/agent-chat/hooks/use-projects';
import Projects from '@/components/agent-chat/projects';
import { CreateSpaceDialogProvider } from '@/components/agent-chat/projects/create-space-dialog-context';
import PromptLibrary from '@/components/agent-chat/prompt-library';
import { useRecentsUi } from '@/components/agent-chat/recents/recents-context';
import RecentsPanel from '@/components/agent-chat/recents/recents-panel';
import { stopChatGeneration } from '@/components/agent-chat/runtime/stop-chat-generation';
import type {
    ChatAgentLocationState,
    ConversationHistoryQueryData,
    FluentMindUIMessage,
    HomeSubmitPayload,
} from '@/components/agent-chat/types';
import NewChatView from '@/components/agent-chat/view/chat-view';
import ChatConversationLoading from '@/components/agent-chat/view/shared/chat-conversation-loading';
import { ToolProgressProvider } from '@/components/chat';
import { ChatHostProvider, useChatHost, type ChatHost } from '@/components/chat-host';
import LocalToolsStatusChip from '@/components/local-tools-status-chip';
import { SpaceTerminalDock } from '@/components/space-terminal';
import { Button } from '@/components/ui/button';
import { useNotificationPreference } from '@/hooks/use-notification-preference';
import { useChatFiles } from '@/lib/chat/use-chat-files';
import {
    cancelInFlightLocalTools,
    getComposerSpaceId,
    subscribeToComposerSpace,
    useLocalToolkit,
    useProjectFolderPath,
} from '@/lib/local-tools';
import { cn } from '@/lib/utils';
import { addHistory } from '@/store/reducers/history';
import { selectTenant, selectUser } from '@/store/selectors';
import type { ChatAgentType } from '@/types/admin';
import type { ConversationStatus, MessageMetadataCustom } from '@/types/chat';
import { showInfoToast } from '@/utils';
import { deliverNotification } from '@/utils/deliver-notification';

import Routines from '../../../routines';
import RoutineDetail from '../../../routines/routine-detail';
import { useCanSeeRoutines } from '../../../routines/routines-visibility';

import ChatSideBar from './components/chat/chat-side-bar/chat-side-bar';
import { ChatSidePanelProvider } from './components/chat/conversation-files/chat-files-panel-context';
import { ConversationUsageDialogProvider } from './components/chat/conversation-header/conversation-usage-dialog-context';
import { useProjectName } from './components/chat/conversation-header/use-project-name';
import Library from './components/library';
import ProjectDetail from './components/project-detail';
import ProjectFiles from './components/project-files';
import PromptDetail from './components/prompt-detail';
import Recents from './components/recents/recents';
import RootRoute from './components/root-route';
import { useAgentModelPreferenceGate } from './hooks/use-agent-model-preference-gate';
import { getConversationMetaQueryKey, useConversationMeta, type ConversationMeta } from './hooks/use-conversation-meta';
import { useConversationSpaceMove } from './hooks/use-conversation-space-move';
import { buildChatHost } from './utils/build-chat-host';
import './chat-agent.scss';

const USAGE_REFRESH_DELAY_MS = 1200;
// Long enough to outlast any real turn, short enough that a missed finish self-heals.
const LIVE_TURN_GATE_TIMEOUT_MS = 15 * 60 * 1000;

const EMPTY_TOOLKIT: Toolkit = {};

interface ChatAgentInnerProps {
    agent: ChatAgentType;
    newChatEpoch: number;
    setNewChatEpoch: Dispatch<SetStateAction<number>>;
}

const ChatAgentInner = ({ agent, newChatEpoch, setNewChatEpoch }: ChatAgentInnerProps) => {
    const navigate = useNavigate();
    const currentLocation = useLocation();
    const dispatch = useAppDispatch();
    const queryClient = useQueryClient();
    const user = useSelector(selectUser);
    const host = useChatHost();
    const shell = useChatShell();
    const isPanelVariant = shell.variant === 'panel';
    const {
        enabled: isRecentsEnabled,
        open: isRecentsOpen,
        setOpen: setRecentsOpen,
        headerOwnsToggle,
        registerNewChat,
    } = useRecentsUi();
    const shellRef = useRef(shell);

    shellRef.current = shell;
    const isModelPreferenceSettled = useAgentModelPreferenceGate(agent._id);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    // Project the next NEW conversation belongs to; set per-send by handleHomeSubmit
    // so it can't leak into unrelated chats (a plain send resets it to null).
    const [pendingProjectId, setPendingProjectId] = useState<string | null>(null);
    const [interruptedMessageIds, setInterruptedMessageIds] = useState<ReadonlySet<string>>(() => new Set());

    const locationState = currentLocation.state as ChatAgentLocationState;
    const initialPayload = locationState?.payload || null;

    const hasSentRef = useRef(false);
    const pendingBranchPromptRef = useRef<string | null>(null);
    const pendingBranchSentRef = useRef(false);
    const pendingModeRef = useRef<'chat' | null>(null);
    const pendingTitleRef = useRef<string>('');
    const intentionalStopRef = useRef(false);

    const routeConversationId =
        matchPath('/agent/:agentId/chat/:conversationId', currentLocation.pathname)?.params.conversationId || null;
    const externalConversationId = routeConversationId;

    const isIncognitoRef = useRef(false);
    const pendingIsIncognitoRef = useRef(false);
    const [isForeignConversation, setIsForeignConversation] = useState<boolean | null>(null);
    // Set when a conversation is picked from Recents, cleared once the route has moved anywhere:
    // a picked conversation that turns out to be gone lands on home instead of the id asked for,
    // and comparing against that id alone would leave the panel on a skeleton for good.
    const [switchingToConversationId, setSwitchingToConversationId] = useState<string | null>(null);
    const settledConversationIdRef = useRef(routeConversationId);
    const isSwitchingConversation =
        switchingToConversationId !== null && switchingToConversationId !== routeConversationId;

    // Cleared during render, not in an effect: an effect would clear it a paint later, and that
    // paint is exactly the flash this flag exists to prevent.
    if (settledConversationIdRef.current !== routeConversationId) {
        settledConversationIdRef.current = routeConversationId;

        if (switchingToConversationId !== null) setSwitchingToConversationId(null);
    }

    useEffect(() => {
        setIsForeignConversation(null);
    }, [routeConversationId]);

    const { projectId: conversationProjectId } = useConversationMeta(agent._id, routeConversationId);
    const conversationProjectName = useProjectName(agent.uiConfig.spaces?.enabled ? conversationProjectId : null);

    // Space-scoped local coding tools (desktop only). The active space comes from
    // the open conversation, the space route, or the composer's pending space
    // chip on home — the last one is what attaches tools to the FIRST message of
    // a new space chat. Gating rule: no folder path on the space → no tools sent.
    const composerSpaceId = useSyncExternalStore(subscribeToComposerSpace, getComposerSpaceId);
    const routeSpaceId =
        matchPath('/agent/:agentId/spaces/:projectId/*', currentLocation.pathname)?.params.projectId ??
        matchPath('/agent/:agentId/spaces/:projectId', currentLocation.pathname)?.params.projectId ??
        null;
    // pendingProjectId bridges the home→conversation transition: the home composer
    // unmounts on submit (clearing the store) before useConversationMeta has loaded,
    // and without it the toolkit would detach mid-turn on the FIRST message.
    const activeSpaceId = conversationProjectId ?? pendingProjectId ?? routeSpaceId ?? composerSpaceId;
    const spaceFolderPath = useProjectFolderPath(agent.uiConfig.spaces?.enabled ? activeSpaceId : null);
    const localToolkit = useLocalToolkit(spaceFolderPath);

    // Host-provided browser-executed tools (componentType "app") merged with the
    // space's local coding tools. Stable identity is each provider's job — the
    // toolkit is read once per render into the aui client.
    const clientToolkit = useMemo(
        () => (localToolkit ? { ...(shell.clientToolkit ?? EMPTY_TOOLKIT), ...localToolkit } : (shell.clientToolkit ?? EMPTY_TOOLKIT)),
        [shell.clientToolkit, localToolkit],
    );
    const clientToolNames = useMemo(() => Object.keys(clientToolkit), [clientToolkit]);
    const aui = useAui({ tools: Tools({ toolkit: clientToolkit }) });
    const moveConversationToSpace = useConversationSpaceMove(agent._id, routeConversationId);

    const canSeeRoutines = useCanSeeRoutines(agent.uiConfig);

    const chatSpaceMove = useMemo(() => {
        if (!routeConversationId || isForeignConversation === true) return undefined;

        return {
            selectedProjectId: conversationProjectId,
            onMove: (space: { _id: string; name: string } | null) => moveConversationToSpace(space?._id ?? null),
        };
    }, [routeConversationId, isForeignConversation, conversationProjectId, moveConversationToSpace]);

    const filesState = useChatFiles({
        agentId: agent._id,
        isIncognitoMode: () => isIncognitoRef.current,
        getConversationId: () => routeConversationId,
    });

    const composerOptions = useAgentComposerOptions(
        agent,
        () => {
            filesState.fileInputRef.current?.click();
        },
        routeConversationId,
    );

    isIncognitoRef.current = composerOptions.isIncognitoMode;

    useEffect(() => {
        if (!pendingModeRef.current) return;
        const pendingRoute = matchPath(`/agent/:agentId/${pendingModeRef.current}`, currentLocation.pathname);

        if (pendingRoute) return;
        pendingModeRef.current = null;
        pendingTitleRef.current = '';
    }, [currentLocation]);

    const handleConversationId = useCallback(
        (id: string) => {
            // A chat created inside a project → refresh that project's chat list.
            if (pendingProjectId) {
                queryClient.invalidateQueries({ queryKey: projectsKeys.conversations(agent._id, pendingProjectId) });
            }
            if (pendingModeRef.current) {
                const isIncognito = pendingIsIncognitoRef.current;

                if (!isIncognito) {
                    const title = pendingTitleRef.current || 'New conversation';
                    const newHistory = {
                        _id: id,
                        title,
                        updated_at: Date.now(),
                        created_at: Date.now(),
                        user: {
                            email: user.email as string,
                            name: {
                                first: user.name?.first as string,
                                last: user.name?.last as string,
                            },
                        },
                        chat_project_id: pendingProjectId || undefined,
                        generation_status: null as null,
                    };

                    dispatch(addHistory(newHistory));
                    queryClient.setQueryData<ConversationHistoryQueryData>(
                        getConversationHistoryQueryKey(agent._id),
                        (currentData) => prependConversationHistoryData(currentData, newHistory),
                    );
                    queryClient.invalidateQueries({ queryKey: getConversationAllQueryKey(agent._id) });
                    host.navigation.setConversationId(id, { replace: true });
                }
                pendingModeRef.current = null;
            }
        },
        [host, dispatch, queryClient, user, agent._id, agent.slug, pendingProjectId],
    );

    const handleTitle = useCallback(
        (conversationId: string, title: string) => {
            queryClient.setQueryData<ConversationHistoryQueryData>(
                getConversationHistoryQueryKey(agent._id),
                (currentData) => updateConversationHistoryData(currentData, { _id: conversationId, title }),
            );

            const metaQueryKey = getConversationMetaQueryKey(agent._id, conversationId);

            queryClient.setQueryData<ConversationMeta>(metaQueryKey, (current) =>
                current ? { ...current, title } : current,
            );
            queryClient.invalidateQueries({ queryKey: metaQueryKey });

            queryClient.invalidateQueries({ queryKey: getConversationAllQueryKey(agent._id) });
            queryClient.invalidateQueries({ queryKey: getConversationFavoritesQueryKey(agent._id) });
        },
        [queryClient, agent._id],
    );

    // While this tab streams a turn, the in-band frames are the only trustworthy status:
    // the envelope is flipped to 'generating' when a conversation is CREATED, not on every
    // turn, so a poll during a follow-up turn still reads the previous terminal status and
    // would clear the indicator mid-stream. `liveTurnConversationId` holds that conversation
    // out of the poller until the turn ends.
    const [liveTurnConversationId, setLiveTurnConversationId] = useState<string | null>(null);

    // onFinish is not guaranteed — a resume attach answering 204 skips it — so the gate
    // also expires on its own rather than pinning a row's indicator for the whole session.
    useEffect(() => {
        if (!liveTurnConversationId) return undefined;

        const timer = setTimeout(() => setLiveTurnConversationId(null), LIVE_TURN_GATE_TIMEOUT_MS);

        return () => clearTimeout(timer);
    }, [liveTurnConversationId]);

    // Read through a ref so a preference change never rebuilds the status handler, which the
    // transport holds for the life of the runtime.
    const { enabled: isNotificationEnabled, isLoaded: isNotificationLoaded } = useNotificationPreference();
    const isNotificationEnabledRef = useRef(false);

    useEffect(() => {
        isNotificationEnabledRef.current = isNotificationLoaded && isNotificationEnabled;
    }, [isNotificationEnabled, isNotificationLoaded]);

    const handleConversationStatus = useCallback(
        (conversationId: string, status: ConversationStatus) => {
            setLiveTurnConversationId(status === 'generating' ? conversationId : null);
            setConversationStatusInCache(queryClient, agent._id, conversationId, status);

            // A turn that finishes while the reader is on a different conversation is the
            // case the unread mark exists for; one they are watching needs no mark.
            if (status !== 'generating' && conversationId !== routeConversationIdRef.current) {
                markConversationUnread(agent._id, conversationId);

                // The route carries no id until the first turn settles, so on a brand-new chat
                // the route check alone would call the conversation on screen "elsewhere". The
                // streaming id is what the reader is actually watching.
                const isOnScreen = conversationId === activeConversationIdRef.current;

                // Not every non-generating status is a finished answer: `awaiting_input` is a
                // paused turn waiting on this reader, and a failed or killed run has nothing to
                // read. Saying "finished" for those sends them to an empty or blocked chat.
                const hasAnswer = status === 'completed' || status === 'ready';

                // The tab-away notifier cannot see this one: the reader is right here, looking
                // at a different conversation, so the page is visible and focused. Tagged per
                // conversation so two finishing together produce two notifications rather than
                // one replacing the other.
                if (hasAnswer && !isOnScreen && isNotificationEnabledRef.current) {
                    void deliverNotification(agent.name || 'Response ready', {
                        body: 'A chat you left has finished.',
                        tag: `fluentmind-conversation-${conversationId}`,
                        data: { url: `${window.location.origin}/agent/${agent.slug}/chat/${conversationId}` },
                    });
                }
            }
        },
        [queryClient, agent._id, agent.name, agent.slug],
    );

    const handleHomeSubmit = useCallback(
        (mode: 'chat', payload: HomeSubmitPayload) => {
            hasSentRef.current = false;
            setNewChatEpoch((e) => e + 1);
            setPendingProjectId(payload.projectId ?? null);
            pendingIsIncognitoRef.current = isIncognitoRef.current;
            pendingModeRef.current = mode;
            pendingTitleRef.current = payload.message;
            navigate(`/agent/${agent.slug}/${mode}`, { state: { payload } });
        },
        [navigate, agent.slug],
    );

    const handleMobileMenuToggle = () => setIsMobileMenuOpen((v) => !v);
    const handleMobileMenuClose = () => setIsMobileMenuOpen(false);

    const clearPendingGenerationRef = useRef<(finishedConversationId: string | null) => void>(() => {});

    const handleTurnFinish = useCallback<ChatOnFinishCallback<FluentMindUIMessage>>(
        (event) => {
            const wasIntentionalStop = intentionalStopRef.current;

            intentionalStopRef.current = false;
            setLiveTurnConversationId(null);

            const finishedConversationId = event.message?.metadata?.conversationId ?? activeConversationIdRef.current;

            // Only a clean finish or an intentional stop ends the server's turn; a
            // teardown abort, disconnect or error leaves it running.
            const didRunEndHere = wasIntentionalStop || !(event.isAbort || event.isDisconnect || event.isError);

            if (didRunEndHere && finishedConversationId === activeConversationIdRef.current) {
                clearPendingGenerationRef.current(finishedConversationId);
            }

            if (event.isAbort) {
                if (event.message?.id && wasIntentionalStop) {
                    const abortedId = event.message.id;

                    setInterruptedMessageIds((prev) => {
                        const next = new Set(prev);

                        next.add(abortedId);

                        return next;
                    });
                }

                return;
            }

            // Split "app" view: a cleanly finished turn may have changed data the
            // traditional-app pane displays — let the host refresh it (and act
            // on any app_navigate tool outputs in the finished message).
            shellRef.current.onTurnFinish?.(event.message);

            setTimeout(() => {
                if (finishedConversationId) {
                    queryClient.invalidateQueries({
                        queryKey: getConversationMetaQueryKey(agent._id, finishedConversationId),
                    });
                }
                queryClient.invalidateQueries({ queryKey: getConversationHistoryQueryKey(agent._id) });
                queryClient.invalidateQueries({ queryKey: getConversationFavoritesQueryKey(agent._id) });
                queryClient.invalidateQueries({ queryKey: getConversationAllQueryKey(agent._id) });
            }, USAGE_REFRESH_DELAY_MS);
        },
        [queryClient, agent._id],
    );

    const {
        runtime,
        resolvePersistedMessageId,
        isPersistedMessageId,
        registerPersistedMessageIds,
        resumeAfterReconnect,
        resumeStream,
        streamedConversationId,
        activeConversationId,
        toolProgressStore,
        abortAttach,
    } = useAgentRuntime({
        agentIdentifier: agent.identifier,
        conversationId: externalConversationId,
        newChatEpoch,
        projectId: pendingProjectId,
        model: composerOptions.model,
        parameters: composerOptions.parameters,
        isWebSearchEnabled: composerOptions.isWebSearchEnabled,
        isDeepSearchEnabled: composerOptions.isDeepSearchEnabled,
        isRelatedQuestionsEnabled: agent.uiConfig.home?.search?.isRelatedQuestionsEnabled || false,
        relatedQuestionsCount: agent.uiConfig.home?.search?.relatedQuestionsCount,
        isIncognitoMode: composerOptions.isIncognitoMode,
        isPublic: composerOptions.isPublic,
        files: filesState.files,
        mcpServers: composerOptions.connectors.mcpServers,
        skills: composerOptions.skills.skillArguments,
        apps: agent.apps,
        clientToolNames,
        onConversationId: handleConversationId,
        onTitle: handleTitle,
        onConversationStatus: handleConversationStatus,
        onFinish: handleTurnFinish,
        // The SDK skips onFinish when a resume attach answers 204, so the flag
        // cannot rely on handleTurnFinish alone to clear.
        onSendStart: () => {
            intentionalStopRef.current = false;
        },
    });

    const activeConversationIdRef = useRef<string | null>(activeConversationId);

    activeConversationIdRef.current = activeConversationId;

    const routeConversationIdRef = useRef(routeConversationId);

    // Opening a conversation is what clears its unread mark, whatever route the reader
    // arrived by — sidebar, recents or a cold link.
    useEffect(() => {
        if (routeConversationId) markConversationRead(agent._id, routeConversationId);
    }, [agent._id, routeConversationId]);

    routeConversationIdRef.current = routeConversationId;

    // Memory-routed hosts (app agents) have no URL to read the open conversation back from.
    useEffect(() => {
        shellRef.current.onConversationChange?.(routeConversationId);
    }, [routeConversationId]);

    // The interrupted set is keyed by persisted (server) id — that's what onFinish
    // reports — but a live message renders under its optimistic client id until the
    // thread re-imports. Resolve the rendered id to its server alias before checking.
    const isMessageInterrupted = useCallback(
        (id: string) => {
            if (interruptedMessageIds.has(id)) return true;
            const resolved = resolvePersistedMessageId(id);

            return resolved !== id && interruptedMessageIds.has(resolved);
        },
        [interruptedMessageIds, resolvePersistedMessageId],
    );

    useEffect(() => {
        setInterruptedMessageIds(new Set());
    }, [activeConversationId]);

    const handleHistoryLoaded = useCallback(
        (ids: string[]) => {
            registerPersistedMessageIds(ids);
            setDidConversationLoadFail(false);

            const prompt = pendingBranchPromptRef.current;

            if (!prompt || pendingBranchSentRef.current) return;

            pendingBranchSentRef.current = true;
            pendingBranchPromptRef.current = null;
            navigate(currentLocation.pathname, { replace: true, state: null });
            runtime.thread.append({
                role: 'user',
                content: [{ type: 'text', text: prompt.trim() }],
            });
        },
        [registerPersistedMessageIds, runtime.thread, navigate, currentLocation.pathname],
    );

    // A dead id must not survive as the host's restore point, or every reload lands here again.
    // Registered for the panel only: full-page chat keeps its URL so a refresh can retry.
    const handleConversationNotFound = useCallback(() => {
        // Clearing the host's restore point is not enough — the route still points at the dead
        // id, so a send would post against it.
        shellRef.current.onConversationChange?.(null);
        host.navigation.startNewConversation();
        showInfoToast('That conversation is no longer available, so we started a new chat.');
    }, [host.navigation]);

    // A transient failure must keep both the route and the host's restore point, so a reload
    // retries the same conversation instead of silently forgetting it. The flag holds the chat
    // back from accepting queued app-pane sends, which would otherwise land on an empty thread
    // while the server still holds the real history.
    const [didConversationLoadFail, setDidConversationLoadFail] = useState(false);
    const [conversationReloadEpoch, setConversationReloadEpoch] = useState(0);
    const didLoadFailRef = useRef(false);
    const keepConversationOnLoadError = useCallback(() => {
        didLoadFailRef.current = true;
        setDidConversationLoadFail(true);
    }, []);

    useEffect(() => {
        setDidConversationLoadFail(false);
    }, [routeConversationId]);

    const {
        isConversationLoading,
        branchedFromConversation,
        loadedConversation,
        loadOlderMessages,
        hasMoreOlderMessages,
        isLoadingOlderMessages,
        reloadNewestMessages,
        getNewestMessages,
    } = useConversationLoader({
        runtime,
        agent,
        conversationId: routeConversationId,
        streamedConversationId,
        newChatEpoch,
        reloadEpoch: conversationReloadEpoch,
        onLoadError: isPanelVariant ? keepConversationOnLoadError : undefined,
        onConversationNotFound: isPanelVariant ? handleConversationNotFound : undefined,
        onForeignConversation: setIsForeignConversation,
        onHistoryLoaded: handleHistoryLoaded,
    });

    // Every settled load decides the flag afresh: a load that reports no error clears it, so the
    // app-pane flush cannot stay blocked once the conversation is readable again — including the
    // path where the reader types into the panel and the loader short-circuits on the streamed id.
    useEffect(() => {
        if (isConversationLoading) {
            didLoadFailRef.current = false;

            return;
        }
        setDidConversationLoadFail(didLoadFailRef.current);
    }, [isConversationLoading]);

    // Split "app" view: the host (app pane) pushes a user message into this chat. From home it
    // goes through home-submit so navigation and history behave as a typed message. Registration
    // is the host's flush signal, so it waits for a restored conversation to settle — the
    // loader's thread reset would otherwise wipe a message appended before it.
    useEffect(() => {
        const register = shell.registerExternalSend;

        if (!register || isConversationLoading || didConversationLoadFail) return undefined;

        return register((text) => {
            const message = text.trim();

            if (!message) return;

            if (routeConversationIdRef.current) {
                runtime.thread.append({ role: 'user', content: [{ type: 'text', text: message }] });

                return;
            }
            handleHomeSubmit('chat', { message });
        });
    }, [shell.registerExternalSend, runtime.thread, handleHomeSubmit, isConversationLoading, didConversationLoadFail]);

    useBranchHeadSync({
        runtime,
        agentId: agent._id,
        conversationId: activeConversationId,
        isConversationLoading,
        isForeignConversation: isForeignConversation !== false,
        isIncognitoMode: composerOptions.isIncognitoMode,
        resolvePersistedMessageId,
        isPersistedMessageId,
    });

    const { isPendingGeneration, backgroundReloadNonce, clearPendingGeneration } = useConversationPendingPoll({
        agent,
        conversationId: routeConversationId,
        streamedConversationId,
        isConversationLoading,
        loadedConversation,
        reloadNewestMessages,
        getNewestMessages,
        onHydrated: () => {
            void resumeStream();
        },
    });

    clearPendingGenerationRef.current = clearPendingGeneration;

    // Each new navigation payload (e.g. launching another chat from a project while
    // this view stays mounted) resets the one-shot send guard so it fires again.
    useEffect(() => {
        if (initialPayload) hasSentRef.current = false;
    }, [initialPayload]);

    useEffect(() => {
        if (locationState?.pendingBranchPrompt) {
            pendingBranchPromptRef.current = locationState.pendingBranchPrompt;
            pendingBranchSentRef.current = false;
        }
    }, [locationState?.pendingBranchPrompt]);

    useEffect(() => {
        if (!initialPayload || hasSentRef.current) return;
        if (routeConversationId || isConversationLoading || !isModelPreferenceSettled) return;

        hasSentRef.current = true;
        // A send that somehow bypassed handleHomeSubmit (e.g. a restored history
        // state) hasn't seeded the pending refs — do it here so the created
        // conversation still navigates to its URL and shows in the sidebar.
        if (!pendingModeRef.current) {
            pendingModeRef.current = 'chat';
            pendingTitleRef.current = initialPayload.message;
            pendingIsIncognitoRef.current = isIncognitoRef.current;
        }
        navigate(currentLocation.pathname, { replace: true, state: null });
        runtime.thread.append({
            role: 'user',
            content: [{ type: 'text', text: initialPayload.message.trim() }],
            attachments: initialPayload.attachments,
            metadata: { custom: { fileIds: initialPayload.fileIds || [] } } satisfies MessageMetadataCustom,
        });
    }, [
        initialPayload,
        routeConversationId,
        isConversationLoading,
        isModelPreferenceSettled,
        runtime.thread,
        navigate,
        currentLocation.pathname,
    ]);

    useEffect(
        () => () => {
            runtime.thread.cancelRun();
        },
        [runtime.thread],
    );
    const isThreadBlocked = initialPayload !== null && !hasSentRef.current;

    const markMessageInterrupted = useCallback((messageId: string) => {
        setInterruptedMessageIds((prev) => {
            if (prev.has(messageId)) return prev;
            const next = new Set(prev);

            next.add(messageId);

            return next;
        });
    }, []);

    const handleStopGeneration = useCallback(() => {
        intentionalStopRef.current = true;

        // The AI SDK never threads its abort signal into reconnectToStream, so
        // chat.stop() alone leaves an attached stream writing.
        abortAttach();

        // Kill any local coding tools still executing on this machine; each
        // pending call resolves as a "cancelled" refusal for the paused turn.
        void cancelInFlightLocalTools();

        // Mark the in-flight assistant message interrupted by its live (client) id,
        // which stays stable after the stop — onFinish only knows the server id,
        // which the message won't adopt until a later re-import.
        const threadState = runtime.thread.getState();
        const lastMessage = threadState.messages.at(-1);

        if (lastMessage?.role === 'assistant') {
            markMessageInterrupted(lastMessage.id);
        }

        const conversationId = activeConversationIdRef.current;

        if (!conversationId) return;
        // A turn paused on approval already ended its server run (onFinish
        // unregisters it): a conversation-scoped stop has nothing left to abort
        // there and would only race the new run this call is about to start.
        if (!threadState.isRunning) return;
        void stopChatGeneration({
            agentId: agent._id,
            conversationId,
            baseUrl: host.transport.baseUrl,
            fetch: host.transport.fetch,
            credentials: host.transport.credentials,
        }).catch(() => {});
    }, [agent._id, host.transport, runtime.thread, markMessageInterrupted, abortAttach]);

    // Leaving a conversation mid-stream is a stop, not just a local cancel: without the server
    // call the run keeps writing and the envelope stays `generating` for good.
    const leaveActiveConversation = useCallback(() => {
        if (runtime.thread.getState().isRunning) handleStopGeneration();
        runtime.thread.cancelRun();
    }, [runtime.thread, handleStopGeneration]);

    const handleRecentsSelect = useCallback(
        (conversationId: string) => {
            leaveActiveConversation();

            // Re-picking the conversation already routed to is the retry path after a failed
            // load: navigating there again is a no-op, so the loader is asked to run again. It
            // owns the reset-then-import cycle and the 404 handling, which a bare refetch skips.
            if (conversationId === routeConversationId) {
                setRecentsOpen(false);
                setConversationReloadEpoch((epoch) => epoch + 1);

                return;
            }

            // Recorded before navigating: the router may commit the new route in a transition,
            // and until it does the thread still holds the conversation being left. Without this
            // the reader sees a frame of the old chat before the loader raises its skeleton.
            setSwitchingToConversationId(conversationId);
            host.navigation.setConversationId(conversationId);
            setRecentsOpen(false);
        },
        [leaveActiveConversation, host.navigation, setRecentsOpen, routeConversationId],
    );

    const handleRecentsNewChat = useCallback(() => {
        leaveActiveConversation();
        setSwitchingToConversationId(null);
        host.navigation.startNewConversation();
        setRecentsOpen(false);
    }, [leaveActiveConversation, host.navigation, setRecentsOpen]);

    // The chrome's new-chat button lives in an ancestor of this chat, so it reaches this
    // handler through the lifted recents context.
    useEffect(() => {
        registerNewChat(handleRecentsNewChat);
    }, [registerNewChat, handleRecentsNewChat]);

    const renderRecents = () => {
        if (!isRecentsEnabled || !isRecentsOpen) return null;

        return (
            <RecentsPanel
                agent={agent}
                activeConversationId={routeConversationId}
                onSelectConversation={handleRecentsSelect}
                onNewChat={handleRecentsNewChat}
                onClose={() => setRecentsOpen(false)}
                hideHeader={headerOwnsToggle}
            />
        );
    };

    return (
        <AgentComposerContext.Provider
            value={{
                composer: composerOptions,
                filesState,
                resumeAfterReconnect,
                onStopGeneration: handleStopGeneration,
            }}
        >
            <AssistantRuntimeProvider aui={aui} runtime={runtime}>
                <ToolProgressProvider store={toolProgressStore}>
                    <ToolApprovalProvider>
                        <div className={isPanelVariant ? 'flex h-full min-h-0 flex-col overflow-hidden' : 'contents'}>
                            <ChatKeyboardLayer agent={agent} />
                            <ChatCompletionNotifier agent={agent} />
                            {!isPanelVariant && (
                                <>
                                    <Button
                                        variant="secondary"
                                        className="mobile-menu-button mobile-menu rounded-full"
                                        size="icon-sm"
                                        onClick={handleMobileMenuToggle}
                                    >
                                        <MenuIcon className="flex" />
                                    </Button>
                                    <div
                                        className={cn('mobile-overlay', isMobileMenuOpen && 'visible')}
                                        onClick={handleMobileMenuClose}
                                        role="presentation"
                                    />
                                    <ChatSideBar
                                        agent={agent}
                                        isMobileOpen={isMobileMenuOpen}
                                        liveTurnConversationId={liveTurnConversationId}
                                        onMobileClose={handleMobileMenuClose}
                                    />
                                </>
                            )}
                            <ChatSidePanelProvider resetKey={routeConversationId}>
                                <div
                                    className={cn(
                                        'main-content main-container relative flex min-w-0 flex-1 bg-background',
                                        isPanelVariant && 'h-full min-h-0 overflow-hidden',
                                    )}
                                >
                                    <Routes>
                                        <Route
                                            path=""
                                            // Gate on the settled preference: an ungated first paint flips the composer off the agent default.
                                            element={
                                                isModelPreferenceSettled ? (
                                                    <RootRoute agent={agent} onSubmit={handleHomeSubmit} />
                                                ) : (
                                                    <ChatConversationLoading />
                                                )
                                            }
                                        />
                                        <Route path="search-chat" element={<Recents agent={agent} />} />
                                        {canSeeRoutines && (
                                            <>
                                                <Route
                                                    path="routines"
                                                    element={
                                                        <Routines
                                                            agent={{
                                                                _id: agent._id,
                                                                name: agent.name,
                                                                slug: agent.slug,
                                                            }}
                                                        />
                                                    }
                                                />
                                                <Route
                                                    path="routines/:routineId"
                                                    element={
                                                        <RoutineDetail
                                                            agent={{
                                                                _id: agent._id,
                                                                name: agent.name,
                                                                slug: agent.slug,
                                                            }}
                                                        />
                                                    }
                                                />
                                            </>
                                        )}
                                        {agent.uiConfig.promptLibrary?.enabled && (
                                            <>
                                                <Route
                                                    path="prompt-library"
                                                    element={<PromptLibrary agent={agent} />}
                                                />
                                                <Route
                                                    path="prompt-library/:promptId"
                                                    element={<PromptDetail agent={agent} />}
                                                />
                                            </>
                                        )}
                                        {agent.uiConfig.spaces?.enabled && (
                                            <>
                                                <Route path="spaces" element={<Projects agent={agent} />} />
                                                <Route
                                                    path="spaces/:projectId"
                                                    element={
                                                        <ProjectDetail
                                                            agent={agent}
                                                            onSubmit={(payload) => handleHomeSubmit('chat', payload)}
                                                        />
                                                    }
                                                />
                                                <Route
                                                    path="spaces/:projectId/files"
                                                    element={<ProjectFiles agent={agent} />}
                                                />
                                            </>
                                        )}
                                        {agent.uiConfig.library && (
                                            <Route
                                                path="library"
                                                element={<Library agent={agent} onSubmit={handleHomeSubmit} />}
                                            />
                                        )}
                                        <Route
                                            path="chat/:conversationId?"
                                            element={
                                                <NewChatView
                                                    agent={agent}
                                                    artifactLinksEnabled
                                                    conversationId={routeConversationId}
                                                    isConversationLoading={
                                                        isConversationLoading ||
                                                        isSwitchingConversation ||
                                                        isThreadBlocked ||
                                                        !isModelPreferenceSettled
                                                    }
                                                    isPendingGeneration={isPendingGeneration}
                                                    backgroundReloadNonce={backgroundReloadNonce}
                                                    isForeignConversation={isForeignConversation === true}
                                                    branchedFromConversation={branchedFromConversation}
                                                    isMessageInterrupted={isMessageInterrupted}
                                                    onLoadOlderMessages={loadOlderMessages}
                                                    hasMoreOlderMessages={hasMoreOlderMessages}
                                                    isLoadingOlderMessages={isLoadingOlderMessages}
                                                    spaceMove={chatSpaceMove}
                                                    spaceName={conversationProjectName || null}
                                                />
                                            }
                                        />
                                        <Route path="*" element={<Navigate to="/" />} />
                                    </Routes>
                                    {renderRecents()}
                                </div>
                            </ChatSidePanelProvider>
                        </div>
                    </ToolApprovalProvider>
                </ToolProgressProvider>
                {/* Shared PTY terminal: user-visible AND driven by the agent's `terminal` tool. */}
                <SpaceTerminalDock folderPath={spaceFolderPath} />
                <LocalToolsStatusChip
                    folderPath={spaceFolderPath}
                    spacesEnabled={Boolean(agent.uiConfig.spaces?.enabled)}
                />
            </AssistantRuntimeProvider>
        </AgentComposerContext.Provider>
    );
};

const ChatAgentNew = ({ agent }: { agent: ChatAgentType }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const locationRef = useRef(location);

    locationRef.current = location;
    const user = useSelector(selectUser);
    const tenant = useSelector(selectTenant);
    const { isPreview, variant } = useChatShell();
    const [newChatEpoch, setNewChatEpoch] = useState(0);

    const host = useMemo<ChatHost>(
        () =>
            buildChatHost({
                agent,
                user,
                tenant,
                isPreview,
                navigate,
                getFrom: () => `${locationRef.current.pathname}${locationRef.current.search}`,
                onStartNewConversation: () => setNewChatEpoch((e) => e + 1),
            }),
        [user, tenant, agent, navigate, isPreview],
    );

    return (
        <ChatHostProvider value={host}>
            <div className={variant === 'panel' ? 'flex h-full min-h-0 flex-col overflow-hidden' : 'contents'}>
                <CreateSpaceDialogProvider>
                    <ConversationUsageDialogProvider agent={agent}>
                        <ChatAgentInner agent={agent} newChatEpoch={newChatEpoch} setNewChatEpoch={setNewChatEpoch} />
                    </ConversationUsageDialogProvider>
                </CreateSpaceDialogProvider>
            </div>
        </ChatHostProvider>
    );
};

export default ChatAgentNew;
