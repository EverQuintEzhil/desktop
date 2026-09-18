import { AssistantRuntimeProvider } from '@assistant-ui/react';
import { useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';

import { InfiniteScrollTrigger } from '@/components';
import { AgentComposerContext } from '@/components/agent-chat/context/agent-composer-context';
import { ToolApprovalProvider } from '@/components/agent-chat/context/tool-approval-context';
import { WidgetSendContext } from '@/components/agent-chat/genui/widget-send-context';
import { useAgentComposerOptions } from '@/components/agent-chat/hooks/use-agent-composer-options';
import { buildConversationRepository } from '@/components/agent-chat/runtime/build-conversation-repository';
import type { ChatViewContextValue, FluentMindUIMessage } from '@/components/agent-chat/types';
import { ChatThread } from '@/components/agent-chat/view/chat-thread';
import { ChatViewContext } from '@/components/agent-chat/view/chat-view-context';
import {
    createToolProgressStore,
    SelectionQuoteProvider,
    ToolProgressProvider,
    useChatRuntimeFromConfig,
    type SelectionQuoteContextValue,
} from '@/components/chat';
import {
    ChatHostProvider,
    createFluentMindSession,
    createUnsupportedConversationAdapter,
    type ChatHost,
} from '@/components/chat-host';
import Spinner from '@/components/ui/spinner';
import { useInfiniteScroll } from '@/hooks';
import { authAwareFetch } from '@/lib/auth-aware-fetch';
import { getApiBaseUrl, getFilesBaseUrl } from '@/lib/axios';
import { useChatFiles } from '@/lib/chat/use-chat-files';
import { selectTenant, selectUser } from '@/store/selectors';
import type { ChatAgentType } from '@/types/admin';

import { usePreviewMessages } from './hooks/use-preview-messages';
import { toConversationMessages } from './utils/to-conversation-messages';

export interface ConversationPreviewProps {
    agent: ChatAgentType;
    conversationId: string;
}

const noop = () => {};

/**
 * Everything that depends on the chat host lives here: the host itself is created
 * by the outer component, so a hook reaching for it (`useAgentComposerOptions` ->
 * `useAgentConnectors` -> `useChatHost`) must run below `ChatHostProvider`.
 */
const PreviewThread = (props: ConversationPreviewProps) => {
    const { agent, conversationId } = props;

    const user = useSelector(selectUser);

    const { messages, headId, isLoading, isError, hasMoreNewerMessages, isLoadingNewerMessages, loadNewerMessages } =
        usePreviewMessages({ agentId: agent._id, conversationId });

    const { loadMoreRef } = useInfiniteScroll({
        loading: isLoading,
        showMoreLoading: isLoadingNewerMessages,
        hasMore: hasMoreNewerMessages,
        itemsLength: messages.length,
        onLoadMore: loadNewerMessages,
    });

    const filesState = useChatFiles({ agentId: agent._id });
    const composer = useAgentComposerOptions(agent, noop);
    const toolProgressStore = useMemo(() => createToolProgressStore(), []);

    const { runtime } = useChatRuntimeFromConfig<FluentMindUIMessage>({
        api: `${getApiBaseUrl()}/ai/chat`,
        conversationId,
        prepareRequestBody: () => ({ body: {} }),
    });

    const chatViewContextValue = useMemo<ChatViewContextValue>(
        () => ({
            agent,
            conversationId,
            onShowSources: noop,
            onShowResearch: noop,
            activeResearchMessageId: null,
            onShowArtifact: noop,
            activeArtifactId: null,
            isFromAdmin: true,
            isForeignConversation: true,
            isReadOnly: true,
            onEditStart: noop,
            onEditEnd: noop,
            branchedFromConversation: null,
        }),
        [agent, conversationId],
    );

    // A quote can only land in a composer, and the preview has none.
    const selectionQuoteContextValue = useMemo<SelectionQuoteContextValue>(
        () => ({
            pendingQuote: null,
            setPendingQuote: noop,
            clearPendingQuote: noop,
        }),
        [],
    );

    const chronologicalMessages = useMemo(() => toConversationMessages(messages), [messages]);

    useEffect(() => {
        if (chronologicalMessages.length === 0) return;
        if (runtime.thread.getState().isRunning) return;

        const repository = buildConversationRepository({
            messages: chronologicalMessages,
            userId: user?._id ?? undefined,
            activeLeafMessageId: headId,
        });

        if (repository.messages.length === 0) return;

        runtime.thread.importExternalState(repository);
    }, [chronologicalMessages, headId, runtime, user?._id]);

    const renderThread = () => {
        if (isLoading) {
            return (
                <div className="flex min-h-0 flex-1 items-center justify-center">
                    <Spinner className="scale-150" />
                </div>
            );
        }

        if (isError) {
            return (
                <div className="flex min-h-0 flex-1 items-center justify-center">
                    <span className="text-sm font-medium text-text-secondary">Could not load this conversation.</span>
                </div>
            );
        }

        return (
            <ChatThread
                composer={null}
                className="flex min-h-0 flex-1 flex-col"
                viewportClassName="conversation-panel"
                messagesClassName="message-list conversation-block mx-auto flex w-full max-w-[760px] flex-col gap-6 px-4"
                afterMessages={
                    <InfiniteScrollTrigger
                        isLoading={isLoadingNewerMessages}
                        hasMore={hasMoreNewerMessages}
                        loadMoreRef={loadMoreRef}
                    />
                }
                enableMessageNav
                scrollToBottomOnLoad={false}
            />
        );
    };

    return (
        <AssistantRuntimeProvider runtime={runtime}>
            <ToolProgressProvider store={toolProgressStore}>
                <ToolApprovalProvider>
                    <AgentComposerContext.Provider value={{ composer, filesState }}>
                        <ChatViewContext.Provider value={chatViewContextValue}>
                            <SelectionQuoteProvider value={selectionQuoteContextValue}>
                                <WidgetSendContext.Provider value={noop}>{renderThread()}</WidgetSendContext.Provider>
                            </SelectionQuoteProvider>
                        </ChatViewContext.Provider>
                    </AgentComposerContext.Provider>
                </ToolApprovalProvider>
            </ToolProgressProvider>
        </AssistantRuntimeProvider>
    );
};

const ConversationPreview = (props: ConversationPreviewProps) => {
    const { agent, conversationId } = props;

    const user = useSelector(selectUser);
    const tenant = useSelector(selectTenant);

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
            conversations: createUnsupportedConversationAdapter(),
            navigation: { setConversationId: noop, startNewConversation: noop },
            slots: { hidePromptLibrary: true },
        }),
        [user, tenant],
    );

    return (
        <ChatHostProvider value={host}>
            <PreviewThread agent={agent} conversationId={conversationId} />
        </ChatHostProvider>
    );
};

export default ConversationPreview;
