import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import type { ChatSidePane, ChatSidePanelController } from '@/components/chat-host';

const ChatSidePanelContext = createContext<ChatSidePanelController | null>(null);

interface ChatSidePanelProviderProps {
    children: ReactNode;
    // Changing this value resets the panel to closed (e.g. the active
    // conversation id) without remounting the subtree.
    resetKey?: string | null;
}

export const ChatSidePanelProvider = ({ children, resetKey }: ChatSidePanelProviderProps) => {
    const [activePane, setActivePane] = useState<ChatSidePane>(null);
    const previousResetKeyRef = useRef(resetKey);

    useEffect(() => {
        const previous = previousResetKeyRef.current;

        previousResetKeyRef.current = resetKey;

        // A new conversation mints its id mid-turn (null -> id); that is the same
        // conversation, and closing a pane the user opened during the turn is not a reset.
        if (previous == null) return;

        setActivePane(null);
    }, [resetKey]);

    const open = useCallback((pane: Exclude<ChatSidePane, null>) => {
        setActivePane(pane);
    }, []);

    const close = useCallback(() => {
        setActivePane(null);
    }, []);

    const toggle = useCallback((pane: Exclude<ChatSidePane, null>) => {
        setActivePane((prev) => (prev === pane ? null : pane));
    }, []);

    const value = useMemo<ChatSidePanelController>(
        () => ({
            activePane,
            open,
            close,
            toggle,
        }),
        [activePane, open, close, toggle],
    );

    return <ChatSidePanelContext.Provider value={value}>{children}</ChatSidePanelContext.Provider>;
};

export const useChatSidePanel = (): ChatSidePanelController => {
    const context = useContext(ChatSidePanelContext);

    if (!context) {
        throw new Error('useChatSidePanel must be used within a ChatSidePanelProvider');
    }

    return context;
};
