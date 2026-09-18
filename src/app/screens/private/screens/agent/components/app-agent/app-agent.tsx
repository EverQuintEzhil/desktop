import { PanelLeftCloseIcon, PanelRightCloseIcon, SparklesIcon } from 'lucide-react';
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type KeyboardEvent as ReactKeyboardEvent,
    type ReactNode,
} from 'react';
import { useSelector } from 'react-redux';
import {
    MemoryRouter,
    Navigate,
    Route,
    Routes,
    UNSAFE_LocationContext,
    UNSAFE_RouteContext,
    useLocation,
    useNavigate,
} from 'react-router-dom';

import { ChatShellContext, type ChatShellValue } from '@/components/agent-chat/context/chat-shell-context';
import { RecentsUiProvider } from '@/components/agent-chat/recents/recents-context';
import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';
import { selectUser } from '@/store/selectors';
import type { AppAgentType, ChatAgentType } from '@/types/admin';
import { shouldEscapeKeepDialogOpen } from '@/utils/escape-cancels-edit';

import ChatAgentNew from '../chat-agent';

import { applyAppNavigate, findAppNavigate, FORM_PREFILL_KEY } from './app-navigate';
import AppPane from './app-pane';
import { changeAppPane, detailAppPaneActions, dispatchAppPaneAction, readAppPaneContext } from './app-pane-channel';
import AssistantPanelChrome from './assistant-panel-chrome';
import {
    useAppAgentTools,
    type GetAppViewResult,
    type NavigateAppArgs,
    type NavigateAppResult,
    type SetAppViewArgs,
    type SetAppViewResult,
} from './frontend-tools';
import { clearStored, readStored, writeStored } from './panel-storage';
import { toChatAgentView } from './to-chat-agent-view';
import { useAssistantVisibility } from './use-assistant-visibility';
import { clampPanelWidth, MIN_PANEL_WIDTH, usePanelResize } from './use-panel-resize';

// The app root already renders a BrowserRouter. react-router v7 throws when a Router
// is nested inside another, and its <Routes> resolves paths relative to the parent
// route match — so the inner MemoryRouter would both crash and fail to match. Reset
// both contexts to their top-level defaults so the assistant panel router is fully
// isolated from the outer app route and matches from the root (same pattern as the
// admin builder's chat preview).
const ROOT_ROUTE_CONTEXT = { outlet: null, matches: [], isDataRoute: false };

const IsolatedRouterContext = ({ children }: { children: ReactNode }) => (
    <UNSAFE_LocationContext.Provider value={null as never}>
        <UNSAFE_RouteContext.Provider value={ROOT_ROUTE_CONTEXT as never}>{children}</UNSAFE_RouteContext.Provider>
    </UNSAFE_LocationContext.Provider>
);

const DEFAULT_PANEL_RATIO = 0.25;
const SINGLE_PANE_BELOW = 1024;
const DOCKED_QUERY = `(min-width: ${SINGLE_PANE_BELOW}px)`;
const MIN_APP_PANE_WIDTH = SINGLE_PANE_BELOW - MIN_PANEL_WIDTH;
const DOCKED_PANEL_MAX_WIDTH = `calc(100vw - ${MIN_APP_PANE_WIDTH}px)`;
const DRAWER_MAX_WIDTH = 640;

const defaultPanelWidth = (): number =>
    clampPanelWidth(typeof window !== 'undefined' ? window.innerWidth * DEFAULT_PANEL_RATIO : 420);

const CONVERSATION_PARAM = 'chat';

type AssistantSide = 'left' | 'right';

/**
 * `componentType: "app"` — a traditional application with an embedded AI
 * assistant. The app pane (a full-page GenUI bundle that calls the agent's
 * tools directly, no model in the loop) is the primary surface at ~75% width;
 * the full chat experience docks beside it as a collapsible, resizable
 * assistant panel (~25%, min 340px) — on the RIGHT by default
 * (uiConfig `app.assistantSide` sets the default; the user can flip it and
 * the choice persists per browser). The app is fully usable with the
 * assistant collapsed; both sides stay in sync — app "Ask assistant" actions
 * push messages into the chat, and each finished agent turn bumps
 * `assistantTurn` so the app re-queries its data.
 */
