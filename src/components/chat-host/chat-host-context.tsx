import { createContext, useContext, type ReactNode } from 'react';

import type { ChatHost } from './types';

const ChatHostContext = createContext<ChatHost | null>(null);

interface ChatHostProviderProps {
    value: ChatHost;
    children: ReactNode;
}

export const ChatHostProvider = ({ value, children }: ChatHostProviderProps) => (
    <ChatHostContext.Provider value={value}>{children}</ChatHostContext.Provider>
);

export const useChatHost = (): ChatHost => {
    const host = useOptionalChatHost();

    if (!host) {
        throw new Error('useChatHost must be used within a ChatHostProvider');
    }

    return host;
};

/** For components that also mount outside a chat surface (e.g. the create-agent composer). */
export const useOptionalChatHost = (): ChatHost | null => useContext(ChatHostContext);
