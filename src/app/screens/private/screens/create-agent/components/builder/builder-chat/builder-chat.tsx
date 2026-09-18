import { AssistantRuntimeProvider, AuiIf, ThreadPrimitive } from '@assistant-ui/react';
import { useQueryClient } from '@tanstack/react-query';
import type { UIMessage } from 'ai';
import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
    type ChangeEvent,
} from 'react';
import { useSelector } from 'react-redux';

import {
    ChatHostProvider,
    createFluentMindSession,
    createUnsupportedConversationAdapter,
    type ChatHost,
} from '@/components/chat-host';
import ScrollToBottomButton from '@/components/chat/primitives/scroll-to-bottom-button';
import Dropzone from '@/components/dropzone';
import type { DropDownValueObject } from '@/components/ui/dropdown-menu';
import { PREVIEW_AGENT_DETAIL_KEY } from '@/lib/api/common/agent-cache';
import { authAwareFetch } from '@/lib/auth-aware-fetch';
import { getApiBaseUrl, getFilesBaseUrl } from '@/lib/axios';
import { filesToAttachments, getUploadedFileIds } from '@/lib/chat/file-attachments';
import { useChatFiles } from '@/lib/chat/use-chat-files';
import { cn } from '@/lib/utils';
import { selectTenant } from '@/store/selectors';
import type { ModelValueType } from '@/types/admin';
import type { FileType, MessageMetadataCustom } from '@/types/chat';

import { MY_AGENTS_QUERY_KEY } from '../../../../agents/hooks/use-agents-queries';
import { useCreateAgentRuntime } from '../../../hooks';
import type { CreateAgentConversation } from '../../../lib/builder-conversations-api';
import type { AgentConfigDraft } from '../../../types';

import ChatMessage from './components/chat-message';
import ComposerArea from './components/composer-area';
import EmptyState from './components/empty-state';
import TopBar from './components/top-bar';
import { FILE_ACCEPT } from './constants';
import { useBuilderTools } from './frontend-tools';
import { MessagesErrorPanel } from './messages-error-panel';
import { RecentsPanel } from './recents-panel';
import type { SidebarView } from './types';
import { useBuilderModelSelection } from './use-builder-model-selection';
import './builder-chat.scss';

interface BuilderChatProps {
    onAgentConfig: (config: AgentConfigDraft) => void;
    onConversationId: (id: string) => void;
    initialPrompt?: string;
    initialFiles?: FileType[];
    initialMessages?: UIMessage[];
    restoreInitialMessages?: boolean;
    agentId: string;
    activeConversationId: string | null;
    conversations: CreateAgentConversation[];
    conversationsHasMore: boolean;
    conversationsLoadingMore: boolean;
    conversationsError: boolean;
    conversationsLoadMoreError: boolean;
    onLoadMoreConversations: () => void;
    onRetryConversations: () => void;
    messagesError: boolean;
    onRetryMessages: () => void;
    onNewChat: () => void;
    onSelectConversation: (conversationId: string) => void;
    onBack?: () => void;
    onOpenPreview: () => void;
    onClosePreview: () => void;
    onOpenSettings: () => void;
}

export interface BuilderChatHandle {
    sendMessage: (message: string) => void;
}

const BuilderChatInner = forwardRef<
    BuilderChatHandle,
    BuilderChatProps & {
        runtime: ReturnType<typeof useCreateAgentRuntime>['runtime'];
        availableModels: DropDownValueObject<ModelValueType>[];
        selectedModel: DropDownValueObject<ModelValueType> | null;
        onSelectModel: (model: DropDownValueObject<ModelValueType> | null) => void;
        isModelsReady: boolean;
    }
