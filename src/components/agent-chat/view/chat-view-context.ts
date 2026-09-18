import { createContext, useContext } from 'react';

import type { ChatAgentType } from '@/types/admin';

import type { ChatViewContextValue } from '../types';

export const ChatViewContext = createContext<ChatViewContextValue>({
    agent: null,
    conversationId: null,
    onShowSources: () => {},
    onShowResearch: () => {},
    activeResearchMessageId: null,
    onShowArtifact: () => {},
    activeArtifactId: null,
    isFromAdmin: false,
    onEditStart: () => {},
    onEditEnd: () => {},
    branchedFromConversation: null,
    isForeignConversation: false,
    isReadOnly: false,
});

export const useChatViewContext = (): ChatViewContextValue & { agent: ChatAgentType } => {
    const context = useContext(ChatViewContext);

    if (!context.agent) {
        throw new Error('ChatViewContext must be used inside ChatView.');
    }

    return context as ChatViewContextValue & { agent: ChatAgentType };
};
