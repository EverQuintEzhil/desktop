import type { McpUiResourceCsp } from '@modelcontextprotocol/ext-apps/app-bridge';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';

import { InfiniteScrollTrigger } from '@/components';
import Spinner from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useInfiniteScroll } from '@/hooks';
import { appConversationApi } from '@/lib/api/app/conversation';
import type { ChatAgentType } from '@/types/admin';

import MetaHeader from '../meta-header';

import { ChatNoGroupAdmin } from './chat-group';
import ConversationPreview from './conversation-preview';

export interface ContentItemText {
    type: 'text';
    text: string;
    state: string;
    providerMetadata?: Record<string, unknown>;
}

export interface ContentItemStepStart {
    type: 'step-start';
}

export interface ContentItemDataConversation {
    type: 'data-conversation';
    data: {
        conversation_id: string;
        status: string;
        message_id?: string;
    };
    transient: boolean;
}

export interface ContentItemTool {
    type: `tool-${string}` | 'dynamic-tool';
    toolName?: string;
    toolCallId: string;
    state: string;
    input?: Record<string, unknown>;
    output: unknown;
    errorText?: string;
    approval?: unknown;
    callProviderMetadata?: Record<string, unknown>;
    resultProviderMetadata?: Record<string, unknown>;
    providerExecuted?: boolean;
}

export interface ContentItemDataGenui {
    type: 'data-genui';
    id?: string;
    data: {
        toolCallId: string;
        appId: string;
        refName: string;
        version: string;
        bundleUrl: string;
        props: Record<string, unknown>;
        display?: { framed?: boolean; maxWidth?: string };
    };
    transient?: boolean;
}

export interface ContentItemDataMcpui {
    type: 'data-mcpui';
    id?: string;
    data: {
        toolCallId: string;
        serverId: string;
        toolName: string;
        html: string;
        csp?: McpUiResourceCsp;
        toolInput?: Record<string, unknown>;
        toolResult?: CallToolResult;
        resourceUri?: string;
    };
    transient?: boolean;
}

export interface AdminSource {
    site_name: string;
    thumbnail: string;
    favicon: string;
    description: string;
    title: string;
    type: string;
    url: string;
}

export interface ContentItemDataSources {
    type: 'data-sources';
    data: AdminSource[];
    transient: boolean;
    id: string;
}

export type AdminContentItem =
    | ContentItemText
    | ContentItemStepStart
    | ContentItemDataConversation
    | ContentItemTool
    | ContentItemDataGenui
    | ContentItemDataMcpui
    | ContentItemDataSources;

export interface AdminMessageFile {
    _id: string;
    name: string;
    extension?: string;
    type?: string;
    ai?: unknown;
}

export interface AdminDataStoreFile {
    name: string;
    ai?: unknown;
    mediaType?: string;
    storeId: string;
    type?: string;
    fileId: string;
}

export interface AdminConversationMessage {
    _id: string;
    role: 'user' | 'assistant';
    user_id: string;
    conversation_id: string;
    parent_id: string | null;
    created_at: string;
    reasoning: string | null;
    ai_info: {
        token_usage?: {
            total_tokens?: number | null;
            output_tokens?: number | null;
            reasoning_tokens?: number | null;
            input_tokens?: number | null;
            cached_input_tokens?: number | null;
            cache_write_input_tokens?: number | null;
            total_tokens_co2?: number | null;
            input_tokens_co2?: number | null;
            cached_input_tokens_co2?: number | null;
            cache_write_input_tokens_co2?: number | null;
            output_tokens_co2?: number | null;
            reasoning_tokens_co2?: number | null;
            co2_multiplier_per_token?: number | null;
        } | null;
        provider: string;
        model: string;
    } | null;
    metadata: {
        rating: number | null;
        sources?: AdminSource[];
        files?: AdminMessageFile[];
        dataStoreFiles?: AdminDataStoreFile[];
        genui_state?: Record<string, unknown>;
        partial?: boolean;
        pending?: boolean;
        error?: string;
        tool_durations?: Record<string, number>;
        reasoning_ms?: number;
    } | null;
    content: AdminContentItem[];
}

type ConversationView = 'inspect' | 'preview';

const TAB_TRIGGER_CLASS =
    'h-7 rounded-t-xs rounded-b-none border-b-2 border-transparent px-2 py-1 text-sm font-medium ' +
    'text-text-secondary after:hidden hover:bg-background hover:text-primary ' +
    'data-[state=active]:border-b-primary data-[state=active]:bg-background data-[state=active]:text-primary';

