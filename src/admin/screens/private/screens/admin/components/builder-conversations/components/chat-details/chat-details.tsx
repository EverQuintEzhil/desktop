import { MessageSquareDashedIcon, RefreshCwIcon, TriangleAlertIcon } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';

import {
    getCreateAgentConversationMessages,
    type ConversationMessage,
} from '@/app/screens/private/screens/create-agent/lib/builder-conversations-api';
import { Button } from '@/components/ui/button';
import Spinner from '@/components/ui/spinner';
import type { AgentType } from '@/types/admin';

import MetaHeader from '../meta-header';

import { ChatNoGroupAdmin } from './chat-group';

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
    type: `tool-${string}`;
    toolCallId: string;
    state: string;
    input: Record<string, unknown>;
    output: unknown;
    callProviderMetadata?: Record<string, unknown>;
    resultProviderMetadata?: Record<string, unknown>;
    providerExecuted?: boolean;
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
    created_at: string;
    reasoning: string | null;
    ai_info: {
        token_usage?: {
            total_tokens?: number | null;
            output_tokens?: number | null;
            reasoning_tokens?: number | null;
            input_tokens?: number | null;
            total_tokens_co2?: number | null;
            input_tokens_co2?: number | null;
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
    } | null;
    content: AdminContentItem[];
}

const mapBuilderMessageToAdmin = (msg: ConversationMessage, conversationId: string): AdminConversationMessage => ({
    _id: msg.id,
    role: msg.role,
    user_id: '',
    conversation_id: conversationId,
    created_at: '',
    reasoning: null,
    ai_info: null,
    metadata: null,
    content: (msg.parts ?? []) as unknown as AdminContentItem[],
});

interface Props {
    agent: AgentType;
    conversationId: string;
}

const ChatDetails = (props: Props) => {
    const { agent, conversationId } = props;

    const [state, setState] = useState<{
        loading: boolean;
        error: boolean;
        messages: AdminConversationMessage[];
    }>({
        loading: true,
        error: false,
        messages: [],
    });

    const fetchConversation = useCallback(
        async (reset: boolean = false) => {
            if (!conversationId) return;

            try {
                if (reset) {
                    setState((prev) => ({ ...prev, loading: true }));
                }

                const result = await getCreateAgentConversationMessages(conversationId, agent._id);

                setState({
                    loading: false,
                    error: false,
                    messages: result.map((msg) => mapBuilderMessageToAdmin(msg, conversationId)),
                });
            } catch (err) {
                console.error('Failed to fetch builder conversation messages:', err);
                setState((prev) => ({
                    ...prev,
                    loading: false,
                    error: true,
                    messages: reset ? [] : prev.messages,
                }));
            }
        },
        [conversationId, agent._id],
    );

    useEffect(() => {
        if (!conversationId) return;

        setState({
            loading: true,
            error: false,
            messages: [],
        });

        fetchConversation(true);
    }, [conversationId, agent._id, fetchConversation]);

    if (state.loading) {
        return (
            <div className="chat-details-loading flex h-full flex-col items-center justify-center gap-6">
                <Spinner className="scale-150" />
                <span className="text-sm">Fetching conversation messages...</span>
            </div>
        );
    }
    if (state.error) {
        return (
            <div className="chat-details-error flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
                <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                    <TriangleAlertIcon className="size-5" aria-hidden="true" />
                </div>
                <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-foreground">Something went wrong</p>
                    <p className="text-xs text-muted-foreground">
                        Couldn&apos;t load the messages for this conversation.
                    </p>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => fetchConversation(true)}
                >
                    <RefreshCwIcon />
                    Retry
                </Button>
            </div>
        );
    }
    if (state.messages.length === 0) {
        return (
            <div className="chat-details-empty flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <div className="flex size-10 items-center justify-center rounded-full bg-muted text-text-secondary">
                    <MessageSquareDashedIcon className="size-5" aria-hidden="true" />
                </div>
                <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-foreground">No messages</p>
                    <p className="text-xs text-muted-foreground">This builder conversation has no recorded messages.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex w-full flex-col">
            <MetaHeader
                conversationId={conversationId}
                messages={state.messages}
                onRefresh={() => fetchConversation(true)}
            />
            <div className="chat-messages w-full px-4 py-2">
                <ChatNoGroupAdmin messages={state.messages} />
            </div>
        </div>
    );
};

export default ChatDetails;
