import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
    type RefObject,
} from 'react';

import useFindInConversation, { type UseFindInConversationReturn } from './use-find-in-conversation';
import useFindShortcut from './use-find-shortcut';

interface FindContextValue {
    /** Attached by the thread to its scroll viewport; the search reads it lazily. */
    viewportRef: RefObject<HTMLDivElement | null>;
    /**
     * Set just before find moves the viewport itself. The thread's own scroll
     * handler reads a scroll landing on zero as the user reaching the top and
     * fetches an older page, so exactly one event has to be ignored.
     */
    skipNextScrollRef: RefObject<boolean>;
    isOpen: boolean;
    /** Bumped on every press of the shortcut, to refocus an already-open bar. */
    focusRequest: number;
    /** True where the surface can search at all; the header control hides otherwise. */
    isEnabled: boolean;
    /** Attached by the header control, so closing can hand the keyboard back to it. */
    controlRef: RefObject<HTMLButtonElement | null>;
    open: () => void;
    close: () => void;
    find: UseFindInConversationReturn;
    hasMoreOlderMessages: boolean;
    isLoadingOlderMessages: boolean;
    /**
     * Set by the thread, which is the only place that can capture the scroll
     * anchor the prepend restore depends on. Undefined when the conversation has
     * no older pages to fetch.
     */
    requestOlderMessagesRef: RefObject<(() => void) | null>;
    onLoadOlderMessages?: () => void;
}

const FindContext = createContext<FindContextValue | null>(null);

interface FindProviderProps {
    children: ReactNode;
    /** Off for surfaces with no conversation to search, e.g. the admin preview. */
    isEnabled?: boolean;
    hasMoreOlderMessages?: boolean;
    isLoadingOlderMessages?: boolean;
    onLoadOlderMessages?: () => void;
}

/**
 * Owns the search so the bar can live in the header while the matches live in
 * the thread below it — the two are siblings, so neither can own the state.
 */
export const FindProvider = ({
    children,
    isEnabled = false,
    hasMoreOlderMessages = false,
    isLoadingOlderMessages = false,
    onLoadOlderMessages,
}: FindProviderProps) => {
    const viewportRef = useRef<HTMLDivElement>(null);
    const skipNextScrollRef = useRef(false);
    const requestOlderMessagesRef = useRef<(() => void) | null>(null);
    const controlRef = useRef<HTMLButtonElement>(null);
    const restoreFocusRef = useRef<HTMLElement | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [focusRequest, setFocusRequest] = useState(0);
    const [restoreRequest, setRestoreRequest] = useState(0);

    const markProgrammaticScroll = useCallback(() => {
        skipNextScrollRef.current = true;
    }, []);

    const clearProgrammaticScroll = useCallback(() => {
        skipNextScrollRef.current = false;
    }, []);

    const find = useFindInConversation({
        viewportRef,
        isOpen,
        onBeforeScroll: markProgrammaticScroll,
        onScrollSkipped: clearProgrammaticScroll,
    });

    const isOpenRef = useRef(isOpen);

    isOpenRef.current = isOpen;

    const open = useCallback(() => {
        // Captured here rather than when the bar mounts: opening from the header
        // control unmounts that control in the same commit, so by mount time the
        // document has already dropped focus to the body.
        if (!isOpenRef.current) restoreFocusRef.current = document.activeElement as HTMLElement | null;

        setIsOpen(true);
        // Pressing the shortcut again, or clicking the header control while the bar
        // is already open, should put the caret back in it rather than do nothing.
        setFocusRequest((current) => current + 1);
    }, []);

    useFindShortcut({ isEnabled, onOpen: open });

    const resetFind = find.reset;
    const close = useCallback(() => {
        setIsOpen(false);
        resetFind();
        setRestoreRequest((current) => current + 1);
    }, [resetFind]);

    // Runs after the header has rendered its control again, which is where focus
    // goes when whatever held it before the search is gone with the old header.
    useEffect(() => {
        if (restoreRequest === 0) return;

        const previous = restoreFocusRef.current;

        restoreFocusRef.current = null;

        const target = previous?.isConnected && previous !== document.body ? previous : controlRef.current;

        target?.focus();
    }, [restoreRequest]);

    // Stable, so the bar's props do not churn: the thread swaps what the ref holds.
    const requestOlderMessages = useCallback(() => requestOlderMessagesRef.current?.(), []);

    const value = useMemo<FindContextValue>(
        () => ({
            viewportRef,
            skipNextScrollRef,
            requestOlderMessagesRef,
            isOpen,
            focusRequest,
            isEnabled,
            controlRef,
            open,
            close,
            find,
            hasMoreOlderMessages,
            isLoadingOlderMessages,
            onLoadOlderMessages: onLoadOlderMessages ? requestOlderMessages : undefined,
        }),
        [
            isOpen,
            focusRequest,
            isEnabled,
            controlRef,
            open,
            close,
            find,
            hasMoreOlderMessages,
            isLoadingOlderMessages,
            onLoadOlderMessages,
            requestOlderMessages,
        ],
    );

    return <FindContext.Provider value={value}>{children}</FindContext.Provider>;
};

/** `null` on surfaces that never mount a provider, which must still render. */
export const useFindContext = (): FindContextValue | null => useContext(FindContext);
