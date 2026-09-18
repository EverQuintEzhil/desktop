import { lastAssistantMessageIsCompleteWithToolCalls } from 'ai';
import type { ChatOnDataCallback, UIMessage } from 'ai';
import { useEffect, useRef } from 'react';

import { useChatRuntimeFromConfig } from '@/components/chat/runtime/create-chat-runtime';
import { getApiBaseUrl } from '@/lib/axios';
import { getMessageFileIds } from '@/lib/chat/file-attachments';
import { extractMessageText, findLastUserMessage } from '@/lib/chat/message-text';

import { HUMAN_TOOL_NAMES } from '../components/builder/builder-chat/frontend-tools';
import type { AgentConfigDraft } from '../types';
import { parseAgentConfigDraft } from '../types';

interface CreateAgentRuntimeOptions {
    onAgentConfig: (config: AgentConfigDraft) => void;
    onConversationId: (id: string) => void;
    agentId: string;
    conversationId: string | null;
    initialMessages?: UIMessage[];
    restoreInitialMessages?: boolean;
    /** Read at request time so prepareRequestBody never closes over a stale selection. */
    getModelId?: () => string | undefined;
}

function buildApiUrl(): string {
    return `${getApiBaseUrl()}/assistant/agent-builder`;
}

interface CreateAgentMessagesRepository {
    headId?: string;
    messages: Array<{
        parentId: string | null;
        message: UIMessage;
    }>;
}

interface ToolResultPayload {
    toolCallId: string;
    toolName: string;
    result: unknown;
}

interface ToolPartLike {
    type?: string;
    state?: string;
    toolName?: string;
    toolCallId?: string;
    output?: unknown;
}

function getToolName(part: ToolPartLike): string {
    if (typeof part.toolName === 'string' && part.toolName.length > 0) {
        return part.toolName;
    }

    if (typeof part.type === 'string' && part.type.startsWith('tool-')) {
        return part.type.slice('tool-'.length);
    }

    return '';
}

function collectToolResults(message: { parts?: unknown[] } | undefined): ToolResultPayload[] {
    const parts = Array.isArray(message?.parts) ? (message.parts as ToolPartLike[]) : [];

    return parts
        .filter((part) => part.state === 'output-available' && typeof part.toolCallId === 'string')
        .map((part) => ({
            toolCallId: part.toolCallId as string,
            toolName: getToolName(part),
            result: part.output,
        }));
}

function lastAssistantHasHumanToolOutput(messages: UIMessage[]): boolean {
    const lastMessage = messages[messages.length - 1];

    if (lastMessage?.role !== 'assistant') {
        return false;
    }

    const parts = Array.isArray(lastMessage.parts) ? (lastMessage.parts as ToolPartLike[]) : [];

    return parts.some((part) => part.state === 'output-available' && HUMAN_TOOL_NAMES.has(getToolName(part)));
}

function toCreateAgentMessagesRepository(messages: readonly UIMessage[]): CreateAgentMessagesRepository {
    let parentId: string | null = null;

    const repositoryMessages = messages.map((message) => {
        const item = {
            parentId,
            message,
        };

        parentId = message.id;

        return item;
    });

    return {
        ...(messages.at(-1)?.id !== undefined && { headId: messages.at(-1)!.id }),
        messages: repositoryMessages,
    };
}

export function useCreateAgentRuntime(options: CreateAgentRuntimeOptions) {
    const optionsRef = useRef(options);

    optionsRef.current = options;

    // The Chat below is constructed with initialMessages, so a thread seeded at mount already
    // holds them. Re-importing via switchToNewThread swaps the live thread out mid-render and
    // assistant-ui's by-id message clients crash with "Entry not available in the store".
    const seededConversationRef = useRef<string | null>(
        (options.initialMessages?.length ?? 0) > 0 ? options.conversationId : null,
    );

    const handleData: ChatOnDataCallback<UIMessage> = (dataPart) => {
        if (dataPart.type === 'data-agent-config') {
            const config = parseAgentConfigDraft(dataPart.data);

            if (config !== null) {
                optionsRef.current.onAgentConfig(config);
            }
        }
    };

    const { runtime } = useChatRuntimeFromConfig<UIMessage>({
        api: buildApiUrl(),
        conversationId: options.conversationId,
        onConversationId: options.onConversationId,
        onData: handleData,
        initialMessages: options.initialMessages ?? [],
        sendAutomaticallyWhen: (sendOptions) =>
            lastAssistantMessageIsCompleteWithToolCalls(sendOptions) &&
            lastAssistantHasHumanToolOutput(sendOptions.messages),
        prepareRequestBody: ({ messages, body, trigger, conversationId }) => {
            const { agentId } = optionsRef.current;
            const tools = (body as Record<string, unknown> | undefined)?.tools;

            const lastMessage = messages[messages.length - 1];

            const modelId = optionsRef.current.getModelId?.();

            if (trigger === 'submit-message' && lastMessage?.role === 'assistant') {
                const toolResults = collectToolResults(lastMessage);

                return {
                    body: {
                        agentId,
                        conversationId,
                        toolResults,
                        ...(tools ? { tools } : {}),
                        ...(modelId ? { modelId } : {}),
                    },
                };
            }

            const lastUserMessage = findLastUserMessage(messages);
            const message = extractMessageText(lastUserMessage);
            const fileIds = getMessageFileIds(lastUserMessage?.metadata);

            return {
                body: {
                    agentId,
                    conversationId,
                    message,
                    ...(fileIds.length > 0 ? { fileIds } : {}),
                    ...(tools ? { tools } : {}),
                    ...(modelId ? { modelId } : {}),
                },
            };
        },
    });

    useEffect(() => {
        if (!options.conversationId || !options.restoreInitialMessages) return undefined;
        if (seededConversationRef.current === options.conversationId) return undefined;

        seededConversationRef.current = options.conversationId;

        let cancelled = false;

        const restoreMessages = async () => {
            runtime.thread.cancelRun();
            await runtime.threads.switchToNewThread();

            if (cancelled) return;

            runtime.thread.importExternalState(toCreateAgentMessagesRepository(options.initialMessages ?? []));
            void runtime.thread.composer.reset();
        };

        void restoreMessages();

        return () => {
            cancelled = true;
        };
    }, [runtime, options.conversationId, options.initialMessages, options.restoreInitialMessages]);

    return { runtime };
}
