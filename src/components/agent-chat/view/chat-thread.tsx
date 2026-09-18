import { ThreadPrimitive, useAuiState, useThreadViewportStore } from '@assistant-ui/react';
import { type FC, type ReactNode, useCallback, useEffect, useLayoutEffect, useRef } from 'react';

import { useChatClassNames, useChatHost } from '@/components/chat-host';
import ScrollToBottomButton from '@/components/chat/primitives/scroll-to-bottom-button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

import { useGenUIToolUI } from '../genui/use-genui-tool-ui';
import { useScrollToBottomOnLoad } from '../hooks/use-scroll-to-bottom-on-load';

import { FindMatchTicks, useFindContext } from './chat-find-bar';
import { AssistantMessage, UserMessage, useChatViewContext } from './chat-thread-messages';
import MessageNavRail from './message-nav-rail';
import { scrollInstantly } from './scroll-instantly';
import { selectIsPausedOnApproval } from './select-paused-on-approval';

interface ChatThreadProps {
    composer?: ReactNode | null | false;
    className?: string;
    viewportClassName?: string;
    messagesClassName?: string;
    isPendingGeneration?: boolean;
    /** Fetches the next older page of messages and re-imports the thread. */
    onLoadOlderMessages?: () => void;
    /** Whether an older page is still available to load. */
    hasMoreOlderMessages?: boolean;
    /** Whether an older-page fetch is currently in flight. */
    isLoadingOlderMessages?: boolean;
    enableMessageNav?: boolean;
    isSidePanelOpen?: boolean;
    /** Mirrors the Viewport's scrollToBottomOn* props: off keeps the thread on its first message. */
    scrollToBottomOnLoad?: boolean;
    /** Rendered inside the message group, after the last message. */
    afterMessages?: ReactNode;
}

const PendingGenerationIndicator: FC = () => {
    const { session } = useChatHost();
    const tenant = session.tenant;

    // A turn paused on a pending tool approval (e.g. the MCP reconnect gate)
    // can leave the conversation status stale at 'generating', but it is
    // waiting on the user — not generating — so the indicator must stay hidden.
    const isPausedOnApproval = useAuiState((s) => selectIsPausedOnApproval(s.thread.messages.at(-1)));

    // A re-attached turn renders its own generating indicator as soon as it goes
    // 'running', but the conversation status flag only clears on the next 5s poll.
    const isLastMessageRunning = useAuiState((s) => s.thread.messages.at(-1)?.status?.type === 'running');

    if (isPausedOnApproval || isLastMessageRunning) return null;

    return (
        <div className="answer-list-item message-list-item flex flex-col py-3">
            <div className="message-answer flex gap-3">
                <div className="logo-generating flex size-6 shrink-0 items-center justify-center motion-reduce:animate-none">
                    <img
                        className={cn('size-full rounded-sm object-contain', tenant?.logoSrcDark && 'dark:hidden')}
                        src={tenant?.logoSrc}
                        alt={tenant?.name}
                    />
                    {tenant?.logoSrcDark ? (
                        <img
                            className="hidden size-full rounded-sm object-contain dark:block"
                            src={tenant.logoSrcDark}
                            alt={tenant.name}
                        />
                    ) : null}
                </div>
                <div className="answer-content message-content flex w-full flex-col">
                    <span className="mb-3 flex text-h5">Generating your answer</span>
                </div>
            </div>
        </div>
    );
};

