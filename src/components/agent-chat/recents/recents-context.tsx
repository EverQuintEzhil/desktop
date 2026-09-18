import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react';

/**
 * Recents open-state shared between a host's panel chrome (an ancestor of the
 * chat) and the chat itself. Lifted here because React context flows downward:
 * the chrome that renders the toggle cannot read state owned by its descendant.
 * Two hosts use it — the SDK's `FloatingShell` and the app-agent assistant panel.
 */
export interface RecentsUiValue {
    /** Recents is available on this surface (feature on + no custom conversation). */
    enabled: boolean;
    /** Whether the Recents panel is currently open. */
    open: boolean;
    /** Open or close the Recents panel. */
    setOpen: (open: boolean) => void;
    /** The host chrome swaps in its own Recents header, so the panel hides its built-in one. */
    headerOwnsToggle: boolean;
    /** Start a new chat from the host chrome (routed to the chat's own handler). */
    triggerNewChat: () => void;
    /** The chat registers its new-chat handler so the ancestor chrome can invoke it. */
    registerNewChat: (fn: () => void) => void;
}

const DEFAULT_VALUE: RecentsUiValue = {
    enabled: false,
    open: false,
    setOpen: () => {},
    headerOwnsToggle: false,
    triggerNewChat: () => {},
    registerNewChat: () => {},
};

const RecentsUiContext = createContext<RecentsUiValue>(DEFAULT_VALUE);

interface RecentsUiProviderProps {
    /** Open-state fields owned by the top-level widget. */
    value: Pick<RecentsUiValue, 'enabled' | 'open' | 'setOpen' | 'headerOwnsToggle'>;
    children: ReactNode;
}

export const RecentsUiProvider = ({ value, children }: RecentsUiProviderProps) => {
    // The new-chat handler lives in the descendant shell (below the host provider),
    // so the ancestor header reaches it through this ref instead of a direct call.
    const newChatRef = useRef<() => void>(() => {});

    const registerNewChat = useCallback((fn: () => void) => {
        newChatRef.current = fn;
    }, []);

    const triggerNewChat = useCallback(() => {
        newChatRef.current();
    }, []);

    const contextValue = useMemo<RecentsUiValue>(
        () => ({
            ...value,
            triggerNewChat,
            registerNewChat,
        }),
        [value, triggerNewChat, registerNewChat],
    );

    return <RecentsUiContext.Provider value={contextValue}>{children}</RecentsUiContext.Provider>;
};

/** Read the shared Recents UI state; safe to call without a provider (returns defaults). */
export const useRecentsUi = (): RecentsUiValue => useContext(RecentsUiContext);
