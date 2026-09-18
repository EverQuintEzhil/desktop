import type { FluentMindUIMessage } from '@/components/agent-chat/types';

export interface ConversationMessagesRepository {
    headId?: string;
    messages: Array<{
        parentId: string | null;
        message: FluentMindUIMessage;
    }>;
}

const NON_RENDERABLE_PART_TYPES = new Set(['step-start', 'data-conversation']);

export const sanitizeRepositoryMessage = (message: FluentMindUIMessage): FluentMindUIMessage => ({
    ...message,
    parts: message.parts.filter((part) => !NON_RENDERABLE_PART_TYPES.has(part.type)),
});

export const toConversationMessagesRepository = (
    messages: readonly FluentMindUIMessage[],
): ConversationMessagesRepository => {
    let parentId: string | null = null;

    const repositoryMessages = messages.map((message) => {
        const item = {
            parentId,
            message: sanitizeRepositoryMessage(message),
        };

        parentId = message.id;

        return item;
    });

    return {
        ...(messages.at(-1)?.id !== undefined && { headId: messages.at(-1)!.id }),
        messages: repositoryMessages,
    };
};