const ChatThread: FC<ChatThreadProps> = ({
    composer,
    className,
    viewportClassName,
    messagesClassName,
    isPendingGeneration = false,
    onLoadOlderMessages,
    hasMoreOlderMessages = false,
    isLoadingOlderMessages = false,
    enableMessageNav = false,
    isSidePanelOpen = false,
    scrollToBottomOnLoad = true,
    afterMessages,
}) => {
    const composerNode = composer !== undefined ? composer : null;
    const classNames = useChatClassNames();
    const { agent, conversationId } = useChatViewContext();
    const messageCount = useAuiState((s) => s.thread.messages.length);
    const firstMessageId = useAuiState((s) => s.thread.messages[0]?.id);

    // The bar lives in the header, above this component, so the search is owned by
    // a provider wrapping both. Surfaces without one (the admin preview) still need
    // a viewport ref and a scroll flag of their own.
    const findContext = useFindContext();
    const fallbackViewportRef = useRef<HTMLDivElement>(null);
    const fallbackSkipScrollRef = useRef(false);
    const viewportRef = findContext?.viewportRef ?? fallbackViewportRef;
    const skipNextScrollRef = findContext?.skipNextScrollRef ?? fallbackSkipScrollRef;
    const isFindOpen = findContext?.isOpen ?? false;
    const closeFind = findContext?.close;

    // Scroll anchor captured just before an older-page import so the viewport can
    // stay pinned to the same message as older content is inserted above it. The
    // leading message id is recorded with it: the loader refuses outright while a
    // turn is running, which leaves an anchor nothing will consume, and a later
    // streaming message would otherwise be mistaken for a prepend and restore
    // against stale geometry. Only a changed leading id is a real prepend.
    const olderAnchorRef = useRef<{ scrollHeight: number; scrollTop: number; firstMessageId?: string } | null>(null);

    // Last observed scrollTop, used to detect scroll direction so older-page fetches
    // only fire on genuine upward scrolls — never on the initial scroll-to-bottom or
    // the programmatic position restore after a prepend.
    const lastScrollTopRef = useRef(0);

    // Single owner of the older-page fetch, so every caller captures the scroll
    // anchor the restore effect below depends on.
    const requestOlderMessages = useCallback(() => {
        const viewport = viewportRef.current;

        if (!viewport || !onLoadOlderMessages) return;
        if (!hasMoreOlderMessages || isLoadingOlderMessages) return;

        // Overwrites any anchor left behind by a refused request rather than
        // treating one as a request already in flight, which would lock every
        // later fetch out for the life of the mount.
        olderAnchorRef.current = {
            scrollHeight: viewport.scrollHeight,
            scrollTop: viewport.scrollTop,
            firstMessageId,
        };
        onLoadOlderMessages();
    }, [onLoadOlderMessages, hasMoreOlderMessages, isLoadingOlderMessages, firstMessageId, viewportRef]);

    // The bar lives in the header and cannot capture the anchor itself, so it
    // reaches this anchored version through the provider.
    const requestOlderMessagesRef = findContext?.requestOlderMessagesRef;

    useEffect(() => {
        if (!requestOlderMessagesRef) return undefined;

        requestOlderMessagesRef.current = requestOlderMessages;

        return () => {
            requestOlderMessagesRef.current = null;
        };
    }, [requestOlderMessagesRef, requestOlderMessages]);

    // Register a GenUI tool-UI renderer per linked app (spec §12). Stable here:
    // ChatThread lives inside the runtime provider for the conversation's life.
    useGenUIToolUI(agent?.apps);

    useEffect(() => {
        const viewport = viewportRef.current;
        const leftSide = viewport?.closest('.left-side');

        if (!viewport || !leftSide) return undefined;

        const updateHeaderShadow = () => {
            leftSide.classList.toggle('header-title-shadow-visible', viewport.scrollTop > 0);
        };

        updateHeaderShadow();
        viewport.addEventListener('scroll', updateHeaderShadow, { passive: true });

        return () => {
            viewport.removeEventListener('scroll', updateHeaderShadow);
            leftSide.classList.remove('header-title-shadow-visible');
        };
    }, [viewportRef]);

    // ChatThread is not remounted on conversation switch, so clear the direction
    // tracker; otherwise a tall→short switch is misread as an upward scroll and
    // spuriously fetches older messages.
    useLayoutEffect(() => {
        lastScrollTopRef.current = 0;
        // A refused request leaves an anchor nothing consumes; carried into another
        // conversation, its geometry restores a scroll position from the old one.
        olderAnchorRef.current = null;
    }, [conversationId]);

    // Matches belong to the thread that produced them, so a move to a different
    // conversation discards the whole search. null -> id is the SAME conversation
    // being persisted after its first turn, which must not interrupt a search the
    // user is part-way through.
    const previousConversationIdForFindRef = useRef(conversationId);

    useEffect(() => {
        const previous = previousConversationIdForFindRef.current;

        previousConversationIdForFindRef.current = conversationId;

        if (previous === null || previous === conversationId) return;

        closeFind?.();
    }, [conversationId, closeFind]);

    // Trigger an older-page fetch when the user scrolls up to the top of the thread.
    useEffect(() => {
        const viewport = viewportRef.current;

        if (!viewport || !onLoadOlderMessages) return undefined;

        const onScroll = () => {
            const { scrollTop } = viewport;
            const previousScrollTop = lastScrollTopRef.current;

            lastScrollTopRef.current = scrollTop;

            if (skipNextScrollRef.current) {
                skipNextScrollRef.current = false;

                return;
            }

            // Fetch only when the user scrolls up and reaches the very top of the
            // thread. The direction check keeps the initial scroll-to-bottom and the
            // post-prepend restore (both downward) from ever triggering a fetch.
            if (scrollTop >= previousScrollTop) return;
            if (scrollTop > 0) return;

            requestOlderMessages();
        };

        viewport.addEventListener('scroll', onScroll, { passive: true });

        return () => viewport.removeEventListener('scroll', onScroll);
    }, [onLoadOlderMessages, requestOlderMessages]);

    // After older messages are prepended (message count grows), restore scroll so the
    // previously-visible message stays put instead of the viewport jumping upward.
    useLayoutEffect(() => {
        const viewport = viewportRef.current;
        const anchor = olderAnchorRef.current;

        if (!viewport || !anchor) return;
        if (firstMessageId === anchor.firstMessageId) return;

        olderAnchorRef.current = null;

        const delta = viewport.scrollHeight - anchor.scrollHeight;

        if (delta <= 0) return;

        scrollInstantly(viewport, anchor.scrollTop + delta);
    }, [messageCount, firstMessageId, viewportRef]);

    const renderFindTicks = () => {
        if (!isFindOpen || !findContext) return null;

        const { find } = findContext;

        return (
            <FindMatchTicks ticks={find.ticks} activeKey={find.activePosition > 0 ? find.activePosition - 1 : null} />
        );
    };

    return (
        <ThreadPrimitive.Root
            className={cn(
                'aui-root aui-thread-root relative flex h-full w-full flex-col bg-background text-sm',
                className,
                classNames.thread,
            )}
        >
            <ThreadPrimitive.Viewport
                ref={viewportRef}
                turnAnchor="top"
                topAnchorMessageClamp={{ tallerThan: '999em', visibleHeight: '100em' }}
                data-slot="aui_thread-viewport"
                className={cn(
                    'scrollbar-controller scrollbar-vertical relative flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden scroll-smooth',
                    'scrollbar-gutter-stable transition-[width] duration-200',
                    viewportClassName,
                    classNames.viewport,
                )}
                autoScroll={false}
                scrollToBottomOnInitialize={false}
                scrollToBottomOnThreadSwitch={false}
            >
                {scrollToBottomOnLoad && <ScrollToBottomOnMessagesLoaded />}
                <TopAnchorTurnSync />

                {/* Floating, zero-height loader so fetching older messages never shifts the scroll. */}
                {isLoadingOlderMessages && (
                    <div
                        className="sticky top-0 z-10 flex h-0 items-start justify-center overflow-visible"
                        aria-live="polite"
                    >
                        <Spinner className="mt-3 size-5 text-text-secondary" />
                    </div>
                )}

                <div
                    data-slot="aui_message-group"
                    className={cn('flex flex-col gap-y-6 empty:hidden', messagesClassName)}
                >
                    <BranchedFromBannerTop />
                    <ThreadPrimitive.Messages>
                        {({ message }) => {
                            if (message.role === 'user') return <UserMessage />;

                            return (
                                <>
                                    <AssistantMessage />
                                    <BranchedFromBannerAfterMessage />
                                </>
                            );
                        }}
                    </ThreadPrimitive.Messages>
                    {afterMessages}
                    {isPendingGeneration && <PendingGenerationIndicator />}
                </div>

                <ThreadPrimitive.ViewportFooter className="aui-thread-viewport-footer sticky bottom-0 mt-auto flex flex-col gap-4 overflow-visible bg-background">
                    <ScrollToBottomButton />
                    {composerNode}
                </ThreadPrimitive.ViewportFooter>
            </ThreadPrimitive.Viewport>
            {renderFindTicks()}
            {enableMessageNav && <MessageNavRail viewportRef={viewportRef} isHidden={isSidePanelOpen || isFindOpen} />}
        </ThreadPrimitive.Root>
    );
};

