import { AssistantRuntimeProvider } from '@assistant-ui/react';
import type { ChatOnFinishCallback } from 'ai';
import { MessagesSquareIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import { AgentFooter } from '@/app/components';
import { useAgentLauncherSidesheet } from '@/app/hooks';
import { TokenUsageDialog } from '@/app/screens/private/screens/agent/components/token-usage-dialog';
import { AgentComposerContext } from '@/components/agent-chat/context/agent-composer-context';
import { ToolApprovalProvider } from '@/components/agent-chat/context/tool-approval-context';
import { useAgentComposerOptions } from '@/components/agent-chat/hooks/use-agent-composer-options';
import { useAgentModelPreferenceSettled } from '@/components/agent-chat/hooks/use-agent-model-preference';
import { useAgentRuntime } from '@/components/agent-chat/hooks/use-agent-runtime';
import { useBranchHeadSync } from '@/components/agent-chat/hooks/use-branch-head-sync';
import { useConversationLoader } from '@/components/agent-chat/hooks/use-conversation-loader';
import { useConversationPendingPoll } from '@/components/agent-chat/hooks/use-conversation-pending-poll';
import { stopChatGeneration } from '@/components/agent-chat/runtime/stop-chat-generation';
import type { ChatAgentLocationState, FluentMindUIMessage, HomeSubmitPayload } from '@/components/agent-chat/types';
import NewChatView from '@/components/agent-chat/view/chat-view';
import ChatHome from '@/components/agent-chat/view/home';
import ChatConversationLoading from '@/components/agent-chat/view/shared/chat-conversation-loading';
import { ToolProgressProvider } from '@/components/chat';
import {
    ChatHostProvider,
    createFluentMindConversationAdapter,
    createFluentMindSession,
    useChatHost,
    type ChatHost,
} from '@/components/chat-host';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { useViewportFillHeight } from '@/hooks';
import { appConversationApi } from '@/lib/api/app/conversation';
import { authAwareFetch } from '@/lib/auth-aware-fetch';
import { getApiBaseUrl, getFilesBaseUrl } from '@/lib/axios';
import { useChatFiles } from '@/lib/chat/use-chat-files';
import { selectTenant, selectUser } from '@/store/selectors';
import type { ChatAgentType, PromptType } from '@/types/admin';
import type { HistoryType, MessageMetadataCustom } from '@/types/chat';

import { Conversations } from './components';

interface Props {
    agent: ChatAgentType;
    basePath?: string;
}

const AgentChatPlaygroundInner = ({ agent, basePath }: Props) => {
    const navigate = useNavigate();
    const location = useLocation();

    const [streamedConversationId, setStreamedConversationId] = useState<string | null>(null);
    const [newChatKey, setNewChatKey] = useState(0);
    const resolvedBasePath = basePath || `/admin/agents/${agent.slug}`;
    const [newConversation, setNewConversation] = useState<HistoryType | null>(null);
    const locationState = location.state as ChatAgentLocationState;
    const initialPayload = locationState?.payload ?? null;

    const hasSentRef = useRef(false);
    const pendingModeRef = useRef<'chat' | null>(null);
    const pendingTitleRef = useRef('');

    const chatMatch = location.pathname.match(/\/chat\/([^/]+)/);
    const routeConversationId = chatMatch?.[1] ?? null;
    const activeConversationId = routeConversationId ?? streamedConversationId;
    const activeConversationIdRef = useRef<string | null>(activeConversationId);

    activeConversationIdRef.current = activeConversationId;
    const [isForeignConversation, setIsForeignConversation] = useState<boolean | null>(null);

    const host = useChatHost();
    const [interruptedMessageIds, setInterruptedMessageIds] = useState<ReadonlySet<string>>(() => new Set());
    const intentionalStopRef = useRef(false);
    const clearPendingGenerationRef = useRef<(finishedConversationId: string | null) => void>(() => {});

    const markMessageInterrupted = useCallback((messageId: string) => {
        setInterruptedMessageIds((prev) => {
            if (prev.has(messageId)) return prev;
            const next = new Set(prev);

            next.add(messageId);

            return next;
        });
    }, []);

    // The Stop button aborts the run locally; onFinish reports the abort with the message's
    // server id, which is the id the interrupted tag is ultimately resolved against.
    const handleTurnFinish = useCallback<ChatOnFinishCallback<FluentMindUIMessage>>(
        (event) => {
            const wasIntentionalStop = intentionalStopRef.current;

            intentionalStopRef.current = false;

            // Only a clean finish or an intentional stop ends the server's turn; a
            // teardown abort, disconnect or error leaves it running.
            const didRunEndHere = wasIntentionalStop || !(event.isAbort || event.isDisconnect || event.isError);

            if (didRunEndHere) {
                clearPendingGenerationRef.current(activeConversationIdRef.current);
            }

            if (event.isAbort && event.message?.id && wasIntentionalStop) {
                markMessageInterrupted(event.message.id);
            }
        },
        [markMessageInterrupted],
    );

    useEffect(() => {
        setIsForeignConversation(null);
    }, [routeConversationId]);

    useEffect(() => {
        if (!routeConversationId || !streamedConversationId || routeConversationId === streamedConversationId) return;
        setStreamedConversationId(null);
    }, [routeConversationId, streamedConversationId]);

    useEffect(() => {
        if (newConversation) {
            setNewConversation(null);
        }
    }, [newConversation]);

    const isIncognitoRef = useRef(false);
    const pendingIsIncognitoRef = useRef(false);
    const filesState = useChatFiles({
        agentId: agent._id,
        isIncognitoMode: () => isIncognitoRef.current,
        getConversationId: () => activeConversationId,
    });
    const composerOptions = useAgentComposerOptions(
        agent,
        () => {
            filesState.fileInputRef.current?.click();
        },
        routeConversationId,
    );

    isIncognitoRef.current = composerOptions.isIncognitoMode;

    // Until the per-user model preference settles, the composer would paint the
    // agent default and then flip when GET /agents/:agentId/preferences lands.
    const isModelPreferenceSettled = useAgentModelPreferenceSettled(agent._id);

    const handleConversationId = useCallback(
        (id: string) => {
            setStreamedConversationId(id);
            if (pendingModeRef.current) {
                if (!pendingIsIncognitoRef.current) {
                    navigate(`${resolvedBasePath}/playground/${pendingModeRef.current}/${id}`, { replace: true });
                    const now = Date.now();

                    setNewConversation({
                        _id: id,
                        title: pendingTitleRef.current || 'New conversation',
                        created_at: now,
                        updated_at: now,
                        generation_status: 'in_progress',
                    });
                }
                pendingModeRef.current = null;
            }
        },
        [navigate, resolvedBasePath],
    );

    const handleNewSubmit = useCallback(
        (mode: 'chat', payload: HomeSubmitPayload) => {
            hasSentRef.current = false;
            setStreamedConversationId(null);
            setNewChatKey((k) => k + 1);
            pendingIsIncognitoRef.current = isIncognitoRef.current;
            pendingModeRef.current = mode;
            pendingTitleRef.current = payload.message.trim();
            navigate(`${resolvedBasePath}/playground/${mode}`, { state: { payload } });
        },
        [navigate, resolvedBasePath],
    );

    const handleTitle = useCallback((conversationId: string, title: string) => {
        if (pendingIsIncognitoRef.current) return;
        const now = Date.now();

        setNewConversation({
            _id: conversationId,
            title,
            created_at: now,
            updated_at: now,
            generation_status: 'in_progress',
        });
    }, []);

    const {
        runtime,
        resolvePersistedMessageId,
        isPersistedMessageId,
        registerPersistedMessageIds,
        resumeAfterReconnect,
        toolProgressStore,
        abortAttach,
        resumeStream,
    } = useAgentRuntime({
        agentIdentifier: agent.identifier,
        conversationId: activeConversationId,
        model: composerOptions.model,
        parameters: composerOptions.parameters,
        isWebSearchEnabled: composerOptions.isWebSearchEnabled,
        isDeepSearchEnabled: composerOptions.isDeepSearchEnabled,
        isRelatedQuestionsEnabled: agent.uiConfig.home?.search?.isRelatedQuestionsEnabled ?? false,
        relatedQuestionsCount: agent.uiConfig.home?.search?.relatedQuestionsCount,
        isIncognitoMode: composerOptions.isIncognitoMode,
        isPublic: composerOptions.isPublic,
        files: filesState.files,
        mcpServers: composerOptions.connectors.mcpServers,
        skills: composerOptions.skills.skillArguments,
        apps: agent.apps,
        onConversationId: handleConversationId,
        onTitle: handleTitle,
        onFinish: handleTurnFinish,
        // The SDK skips onFinish when a resume attach answers 204, so the flag
        // cannot rely on handleTurnFinish alone to clear.
        onSendStart: () => {
            intentionalStopRef.current = false;
        },
    });

    const handleLoadError = useCallback(() => {
        navigate(`${resolvedBasePath}/playground/new`);
    }, [navigate, resolvedBasePath]);

    const handlePromptAdded = useCallback(
        (prompt: PromptType) => {
            navigate(`/admin/prompts/${prompt._id}`);
        },
        [navigate],
    );

    const {
        isConversationLoading,
        branchedFromConversation,
        loadOlderMessages,
        hasMoreOlderMessages,
        isLoadingOlderMessages,
        loadedConversation,
        reloadNewestMessages,
        getNewestMessages,
    } = useConversationLoader({
        runtime,
        agent,
        conversationId: routeConversationId,
        streamedConversationId,
        newChatEpoch: newChatKey,
        onLoadError: handleLoadError,
        onForeignConversation: setIsForeignConversation,
        onHistoryLoaded: registerPersistedMessageIds,
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

    useEffect(() => {
        if (!initialPayload || hasSentRef.current) return;
        if (routeConversationId || isConversationLoading || !isModelPreferenceSettled) return;

        hasSentRef.current = true;
        // A send that bypassed handleNewSubmit (e.g. a restored history state) hasn't
        // seeded the pending refs, so the created conversation would miss its URL and
        // the sidebar entry.
        if (!pendingModeRef.current) {
            pendingModeRef.current = 'chat';
            pendingTitleRef.current = initialPayload.message;
            pendingIsIncognitoRef.current = isIncognitoRef.current;
        }
        navigate(location.pathname, { replace: true, state: null });
        runtime.thread.append({
            role: 'user',
            content: [{ type: 'text', text: initialPayload.message.trim() }],
            attachments: initialPayload.attachments,
            metadata: { custom: { fileIds: initialPayload.fileIds ?? [] } } satisfies MessageMetadataCustom,
        });
    }, [
        initialPayload,
        routeConversationId,
        isConversationLoading,
        isModelPreferenceSettled,
        runtime.thread,
        navigate,
        location.pathname,
    ]);

    useEffect(
        () => () => {
            runtime.thread.cancelRun();
        },
        [runtime.thread],
    );

    // Keyed by the message's live (client) id at stop time; resolve to the persisted
    // (server) alias when checking, since a rendered message adopts the server id later.
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

    const handleStopGeneration = useCallback(() => {
        intentionalStopRef.current = true;

        // The AI SDK never threads its abort signal into reconnectToStream, so
        // chat.stop() alone leaves an attached stream writing.
        abortAttach();

        const lastMessage = runtime.thread.getState().messages.at(-1);

        if (lastMessage?.role === 'assistant') {
            markMessageInterrupted(lastMessage.id);
        }

        const conversationId = activeConversationIdRef.current;

        if (!conversationId) return;
        void stopChatGeneration({
            agentId: agent._id,
            conversationId,
            baseUrl: host.transport.baseUrl,
            fetch: host.transport.fetch,
            credentials: host.transport.credentials,
        }).catch(() => {});
    }, [agent._id, host.transport, runtime.thread, markMessageInterrupted, abortAttach]);

    const isThreadBlocked = initialPayload !== null && !hasSentRef.current;

    const rootRef = useRef<HTMLDivElement>(null);

    useViewportFillHeight(rootRef, { cssVar: '--agent-playground-h' });

    const renderChatHome = () => {
        if (!isModelPreferenceSettled) return <ChatConversationLoading />;

        return (
            <ChatHome
                agent={agent}
                isFromAdmin
                resetKey={location.key}
                onSubmit={(payload) => handleNewSubmit('chat', payload)}
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
            <AssistantRuntimeProvider runtime={runtime}>
                <ToolProgressProvider store={toolProgressStore}>
                    <ToolApprovalProvider>
                        <div
                            ref={rootRef}
                            className="tab-content conversations-tab flex h-(--agent-playground-h,calc(100svh-48px-83px)) min-h-0 flex-col"
                        >
                            <ResizablePanelGroup orientation="horizontal">
                                <ResizablePanel
                                    minSize="0%"
                                    defaultSize="20%"
                                    maxSize="40%"
                                    className="scrollbar-controller scrollbar-vertical scrollbar-horizontal"
                                >
                                    <Conversations
                                        agent={agent}
                                        newConversation={newConversation}
                                        basePath={resolvedBasePath}
                                    />
                                </ResizablePanel>
                                <ResizableHandle withHandle />
                                <ResizablePanel minSize="30%" defaultSize="80%">
                                    <Routes>
                                        <Route
                                            path=""
                                            element={
                                                <div className="no-conversation flex h-full flex-col items-center justify-center gap-4 bg-background px-6 text-center">
                                                    <div className="flex size-20 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
                                                        <MessagesSquareIcon className="size-10" />
                                                    </div>
                                                    <div className="flex max-w-sm flex-col items-center gap-1.5">
                                                        <span className="text-base font-medium text-foreground">
                                                            Select a conversation
                                                        </span>
                                                        <span className="text-sm leading-5 text-muted-foreground">
                                                            Choose a conversation from the list on the left, or start a
                                                            new one to begin chatting.
                                                        </span>
                                                    </div>
                                                </div>
                                            }
                                        />
                                        <Route path="new" element={renderChatHome()} />
                                        <Route
                                            path="chat/:conversationId?"
                                            element={
                                                <NewChatView
                                                    agent={agent}
                                                    conversationId={routeConversationId}
                                                    isConversationLoading={
                                                        isConversationLoading ||
                                                        isThreadBlocked ||
                                                        !isModelPreferenceSettled
                                                    }
                                                    isFromAdmin
                                                    branchedFromConversation={branchedFromConversation}
                                                    isMessageInterrupted={isMessageInterrupted}
                                                    onPromptAdded={handlePromptAdded}
                                                    onLoadOlderMessages={loadOlderMessages}
                                                    hasMoreOlderMessages={hasMoreOlderMessages}
                                                    isLoadingOlderMessages={isLoadingOlderMessages}
                                                    isPendingGeneration={isPendingGeneration}
                                                    backgroundReloadNonce={backgroundReloadNonce}
                                                />
                                            }
                                        />
                                        <Route path="*" element={<Navigate to="new" />} />
                                    </Routes>
                                </ResizablePanel>
                            </ResizablePanelGroup>
                        </div>
                    </ToolApprovalProvider>
                </ToolProgressProvider>
            </AssistantRuntimeProvider>
        </AgentComposerContext.Provider>
    );
};

const AgentChatPlaygroundNew = ({ agent, basePath }: Props) => {
    const navigate = useNavigate();
    const user = useSelector(selectUser);
    const tenant = useSelector(selectTenant);
    const resolvedBasePath = basePath || `/admin/agents/${agent.slug}`;

    const host = useMemo<ChatHost>(
        () => ({
            session: createFluentMindSession(user, tenant),
            transport: {
                endpoint: `${getApiBaseUrl()}/ai/chat`,
                baseUrl: getApiBaseUrl(),
                filesBaseUrl: getFilesBaseUrl(),
                fetch: authAwareFetch,
                credentials: 'include',
            },
            conversations: createFluentMindConversationAdapter(appConversationApi, { agentId: agent._id }),
            navigation: {
                setConversationId: (id, opts) => {
                    if (id) navigate(`${resolvedBasePath}/playground/chat/${id}`, { replace: opts?.replace });
                },
                startNewConversation: () => navigate(`${resolvedBasePath}/playground/new`),
            },
            slots: {
                useAgentLauncher: useAgentLauncherSidesheet,
                renderFooter: () => <AgentFooter />,
                renderTokenUsageDialog: (props) => <TokenUsageDialog {...props} />,
                renderConversationLink: (conversationId, children) => (
                    <Link to={`${resolvedBasePath}/playground/chat/${conversationId}`}>{children}</Link>
                ),
            },
        }),
        [user, tenant, agent._id, resolvedBasePath, navigate],
    );

    return (
        <ChatHostProvider value={host}>
            <AgentChatPlaygroundInner agent={agent} basePath={basePath} />
        </ChatHostProvider>
    );
};

export default AgentChatPlaygroundNew;
