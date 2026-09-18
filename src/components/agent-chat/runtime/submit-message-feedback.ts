import type { ConversationAdapter } from '@/components/chat-host';

interface SubmitMessageFeedbackOptions {
    conversations: ConversationAdapter;
    conversationId: string | null;
    messageId: string | undefined;
    liked: boolean;
    disliked: boolean;
}

export const submitMessageFeedback = async ({
    conversations,
    conversationId,
    messageId,
    liked,
    disliked,
}: SubmitMessageFeedbackOptions): Promise<void> => {
    if (!conversationId) throw new Error('Conversation is not persisted.');
    if (!messageId) throw new Error('Message is not persisted.');

    await conversations.updateMessage(conversationId, messageId, {
        liked: liked ? true : undefined,
        disliked: disliked ? true : undefined,
    });
};