>(
    (
        {
            initialPrompt,
            initialFiles,
            runtime,
            agentId,
            onBack,
            conversations,
            conversationsHasMore,
            conversationsLoadingMore,
            conversationsError,
            conversationsLoadMoreError,
            onLoadMoreConversations,
            onRetryConversations,
            activeConversationId,
            onNewChat,
            onSelectConversation,
            messagesError,
            onRetryMessages,
            availableModels,
            selectedModel,
            onSelectModel,
            isModelsReady,
        },
        ref,
    ) => {
        const sentRef = useRef(false);
        const viewportRef = useRef<HTMLDivElement>(null);
        const [view, setView] = useState<SidebarView>('chat');
        const { files, isUploading, fileInputRef, setFiles, onChangeFile, clearFiles, retryUpload } = useChatFiles({
            agentId,
            getConversationId: () => activeConversationId,
        });

        const appendMessage = useCallback(
            (message: string, overrideFiles?: FileType[]) => {
                const messageFiles = overrideFiles ?? files;

                runtime.thread.append({
                    role: 'user',
                    content: [{ type: 'text', text: message }],
                    attachments: filesToAttachments(messageFiles),
                    metadata: { custom: { fileIds: getUploadedFileIds(messageFiles) } } satisfies MessageMetadataCustom,
                });

                clearFiles();
            },
            [runtime.thread, files, clearFiles],
        );

        useImperativeHandle(ref, () => ({ sendMessage: appendMessage }), [appendMessage]);

        useEffect(() => {
            if (!initialPrompt || sentRef.current || !isModelsReady) return;
            sentRef.current = true;
            appendMessage(initialPrompt, initialFiles);
            // Mount-only send once models have settled; appendMessage is intentionally omitted.
        }, [isModelsReady]);

        const handleSuggestion = (label: string) => {
            appendMessage(label);
        };

        const handleRemoveFile = (index: number) => {
            setFiles(files.filter((_, fileIndex) => fileIndex !== index));
        };

        const handleNewChat = () => {
            runtime.thread.cancelRun();
            onNewChat();
        };

        const handleSelectConversation = (conversationId: string) => {
            runtime.thread.cancelRun();
            onSelectConversation(conversationId);
            setView('chat');
        };

        const handleToggleRecents = () => {
            setView((current) => (current === 'recents' ? 'chat' : 'recents'));
        };

        const renderComposer = () => {
            // With no history loaded, an appended turn would reach the model without the
            // conversation it belongs to, so the composer stays out until a retry succeeds.
            if (view === 'recents' || messagesError) return null;

            return (
                <ComposerArea
                    files={files}
                    fileInputRef={fileInputRef}
                    isUploading={isUploading}
                    onChangeFile={onChangeFile}
                    onRemoveFile={handleRemoveFile}
                    onRetryFile={retryUpload}
                    onSubmit={appendMessage}
                    availableModels={availableModels}
                    selectedModel={selectedModel}
                    onSelectModel={onSelectModel}
                />
            );
        };

        const renderBody = () => {
            if (view === 'recents') {
                return (
                    <RecentsPanel
                        conversations={conversations}
                        activeConversationId={activeConversationId ?? ''}
                        hasMore={conversationsHasMore}
                        loadingMore={conversationsLoadingMore}
                        isError={conversationsError}
                        loadMoreError={conversationsLoadMoreError}
                        onRetry={onRetryConversations}
                        onLoadMore={onLoadMoreConversations}
                        onSelectConversation={handleSelectConversation}
                    />
                );
            }

            if (messagesError) {
                // TopBar hides its New chat button behind `AuiIf !thread.isEmpty`, which a failed
                // load never satisfies, so the panel carries a new-chat action of its own.
                return <MessagesErrorPanel onRetry={onRetryMessages} onNewChat={handleNewChat} />;
            }

            return (
                <ThreadPrimitive.Viewport
                    ref={viewportRef}
                    turnAnchor="top"
                    topAnchorMessageClamp={{ tallerThan: '999em', visibleHeight: '100em' }}
                    data-slot="aui_thread-viewport"
                    className={cn(
                        'builder-chat-viewport flex min-h-0 flex-1 flex-col p-4',
                        'scrollbar-controller scrollbar-vertical relative min-w-0 overflow-x-hidden scroll-smooth',
                        'scrollbar-gutter-stable transition-[width] duration-200',
                    )}
                    autoScroll={false}
                    scrollToBottomOnInitialize={false}
                    scrollToBottomOnThreadSwitch={false}
                >
                    <AuiIf condition={(s) => s.thread.isEmpty}>
                        <EmptyState onSuggestion={handleSuggestion} />
                    </AuiIf>

                    <div className="flex flex-col gap-4">
                        <ThreadPrimitive.Messages>{() => <ChatMessage />}</ThreadPrimitive.Messages>
                    </div>

                    <ThreadPrimitive.ViewportFooter className="sticky bottom-0 mt-auto flex flex-col overflow-visible">
                        <ScrollToBottomButton />
                    </ThreadPrimitive.ViewportFooter>
                </ThreadPrimitive.Viewport>
            );
        };

        return (
            <aside
                className={cn(
                    'builder-chat-aside flex h-full flex-col overflow-hidden bg-background',
                    'w-full',
                    'text-(--text-primary)',
                )}
            >
                <Dropzone
                    multiple
                    global
                    accept={FILE_ACCEPT}
                    onChange={onChangeFile as (e: ChangeEvent<HTMLInputElement>) => void}
                    uploading={isUploading}
                    className="builder-chat-dropzone flex min-h-0 flex-1 flex-col overflow-hidden"
                >
                    <TopBar
                        view={view}
                        onBack={onBack}
                        onNewChat={handleNewChat}
                        onToggleRecents={handleToggleRecents}
                    />

                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{renderBody()}</div>

                    {renderComposer()}
                </Dropzone>
            </aside>
        );
    },
);