const ScrollToBottomOnMessagesLoaded: FC = () => {
    useScrollToBottomOnLoad();

    return null;
};

// With turnAnchor="top" the viewport pins the live turn by message ID
// (topAnchorTurn) and keeps it pinned after the run ends. When the thread is
// re-imported from the server (importExternalState on conversation load),
// optimistic client message IDs are swapped for persisted ones. The pinned IDs
// go stale, the anchor/target elements unregister, and the reserve spacer
// collapses — the thread visibly jumps down. Re-point the pin at the current
// last user/assistant pair whenever it drifts, and drop it when the route
// switches to a different conversation (this component is not remounted on
// switch, so the library's thread.initialize clear never fires).
const TopAnchorTurnSync: FC = () => {
    const threadViewportStore = useThreadViewportStore();
    const { conversationId } = useChatViewContext();
    const previousConversationIdRef = useRef(conversationId);

    const lastTurnAnchorId = useAuiState((s) => {
        const anchor = s.thread.messages.at(-2);
        const target = s.thread.messages.at(-1);

        return anchor?.role === 'user' && target?.role === 'assistant' ? anchor.id : undefined;
    });
    const lastTurnTargetId = useAuiState((s) => {
        const anchor = s.thread.messages.at(-2);
        const target = s.thread.messages.at(-1);

        return anchor?.role === 'user' && target?.role === 'assistant' ? target.id : undefined;
    });

    useLayoutEffect(() => {
        const previousConversationId = previousConversationIdRef.current;

        previousConversationIdRef.current = conversationId;

        // null -> id is the SAME conversation getting persisted after its first
        // turn (navigate to /chat/{id}); the pin must survive that transition.
        if (previousConversationId === null || previousConversationId === conversationId) return;

        threadViewportStore.getState().setTopAnchorTurn(null);
    }, [conversationId, threadViewportStore]);

    useLayoutEffect(() => {
        if (!lastTurnAnchorId || !lastTurnTargetId) return;

        const state = threadViewportStore.getState();
        const pin = state.topAnchorTurn;

        // Only re-point an existing pin — history loads never create one.
        if (!pin) return;
        if (pin.anchorId === lastTurnAnchorId && pin.targetId === lastTurnTargetId) return;

        state.setTopAnchorTurn({ anchorId: lastTurnAnchorId, targetId: lastTurnTargetId });
    }, [lastTurnAnchorId, lastTurnTargetId, threadViewportStore]);

    return null;
};

