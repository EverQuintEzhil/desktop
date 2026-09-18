import type { UIMessage } from 'ai';

import { apiClient } from '@/lib/api/client';
import { mapPageInfo } from '@/lib/api/mappers';
import type { PageInfo, RawPagedList } from '@/types/api-types';

import { HUMAN_TOOL_NAMES } from './human-tool-names';

export interface ConversationMessage {
    id: string;
    role: 'user' | 'assistant';
    parts: UIMessage['parts'];
}

export interface CreateAgentConversation {
    _id: string;
    agentId?: string;
    title: string;
    updated_at?: string;
}

type RawAgentBuilderMessagePart = {
    type?: string;
    text?: string;
    [key: string]: unknown;
};

type RawAgentBuilderMessagesResponse =
    | RawPagedList<RawAgentBuilderConversationMessage>
    | RawAgentBuilderConversationMessage[];

interface RawAgentBuilderConversationMessage {
    _id: string;
    conversation_id?: string;
    agent_id?: string;
    agentId?: string;
    title?: string;
    role?: 'user' | 'assistant';
    content?: RawAgentBuilderMessagePart[];
    metadata?: {
        title?: string;
    } | null;
    created_at?: string;
    updated_at?: string;
}

export interface SkillDetail {
    _id: string;
    skill_name: string;
    display_name: string;
    short_description: string;
    skill_description: string;
    instructions: string;
}

export type SkillUpdatePatch = Partial<
    Pick<SkillDetail, 'display_name' | 'short_description' | 'skill_description' | 'instructions'>
>;

export const getSkill = (id: string): Promise<SkillDetail> => apiClient.get<SkillDetail>(`/skills/${id}`);

export const updateSkill = (id: string, patch: SkillUpdatePatch): Promise<SkillDetail> =>
    apiClient.patch<SkillDetail, SkillUpdatePatch>(`/skills/${id}`, patch);

const AGENT_BUILDER_CONVERSATIONS_PATH = '/assistant/agent-builder/conversations';
const CONVERSATIONS_PAGE_SIZE = 100;

export const CREATE_AGENT_CONVERSATIONS_PAGE_SIZE = 30;

export interface CreateAgentConversationsPage {
    conversations: CreateAgentConversation[];
    pageInfo: PageInfo;
}

const getTextFromParts = (parts: RawAgentBuilderMessagePart[] | undefined): string => {
    const text = parts
        ?.map((part) => (typeof part.text === 'string' ? part.text.trim() : ''))
        .filter(Boolean)
        .join(' ')
        .trim();

    return text || '';
};

const truncateTitle = (title: string): string => (title.length > 80 ? `${title.slice(0, 77)}...` : title);

const titleForMessage = (message: RawAgentBuilderConversationMessage): string =>
    truncateTitle(message.title || message.metadata?.title || getTextFromParts(message.content) || 'New chat');

const TERMINAL_CONVERSATION_STATUSES = new Set(['ready', 'failed']);

type TerminalConversationStatus = 'ready' | 'failed';