interface Props {
    agent: ChatAgentType;
}

const ChatDetails = (props: Props) => {
    const { agent } = props;

    const { conversationId } = useParams();
    const [view, setView] = useState<ConversationView>('inspect');
    const [state, setState] = useState<{
        loading: boolean;
        error: boolean;
        messages: AdminConversationMessage[];
        page: number;
        pages: number;
        showMoreLoading: boolean;
    }>({
        loading: true,
        error: false,
        messages: [],
        page: 0,
        pages: 0,
        showMoreLoading: false,
    });

    const fetchConversation = useCallback(
        async (pageNo: number, reset: boolean = false) => {
            if (!conversationId) return;

            try {
                if (reset) {
                    setState((prev) => ({ ...prev, loading: true }));
                } else {
                    setState((prev) => ({ ...prev, showMoreLoading: true }));
                }

                const result = await appConversationApi.getAdminConversationMessages<AdminConversationMessage>(
                    conversationId,
                    { agentId: agent._id, size: 20, page: pageNo },
                );

                setState((prev) => ({
                    loading: false,
                    error: false,
                    messages: reset ? result.values : [...prev.messages, ...result.values],
                    page: result.pageInfo.page,
                    pages: result.pageInfo.totalPages,
                    showMoreLoading: false,
                }));
            } catch (err) {
                console.error('Failed to fetch conversation messages:', err);
                setState((prev) => ({
                    ...prev,
                    loading: false,
                    error: true,
                    showMoreLoading: false,
                    messages: reset ? [] : prev.messages,
                }));
            }
        },
        [conversationId, agent._id],
    );

    const onShowMore = useCallback(() => {
        if (state.page < state.pages - 1) {
            fetchConversation(state.page + 1, false);
        }
    }, [state.page, state.pages, fetchConversation]);

    const { loadMoreRef } = useInfiniteScroll({
        loading: state.loading,
        showMoreLoading: state.showMoreLoading,
        hasMore: state.pages - state.page > 1,
        itemsLength: state.messages.length,
        onLoadMore: onShowMore,
    });

    useEffect(() => {
        if (!conversationId) return;

        setState({
            loading: false,
            error: false,
            messages: [],
            page: 0,
            pages: 0,
            showMoreLoading: false,
        });

        fetchConversation(0, true);
    }, [conversationId, agent._id, fetchConversation]);

    if (state.loading) {
        return (
            <div className="flex min-h-[calc(100svh-48px-83px)] flex-col items-center justify-center gap-6">
                <Spinner className="scale-150" />
                <span className="text-sm">Fetching conversation messages...</span>
            </div>
        );
    }
    if (state.error) {
        return <div>Error</div>;
    }
    if (state.messages.length === 0) {
        return <span className="text-sm font-medium text-text-secondary">No messages</span>;
    }

    const renderTabsList = () => (
        <TabsList variant="line" className="h-7 gap-0 p-0">
            <TabsTrigger value="inspect" className={TAB_TRIGGER_CLASS}>
                Inspect
            </TabsTrigger>
            <TabsTrigger value="preview" className={TAB_TRIGGER_CLASS}>
                Preview
            </TabsTrigger>
        </TabsList>
    );

    return (
        <Tabs
            value={view}
            onValueChange={(next) => setView(next as ConversationView)}
            className="flex h-full min-h-0 w-full flex-col gap-0"
        >
            <MetaHeader
                conversationId={conversationId as string}
                messages={state.messages}
                onRefresh={() => fetchConversation(0, true)}
                tabs={renderTabsList()}
            />
            <TabsContent
                value="inspect"
                className="chat-messages scrollbar-controller scrollbar-vertical min-h-0 w-full px-4 py-2"
            >
                <ChatNoGroupAdmin messages={state.messages} agent={agent} />
                <InfiniteScrollTrigger
                    loadMoreRef={loadMoreRef}
                    isLoading={state.showMoreLoading}
                    hasMore={state.pages - state.page > 1}
                />
            </TabsContent>
            {view === 'preview' && (
                <TabsContent value="preview" className="flex min-h-0 flex-col">
                    <ConversationPreview key={conversationId} agent={agent} conversationId={conversationId as string} />
                </TabsContent>
            )}
        </Tabs>
    );
};

export default ChatDetails;