BuilderChatInner.displayName = 'BuilderChatInner';

const BuilderChat = forwardRef<BuilderChatHandle, BuilderChatProps>(
    (
        {
            onAgentConfig,
            onConversationId,
            initialPrompt,
            initialFiles,
            initialMessages,
            restoreInitialMessages,
            agentId,
            activeConversationId,
            conversations,
            conversationsHasMore,
            conversationsLoadingMore,
            conversationsError,
            conversationsLoadMoreError,
            onLoadMoreConversations,
            onRetryConversations,
            messagesError,
            onRetryMessages,
            onNewChat,
            onSelectConversation,
            onBack,
            onOpenPreview,
            onClosePreview,
            onOpenSettings,
        },
        ref,
    ) => {
        const { availableModels, selectedModel, setSelectedModel, getModelId, isModelsReady } =
            useBuilderModelSelection();
        const { runtime } = useCreateAgentRuntime({
            onAgentConfig,
            onConversationId,
            agentId,
            conversationId: activeConversationId,
            initialMessages,
            restoreInitialMessages,
            getModelId,
        });
        const queryClient = useQueryClient();
        const tenant = useSelector(selectTenant);

        const host = useMemo<ChatHost>(
            () => ({
                session: createFluentMindSession(null, tenant),
                transport: {
                    endpoint: `${getApiBaseUrl()}/ai/chat`,
                    baseUrl: getApiBaseUrl(),
                    filesBaseUrl: getFilesBaseUrl(),
                    fetch: authAwareFetch,
                    credentials: 'include',
                },
                navigation: {
                    setConversationId: (id) => {
                        if (id) sessionStorage.setItem(`create-agent:${agentId}:conversationId`, id);
                    },
                    startNewConversation: () => sessionStorage.removeItem(`create-agent:${agentId}:conversationId`),
                },
                conversations: createUnsupportedConversationAdapter(),
            }),
            [tenant, agentId],
        );

        const handleRefreshAgent = useCallback(() => {
            void queryClient.invalidateQueries({ queryKey: ['create-agent-agent', agentId] });
            void queryClient.invalidateQueries({ queryKey: [...PREVIEW_AGENT_DETAIL_KEY, agentId] });
            // The builder can rename the agent server-side, and `synchronizePersistedState` re-baselines
            // the autosave snapshot, so the rename effect in `useAgentAutosave` never sees this change.
            void queryClient.invalidateQueries({ queryKey: MY_AGENTS_QUERY_KEY });
        }, [agentId, queryClient]);

        const aui = useBuilderTools({
            onOpenPreview,
            onClosePreview,
            onRefreshAgent: handleRefreshAgent,
            onOpenSettings,
        });

        return (
            <ChatHostProvider value={host}>
                <AssistantRuntimeProvider aui={aui} runtime={runtime}>
                    <ThreadPrimitive.Root className="flex h-full w-full flex-col">
                        <BuilderChatInner
                            ref={ref}
                            onAgentConfig={onAgentConfig}
                            onConversationId={onConversationId}
                            initialPrompt={initialPrompt}
                            initialFiles={initialFiles}
                            restoreInitialMessages={restoreInitialMessages}
                            agentId={agentId}
                            activeConversationId={activeConversationId}
                            conversations={conversations}
                            conversationsHasMore={conversationsHasMore}
                            conversationsLoadingMore={conversationsLoadingMore}
                            conversationsError={conversationsError}
                            conversationsLoadMoreError={conversationsLoadMoreError}
                            onLoadMoreConversations={onLoadMoreConversations}
                            onRetryConversations={onRetryConversations}
                            messagesError={messagesError}
                            onRetryMessages={onRetryMessages}
                            onNewChat={onNewChat}
                            onSelectConversation={onSelectConversation}
                            onBack={onBack}
                            onOpenPreview={onOpenPreview}
                            onClosePreview={onClosePreview}
                            onOpenSettings={onOpenSettings}
                            runtime={runtime}
                            availableModels={availableModels}
                            selectedModel={selectedModel}
                            onSelectModel={setSelectedModel}
                            isModelsReady={isModelsReady}
                        />
                    </ThreadPrimitive.Root>
                </AssistantRuntimeProvider>
            </ChatHostProvider>
        );
    },
);

BuilderChat.displayName = 'BuilderChat';

export default BuilderChat;
