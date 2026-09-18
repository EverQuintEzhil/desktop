import { createContext, useContext, type ReactNode } from 'react';

import type { ChatClassNames } from './types';

// A stable empty map so consumers rendered without a provider (the in-app chat
// surfaces) read no overrides — every className merge is then a no-op and the
// default classes render unchanged.
const EMPTY_CLASS_NAMES: ChatClassNames = {};

const ChatClassNamesContext = createContext<ChatClassNames>(EMPTY_CLASS_NAMES);

interface ChatClassNamesProviderProps {
    value?: ChatClassNames;
    children: ReactNode;
}

/**
 * Provides per-part className overrides to the chat part components. Provided at
 * the SDK root; absent for the in-app surfaces, where the default empty map
 * makes every merge a no-op.
 */
export const ChatClassNamesProvider = ({ value, children }: ChatClassNamesProviderProps) => (
    <ChatClassNamesContext.Provider value={value ?? EMPTY_CLASS_NAMES}>{children}</ChatClassNamesContext.Provider>
);

/** Reads the active per-part className overrides ({@link ChatClassNames}). */
export const useChatClassNames = (): ChatClassNames => useContext(ChatClassNamesContext);
