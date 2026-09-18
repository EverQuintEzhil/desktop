import type { ConversationMessage, RawMessagePart, TokenUsage, WebSource } from '@/components/agent-chat/types';

import type { AdminConversationMessage, AdminSource } from '../../chat-details';

const toWebSources = (sources?: AdminSource[]): WebSource[] | undefined =>
    sources?.map((source) => ({
        url: source.url,
        title: source.title,
        description: source.description,
        favicon: source.favicon,
        site_name: source.site_name,
        thumbnail: source.thumbnail,
        ...(source.type === 'url' && { type: 'url' as const }),
    }));

const toConversationMessage = (message: AdminConversationMessage): ConversationMessage => ({
    _id: message._id,
    conversation_id: message.conversation_id,
    role: message.role,
    user_id: message.user_id,
    parent_id: message.parent_id,
    created_at: message.created_at,
    content: message.content as RawMessagePart[],
    ai_info: message.ai_info
        ? {
              provider: message.ai_info.provider,
              model: message.ai_info.model,
              token_usage: (message.ai_info.token_usage ?? undefined) as TokenUsage | undefined,
          }
        : null,
    metadata: message.metadata
        ? {
              sources: toWebSources(message.metadata.sources),
              files: message.metadata.files,
              genui_state: message.metadata.genui_state,
              partial: message.metadata.partial,
              pending: message.metadata.pending,
              error: message.metadata.error,
              tool_durations: message.metadata.tool_durations,
              reasoning_ms: message.metadata.reasoning_ms,
          }
        : null,
});

/** The admin endpoint pages oldest-first, which is the order the thread renders in. */
export const toConversationMessages = (messages: AdminConversationMessage[]): ConversationMessage[] =>
    messages.map(toConversationMessage);