interface ConversationTitleCandidate {
    conversation: CreateAgentConversation;
    message: RawAgentBuilderConversationMessage;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const getConversationStatus = (part: RawAgentBuilderMessagePart): string | null => {
    if (part.type !== 'data-conversation' || !isRecord(part.data)) return null;

    const { status } = part.data;

    return typeof status === 'string' ? status : null;
};

const getTerminalConversationStatus = (part: RawAgentBuilderMessagePart): TerminalConversationStatus | null => {
    const status = getConversationStatus(part);

    return status !== null && TERMINAL_CONVERSATION_STATUSES.has(status)
        ? (status as TerminalConversationStatus)
        : null;
};

const isToolPart = (part: RawAgentBuilderMessagePart): boolean =>
    part.type === 'dynamic-tool' || part.type?.startsWith('tool-') === true;

const getToolName = (part: RawAgentBuilderMessagePart): string => {
    if (typeof part.toolName === 'string') return part.toolName;
    if (part.type?.startsWith('tool-') === true) return part.type.slice('tool-'.length);

    return '';
};

const isHumanInputToolPart = (part: RawAgentBuilderMessagePart): boolean => HUMAN_TOOL_NAMES.has(getToolName(part));

const settleRestoredToolPart = (
    part: RawAgentBuilderMessagePart,
    terminalStatus: TerminalConversationStatus,
): RawAgentBuilderMessagePart => {
    if (!isToolPart(part) || isHumanInputToolPart(part)) return part;
    if (part.state !== 'input-available' && part.state !== 'input-streaming') return part;

    if (terminalStatus === 'failed') {
        return {
            ...part,
            state: 'output-error',
            errorText: 'Tool did not complete before the conversation ended.',
        };
    }

    return {
        ...part,
        state: 'output-available',
        output: part.output ?? { success: true },
    };
};

const normalizeRestoredParts = (message: RawAgentBuilderConversationMessage): RawAgentBuilderMessagePart[] => {
    const parts = message.content ?? [];
    const terminalStatus = parts.reduce<TerminalConversationStatus | null>(
        (status, part) => status ?? getTerminalConversationStatus(part),
        null,
    );

    if (message.role !== 'assistant' || terminalStatus === null) {
        return parts;
    }

    return parts.map((part) => settleRestoredToolPart(part, terminalStatus));
};

const normalizeConversationMessages = (messages: RawAgentBuilderConversationMessage[]): ConversationMessage[] =>
    messages
        .filter(
            (message): message is RawAgentBuilderConversationMessage & { role: 'user' | 'assistant' } =>
                message.role === 'user' || message.role === 'assistant',
        )
        .map((message) => ({
            id: message._id,
            role: message.role,
            parts: normalizeRestoredParts(message) as UIMessage['parts'],
        }));

const getMessageAgentId = (message: RawAgentBuilderConversationMessage): string | undefined =>
    message.agent_id ?? message.agentId;

const getMessageTime = (message: RawAgentBuilderConversationMessage): number => {
    if (!message.created_at) return Number.MAX_SAFE_INTEGER;

    const time = Date.parse(message.created_at);

    return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
};

const shouldPreferTitleMessage = (
    candidate: RawAgentBuilderConversationMessage,
    current: RawAgentBuilderConversationMessage,
): boolean => {
    if (candidate.role === 'user' && current.role !== 'user') return true;
    if (candidate.role !== 'user' && current.role === 'user') return false;

    return getMessageTime(candidate) < getMessageTime(current);
};

const normalizeConversations = (
    messages: RawAgentBuilderConversationMessage[],
    agentId: string,
): CreateAgentConversation[] => {
    const conversations = new Map<string, ConversationTitleCandidate>();

    for (const message of messages) {
        const messageAgentId = getMessageAgentId(message);

        if (messageAgentId && messageAgentId !== agentId) continue;

        const conversationId = message.conversation_id ?? message._id;

        if (!conversationId) continue;

        const existing = conversations.get(conversationId);

        if (existing && !shouldPreferTitleMessage(message, existing.message)) continue;

        conversations.set(conversationId, {
            conversation: {
                _id: conversationId,
                agentId: messageAgentId,
                title: titleForMessage(message),
                updated_at: message.updated_at,
            },
            message,
        });
    }

    return Array.from(conversations.values()).map(({ conversation }) => conversation);
};

const getValuesFromResponse = (response: RawAgentBuilderMessagesResponse): RawAgentBuilderConversationMessage[] => {
    if (Array.isArray(response)) {
        return response;
    }

    return response.values ?? [];
};

const getPageInfoFromResponse = (
    response: RawAgentBuilderMessagesResponse,
    page: number,
    valuesCount: number,
): PageInfo => {
    if (Array.isArray(response) || !response.page_info) {
        return { page, totalPages: 1, totalCount: valuesCount };
    }

    return mapPageInfo(response.page_info);
};

const listAgentBuilderConversationMessages = async (
    agentId?: string,
): Promise<RawAgentBuilderConversationMessage[]> => {
    const firstPage = await apiClient.get<RawPagedList<RawAgentBuilderConversationMessage>>(
        AGENT_BUILDER_CONVERSATIONS_PATH,
        {
            params: { agentId, page: 0, size: CONVERSATIONS_PAGE_SIZE },
        },
    );

    const values = [...getValuesFromResponse(firstPage)];
    const totalPages = firstPage.page_info?.total_pages ?? 1;

    if (totalPages <= 1) {
        return values;
    }

    const remainingPages = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, index) => index + 1).map((page) =>
            apiClient.get<RawPagedList<RawAgentBuilderConversationMessage>>(AGENT_BUILDER_CONVERSATIONS_PATH, {
                params: { agentId, page, size: CONVERSATIONS_PAGE_SIZE },
            }),
        ),
    );

    for (const page of remainingPages) {
        values.push(...getValuesFromResponse(page));
    }

    return values;
};

const getAgentBuilderConversationMessages = async (
    conversationId: string,
    agentId?: string,
): Promise<RawAgentBuilderConversationMessage[]> => {
    const response = await apiClient.get<RawAgentBuilderMessagesResponse>(
        `${AGENT_BUILDER_CONVERSATIONS_PATH}/${conversationId}/messages`,
        {
            params: agentId ? { agentId } : undefined,
        },
    );

    return getValuesFromResponse(response);
};

export const getCreateAgentConversationsPage = async (
    agentId: string,
    page: number,
    size: number = CREATE_AGENT_CONVERSATIONS_PAGE_SIZE,
): Promise<CreateAgentConversationsPage> => {
    const response = await apiClient.get<RawPagedList<RawAgentBuilderConversationMessage>>(
        AGENT_BUILDER_CONVERSATIONS_PATH,
        {
            params: { agentId, page, size },
        },
    );
    const values = getValuesFromResponse(response);

    return {
        conversations: normalizeConversations(values, agentId),
        pageInfo: getPageInfoFromResponse(response, page, values.length),
    };
};

export const getCreateAgentConversationMessages = async (
    conversationId: string,
    agentId?: string,
): Promise<ConversationMessage[]> => {
    try {
        const messages = await getAgentBuilderConversationMessages(conversationId, agentId);
        const conversationMessages = messages.filter(
            (message) => (message.conversation_id ?? conversationId) === conversationId,
        );

        return normalizeConversationMessages(conversationMessages);
    } catch {
        // The detail endpoint is not available on every deployment; the paged list carries the
        // same messages, so it stands in.
        const messages = await listAgentBuilderConversationMessages(agentId);
        const conversationMessages = messages.filter(
            (message) => (message.conversation_id ?? message._id) === conversationId,
        );

        return normalizeConversationMessages(conversationMessages);
    }
};

export const renameCreateAgentConversation = (conversationId: string, title: string, agentId?: string): Promise<void> =>
    apiClient.patch<void>(
        `${AGENT_BUILDER_CONVERSATIONS_PATH}/${conversationId}`,
        { title },
        {
            params: agentId ? { agentId } : undefined,
        },
    );

export const deleteCreateAgentConversation = (conversationId: string, agentId?: string): Promise<void> =>
    apiClient.delete<void>(`${AGENT_BUILDER_CONVERSATIONS_PATH}/${conversationId}`, {
        params: agentId ? { agentId } : undefined,
    });