const BranchedFromBannerContent: FC<{ title: string; conversationId: string }> = ({ title, conversationId }) => {
    const { navigation, slots } = useChatHost();

    const goToSource = () => navigation.setConversationId(conversationId);
    const linkClassName = 'font-semibold text-primary underline-offset-4 hover:underline! cursor-pointer';

    const renderSourceLink = () => {
        // Router-owning hosts wrap the title in a real <Link> so anchor
        // affordances (href preview, cmd/ctrl-click) keep working.
        if (slots?.renderConversationLink) {
            return <span className={linkClassName}>{slots.renderConversationLink(conversationId, title)}</span>;
        }

        return (
            <span
                role="button"
                tabIndex={0}
                onClick={goToSource}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        goToSource();
                    }
                }}
                className={linkClassName}
            >
                {title}
            </span>
        );
    };

    return (
        <div className="branched-from-banner mb-0 flex items-center gap-3 py-2 text-sm text-primary last:mb-6">
            <div className="h-px flex-1 bg-primary/50" />
            <span className="line-clamp-1 max-w-[70%] shrink-0 text-muted-foreground">
                {'Branched from '}
                {renderSourceLink()}
            </span>
            <div className="h-px flex-1 bg-primary/50" />
        </div>
    );
};

const BranchedFromBannerTop: FC = () => {
    const { branchedFromConversation, agent } = useChatViewContext();

    if (!branchedFromConversation || !agent || branchedFromConversation.messageId) return null;

    return (
        <BranchedFromBannerContent
            title={branchedFromConversation.title}
            conversationId={branchedFromConversation.id}
        />
    );
};

const BranchedFromBannerAfterMessage: FC = () => {
    const { branchedFromConversation, agent } = useChatViewContext();
    const messageId = useAuiState((s) => s.message.id);

    if (!branchedFromConversation?.messageId || !agent) return null;
    if (messageId !== branchedFromConversation.messageId) return null;

    return (
        <BranchedFromBannerContent
            title={branchedFromConversation.title}
            conversationId={branchedFromConversation.id}
        />
    );
};

export { ChatThread };