const AppAgent = ({ agent }: { agent: AppAgentType }) => {
    const user = useSelector(selectUser);
    const openKey = `fm.app-assistant.${agent._id}.open`;
    const widthKey = `fm.app-assistant.${agent._id}.width`;
    const sideKey = `fm.app-assistant.${agent._id}.side`;
    // User-scoped, unlike the layout keys: a shared browser must not restore another account's chat.
    const conversationKey = `fm.app-assistant.${agent._id}.${user._id || 'anon'}.conversation`;

    const isSinglePane = !useMediaQuery(DOCKED_QUERY);
    const {
        isOpen: assistantOpen,
        open: showAssistant,
        close: hideAssistant,
    } = useAssistantVisibility({
        openKey,
        isSinglePane,
        defaultOpen: agent.uiConfig.app?.assistantDefaultOpen !== false,
    });
    // The chat mounts lazily the first time the panel is visible, then stays mounted so hiding it
    // never drops the conversation. Latched off the visible state rather than the open action: a
    // window wide enough to dock the panel reveals it again without anyone pressing anything.
    const hasMountedChatRef = useRef(assistantOpen);

    if (assistantOpen) hasMountedChatRef.current = true;

    const chatMounted = hasMountedChatRef.current;
    const [panelWidth, setPanelWidth] = useState<number>(() => {
        const stored = Number(readStored(widthKey));

        return Number.isFinite(stored) && stored > 0 ? clampPanelWidth(stored) : defaultPanelWidth();
    });
    const [assistantSide, setAssistantSide] = useState<AssistantSide>(() => {
        const stored = readStored(sideKey);

        if (stored === 'left' || stored === 'right') return stored;

        return agent.uiConfig.app?.assistantSide === 'left' ? 'left' : 'right';
    });
    const [assistantTurn, setAssistantTurn] = useState(0);
    const panelRef = useRef<HTMLDivElement>(null);
    const escapeRef = useRef<() => boolean>(() => false);
    const openButtonRef = useRef<HTMLButtonElement>(null);
    const wasDrawerOpenRef = useRef(false);
    const wasPanelVisibleRef = useRef(false);
    const [recentsOpen, setRecentsOpen] = useState(false);
    // The chat runs in its own MemoryRouter, so its conversation never reaches the address bar
    // by itself. The host mirrors it onto this param and into localStorage: the param wins so a
    // shared or bookmarked link opens that conversation, and the key covers a plain reload.
    const hostLocation = useLocation();
    const hostNavigate = useNavigate();
    const hostLocationRef = useRef(hostLocation);
    const hostNavigateRef = useRef(hostNavigate);

    hostLocationRef.current = hostLocation;
    hostNavigateRef.current = hostNavigate;

    const [initialChatEntry] = useState(() => {
        const restored =
            new URLSearchParams(hostLocation.search).get(CONVERSATION_PARAM) || readStored(conversationKey);

        return restored ? `/agent/${agent.slug}/chat/${restored}` : `/agent/${agent.slug}`;
    });

    const sendRef = useRef<((text: string) => void) | null>(null);
    const pendingSendsRef = useRef<string[]>([]);

    const closeAssistant = useCallback(
        (options?: { persist?: boolean }) => {
            setRecentsOpen(false);
            hideAssistant(options);
        },
        [hideAssistant],
    );

    // Dialog focus contract. Focus moves into the drawer when it opens, so Escape and the screen
    // reader have somewhere to land, and is parked deliberately whenever the node holding it is
    // about to be hidden or unmounted — a window resize can do either, and the browser would
    // otherwise drop focus on <body>. Merely re-docking an open panel moves nothing.
    useEffect(() => {
        const isDrawerOpen = isSinglePane && assistantOpen;
        const wasDrawerOpen = wasDrawerOpenRef.current;
        const wasPanelVisible = wasPanelVisibleRef.current;

        wasDrawerOpenRef.current = isDrawerOpen;
        wasPanelVisibleRef.current = assistantOpen;

        const holdsFocus = () =>
            document.activeElement === null ||
            document.activeElement === document.body ||
            panelRef.current?.contains(document.activeElement) === true;

        if (isDrawerOpen && !wasDrawerOpen) {
            if (!panelRef.current?.contains(document.activeElement)) panelRef.current?.focus();

            return;
        }

        // The panel just went away: its own focus, if any, belongs on the button that reopens it.
        if (!assistantOpen && wasPanelVisible && holdsFocus()) {
            openButtonRef.current?.focus();

            return;
        }

        // The panel just appeared, so the button that was focused to open it is unmounting.
        if (assistantOpen && !wasPanelVisible && document.activeElement === document.body) {
            panelRef.current?.focus();
        }
    }, [isSinglePane, assistantOpen]);

    const flipAssistantSide = useCallback(() => {
        setAssistantSide((side) => {
            const next: AssistantSide = side === 'left' ? 'right' : 'left';

            writeStored(sideKey, next);

            return next;
        });
    }, [sideKey]);

    const handleConversationChange = useCallback(
        (conversationId: string | null) => {
            if (conversationId) {
                writeStored(conversationKey, conversationId);
            } else {
                clearStored(conversationKey);
            }

            const { pathname, search } = hostLocationRef.current;
            const params = new URLSearchParams(search);

            if (conversationId) {
                params.set(CONVERSATION_PARAM, conversationId);
            } else {
                params.delete(CONVERSATION_PARAM);
            }

            const nextSearch = params.toString();

            if (nextSearch === search.replace(/^\?/, '')) return;

            // The app pane routes itself through the fragment and sets it on `window.location`
            // directly, so the router's own copy can be stale. Carrying it explicitly is what
            // keeps a pane deep link alive across a conversation change; a bare search-param
            // navigation resolves the fragment to empty and drops the pane back to its root.
            // Replace rather than push, so switching chats does not fill the back stack.
            hostNavigateRef.current({ pathname, search: nextSearch, hash: window.location.hash }, { replace: true });
        },
        [conversationKey],
    );

    const registerExternalSend = useCallback((send: (text: string) => void) => {
        sendRef.current = send;
        pendingSendsRef.current.splice(0).forEach(send);

        return () => {
            if (sendRef.current === send) sendRef.current = null;
        };
    }, []);

    const handleAskAssistant = useCallback(
        (text: string) => {
            showAssistant();

            if (sendRef.current) {
                sendRef.current(text);
            } else {
                // Chat not mounted/registered yet — flushed by registerExternalSend.
                pendingSendsRef.current.push(text);
            }
        },
        [showAssistant],
    );

    const handleNavigateApp = useCallback(async ({ hash, prefill }: NavigateAppArgs): Promise<NavigateAppResult> => {
        if (!hash.startsWith('#/')) {
            return { ok: false, error: `Route "${hash}" was not opened: a hash route must start with "#/".` };
        }

        // The key is global and only the destination clears it, so an accepted
        // navigation drops any earlier write — a prefill whose page never mounted
        // must not leak forward. A refused hash navigates nowhere, so it keeps it.
        try {
            sessionStorage.removeItem(FORM_PREFILL_KEY);
        } catch {
            // Storage unavailable; nothing to leak either.
        }

        const { settled } = await changeAppPane(() => applyAppNavigate({ hash, prefill }));

        return { ok: true, ...settled };
    }, []);

    // Read through a ref so the shell value stays stable: a new value remounts nothing but does
    // re-render the whole chat on every layout change.
    escapeRef.current = () => {
        if (!isSinglePane || !assistantOpen) return false;

        closeAssistant({ persist: false });

        return true;
    };

    const handleSetAppView = useCallback(async ({ action, args }: SetAppViewArgs): Promise<SetAppViewResult> => {
        const name = typeof action === 'string' ? action.trim() : '';

        if (!name) return { ok: false, error: 'No action name was given.' };

        const { change: result, settled } = await changeAppPane(() =>
            dispatchAppPaneAction({ name, args: args ?? {} }),
        );

        if (!result.ok) return result;

        return { ...result, ...settled };
    }, []);

    const handleGetAppView = useCallback(async (): Promise<GetAppViewResult> => {
        const context = readAppPaneContext();

        if (!context) return { ok: false, error: 'The app pane has not reported a view yet.' };

        const page = context.state && typeof context.state === 'object' ? context.state.page : undefined;

        let state: string | undefined;

        if (context.state && typeof context.state === 'object' && !Array.isArray(context.state)) {
            try {
                state = JSON.stringify(context.state);
            } catch {
                // Circular or otherwise unserializable — the rest still stands.
            }
        }

        return {
            ok: true,
            ...(typeof page === 'string' && page !== '' && { page }),
            ...(typeof context.summary === 'string' && context.summary.trim() !== '' && { summary: context.summary }),
            ...(state && state !== '{}' ? { state } : {}),
            actions: detailAppPaneActions(context),
        };
    }, []);

    const clientToolkit = useAppAgentTools({
        onNavigateApp: handleNavigateApp,
        onSetAppView: handleSetAppView,
        onGetAppView: handleGetAppView,
    });

    const shellValue = useMemo<ChatShellValue>(
        () => ({
            isPreview: false,
            variant: 'panel',
            clientToolkit,
            onTurnFinish: (message) => {
                setAssistantTurn((turn) => turn + 1);

                const nav = findAppNavigate(message);

                if (nav) applyAppNavigate(nav);
            },
            registerExternalSend,
            onConversationChange: handleConversationChange,
            onEscape: () => escapeRef.current(),
        }),
        [registerExternalSend, clientToolkit, handleConversationChange],
    );

    const recentsValue = useMemo(
        () => ({
            enabled: true,
            open: recentsOpen,
            setOpen: setRecentsOpen,
            // Open Recents turns the chrome row into the Recents header, so the panel must not
            // render a second one below it.
            headerOwnsToggle: true,
        }),
        [recentsOpen],
    );

    const chatAgent = useMemo<ChatAgentType>(() => toChatAgentView(agent), [agent]);
    const { isResizing, handleResizeStart } = usePanelResize({ widthKey, assistantSide, setPanelWidth });

    const assistantLabel = agent.uiConfig.app?.assistantLabel || agent.name || 'Assistant';
    const onLeft = assistantSide === 'left';
    const HideIcon = onLeft ? PanelLeftCloseIcon : PanelRightCloseIcon;

    const renderScrim = () => (
        <div
            data-slot="app-assistant-scrim"
            aria-hidden="true"
            className="absolute inset-0 z-30 bg-foreground/35"
            onClick={() => closeAssistant({ persist: false })}
        />
    );

    // Escape from outside the chat box. A Radix layer (tooltip, menu) that owns the key has already
    // prevented default, and the chat box normally comes back through the shell's `onEscape`
    // instead — but prosemirror-view returns before preventDefault while an IME composition is
    // open, so a composition-cancelling Escape does reach this handler and must not close the
    // drawer. `shouldEscapeKeepDialogOpen` covers the auto-repeat and mid-edit cases with it.
    const handleDrawerKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
        if (!isSinglePane || event.key !== 'Escape' || event.defaultPrevented) return;

        if (event.nativeEvent.isComposing || shouldEscapeKeepDialogOpen(event.nativeEvent)) return;

        closeAssistant({ persist: false });
    };

    const renderResizeGrip = () => (
        <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize assistant panel"
            className={cn(
                'absolute inset-y-0 z-10 w-1.5 cursor-col-resize transition-colors hover:bg-primary/30',
                onLeft ? 'right-0' : 'left-0',
            )}
            onPointerDown={handleResizeStart}
        />
    );

    const renderAssistantPanel = () => (
        <ChatShellContext.Provider value={shellValue}>
            <RecentsUiProvider value={recentsValue}>
                {isSinglePane && assistantOpen && renderScrim()}
                <div
                    ref={panelRef}
                    data-slot="app-assistant-panel"
                    data-layout={isSinglePane ? 'drawer' : 'docked'}
                    tabIndex={-1}
                    role={isSinglePane ? 'dialog' : undefined}
                    aria-modal={isSinglePane ? true : undefined}
                    aria-label={isSinglePane ? assistantLabel : undefined}
                    onKeyDown={handleDrawerKeyDown}
                    className={cn(
                        'flex h-full shrink-0 flex-col overflow-hidden border-border bg-background outline-none',
                        // The chat box grows with typed text; in a narrow column the full-page
                        // allowance would swallow the title and starter questions above it.
                        '[--chat-editor-max-height:40svh]',
                        onLeft ? 'border-r' : 'border-l',
                        isSinglePane ? 'absolute inset-y-0 z-40 w-full shadow-xl' : 'relative',
                        isSinglePane && (onLeft ? 'left-0' : 'right-0'),
                        !assistantOpen && 'hidden',
                    )}
                    style={
                        isSinglePane
                            ? { maxWidth: DRAWER_MAX_WIDTH }
                            : { width: panelWidth, maxWidth: DOCKED_PANEL_MAX_WIDTH }
                    }
                >
                    <AssistantPanelChrome
                        agent={agent}
                        assistantLabel={assistantLabel}
                        onLeft={onLeft}
                        hideIcon={HideIcon}
                        onFlipSide={flipAssistantSide}
                        onHide={() => closeAssistant()}
                    />
                    <div
                        className={cn(
                            'flex min-h-0 flex-1 flex-col overflow-hidden',
                            isResizing && 'pointer-events-none',
                        )}
                    >
                        {chatMounted && (
                            <div className="flex h-full min-h-0 flex-col overflow-hidden">
                                <IsolatedRouterContext>
                                    <MemoryRouter initialEntries={[initialChatEntry]}>
                                        <Routes>
                                            <Route
                                                path="/agent/:agentId/*"
                                                element={<ChatAgentNew agent={chatAgent} />}
                                            />
                                            <Route
                                                path="*"
                                                element={<Navigate to={`/agent/${agent.slug}`} replace />}
                                            />
                                        </Routes>
                                    </MemoryRouter>
                                </IsolatedRouterContext>
                            </div>
                        )}
                    </div>
                    {!isSinglePane && renderResizeGrip()}
                </div>
            </RecentsUiProvider>
        </ChatShellContext.Provider>
    );

    // Bottom-right of the whole split view, not of the app pane: the pane is an isolated stacking
    // context, so a launcher inside it loses to a bundle's own sticky header and becomes unclickable.
    const renderAssistantToggle = () => (
        <div className="absolute right-5 bottom-5 z-50">
            <SimpleTooltip content={`Ask ${assistantLabel}`} side="left">
                <Button
                    ref={openButtonRef}
                    type="button"
                    className="size-11 rounded-full shadow-lg"
                    size="icon"
                    aria-label={`Open ${assistantLabel}`}
                    onClick={showAssistant}
                >
                    <SparklesIcon className="size-5" />
                </Button>
            </SimpleTooltip>
        </div>
    );

    const renderAppPane = () => (
        // `isolate` keeps the bundle's own z-indexes (sticky headers) below the drawer and scrim;
        // `inert` keeps keyboard focus out of the dimmed app while the drawer is open.
        <div
            data-slot="app-agent-pane"
            className="relative isolate h-full min-w-0 flex-1"
            inert={isSinglePane && assistantOpen ? true : undefined}
        >
            <AppPane
                agent={agent}
                userId={user._id || 'anon'}
                assistantTurn={assistantTurn}
                onAskAssistant={handleAskAssistant}
            />
        </div>
    );

    return (
        <div
            data-slot="app-agent"
            className={cn('relative flex h-svh w-full overflow-hidden', isResizing && 'select-none')}
        >
            {onLeft ? (
                <>
                    {renderAssistantPanel()}
                    {renderAppPane()}
                </>
            ) : (
                <>
                    {renderAppPane()}
                    {renderAssistantPanel()}
                </>
            )}
            {!assistantOpen && renderAssistantToggle()}
        </div>
    );
};

export default AppAgent;
