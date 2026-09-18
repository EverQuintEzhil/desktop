import {
    ArrowLeftIcon,
    HistoryIcon,
    PanelRightCloseIcon,
    PanelRightOpenIcon,
    PlusIcon,
    SparklesIcon,
    XIcon,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import type { ChatClassNames } from '@/components/chat-host';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import { useRecentsUi } from '../recents/recents-context';

type LayoutMode = 'floating' | 'sidebar';

interface FloatingShellProps {
    /** The shared chat shell subtree, rendered as the panel content. */
    children: ReactNode;
    /** Optional per-part class overrides (`launcher`, `panel`). */
    classNames?: ChatClassNames;
    /** Accessible label for the widget; also shown in the panel header. */
    label?: string;
    /**
     * When docked as a right sidebar, reserve space on the host document (push
     * host content left). Default true. Set false to overlay without shifting.
     */
    sidebarReservesSpace?: boolean;
    /**
     * New-chat handler for the header "+ New chat" button. Falls back to the
     * recents-context `triggerNewChat` when omitted, so a host without the
     * recents context (e.g. the in-app admin assistant) can still wire new-chat.
     */
    onNewChat?: () => void;
}

/** Width reserved for host content when the panel is docked as a sidebar. */
const SIDEPANE_WIDTH = '420px';

/**
 * Floating chat widget chrome for `type="floating"`.
 *
 * Renders a fixed launcher bubble (bottom-right) that opens a panel hosting the
 * SDK's shared chat shell (passed as `children`) so every feature — recents,
 * composer, streaming, tools — works inside it. The chrome (launcher + panel
 * geometry, layout toggle, animation) mirrors the app's existing
 * `floating-assistant` widget for a consistent look.
 *
 * Two layout modes (default `floating`): a floating window anchored above the
 * launcher, or a full-height right sidebar. In sidebar mode the widget adds a
 * `fm-chat-sidepane-open` class and a `--fm-chat-sidepane-width` var to the host
 * document `<body>` so the host page can reserve space for the dock; both are
 * cleaned up on close/unmount. In an embedded host this reserves space on the
 * host document — that is the intended sidebar behavior.
 *
 * Everything is `position: fixed`, so the widget anchors to the viewport
 * regardless of the host mount node's size or position. The shell subtree is
 * mounted lazily on first open and then kept mounted, so opening never re-fires
 * the agent load and reopening preserves the conversation.
 */
export const FloatingShell = ({
    children,
    classNames,
    label = 'Assistant',
    sidebarReservesSpace = true,
    onNewChat,
}: FloatingShellProps) => {
    const [open, setOpen] = useState(false);
    const [everOpened, setEverOpened] = useState(false);
    const [layoutMode, setLayoutMode] = useState<LayoutMode>('floating');
    const { enabled: recentsEnabled, open: recentsOpen, setOpen: setRecentsOpen, triggerNewChat } = useRecentsUi();

    const isSidebar = layoutMode === 'sidebar';
    const handleNewChat = onNewChat ?? triggerNewChat;

    // Sidebar mode docks the panel full-height on the right. Toggle a body class
    // and expose the dock width so a FluentMind-style host can reserve space via
    // its own CSS rule; ALSO reserve space generically by padding the body right
    // by the dock width, so external hosts (which have no such rule) still shift
    // their content left instead of letting the fixed sidebar overlay it. Prior
    // inline `padding-right`/`transition` are saved and restored so host styles
    // are not clobbered. Cleanup runs on close, switch-to-floating, or unmount.
    useEffect(() => {
        const { body } = document;
        const reserve = open && isSidebar && sidebarReservesSpace;
        // Capture pre-effect inline values before any mutation so both the
        // not-reserving path and the cleanup restore exactly what was there.
        const prevPaddingRight = body.style.paddingRight;
        const prevTransition = body.style.transition;

        body.classList.toggle('fm-chat-sidepane-open', reserve);

        if (reserve) {
            body.style.setProperty('--fm-chat-sidepane-width', SIDEPANE_WIDTH);
            body.style.transition = 'padding-right 180ms ease';
            body.style.paddingRight = SIDEPANE_WIDTH;
        } else {
            body.style.removeProperty('--fm-chat-sidepane-width');
            body.style.paddingRight = prevPaddingRight;
            body.style.transition = prevTransition;
        }

        return () => {
            body.classList.remove('fm-chat-sidepane-open');
            body.style.removeProperty('--fm-chat-sidepane-width');
            body.style.paddingRight = prevPaddingRight;
            body.style.transition = prevTransition;
        };
    }, [open, isSidebar, sidebarReservesSpace]);

    const openPanel = () => {
        setEverOpened(true);
        setOpen(true);
    };

    const closePanel = () => setOpen(false);

    const toggleLayoutMode = () => setLayoutMode((current) => (current === 'floating' ? 'sidebar' : 'floating'));

    const renderLauncher = () => (
        <Button
            type="button"
            size="icon"
            className={cn(
                'fm-chat-launcher',
                'fixed right-6 bottom-6 z-50 size-12 rounded-full shadow-lg',
                'bg-primary! text-primary-foreground!',
                classNames?.launcher,
            )}
            title={open ? 'Close chat' : 'Open chat'}
            aria-label={open ? 'Close chat' : 'Open chat'}
            aria-expanded={open}
            onClick={open ? closePanel : openPanel}
        >
            <span
                className={cn(
                    'absolute inset-0 flex items-center justify-center transition-all duration-200 ease-out',
                    open ? 'scale-75 rotate-90 opacity-0' : 'scale-100 rotate-0 opacity-100',
                )}
            >
                <SparklesIcon className="size-5" />
            </span>
            <span
                className={cn(
                    'absolute inset-0 flex items-center justify-center transition-all duration-200 ease-out',
                    open ? 'scale-100 rotate-0 opacity-100' : 'scale-75 -rotate-90 opacity-0',
                )}
            >
                <XIcon className="size-5" />
            </span>
        </Button>
    );

    const isRecentsMode = recentsOpen && recentsEnabled;

    const renderIconButton = ({
        icon,
        label,
        onClick,
        pressed,
    }: {
        icon: ReactNode;
        label: string;
        onClick: () => void;
        pressed?: boolean;
    }) => (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    aria-label={label}
                    aria-pressed={pressed}
                    onClick={onClick}
                >
                    {icon}
                </Button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    );

    const renderChatHeader = () => (
        <>
            <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15">
                    <SparklesIcon className="size-3.5 text-primary" />
                </div>
                <span className="truncate text-sm font-semibold">{label}</span>
            </div>
            <div className="flex items-center gap-0.5">
                {renderIconButton({
                    icon: <PlusIcon className="size-3.5" />,
                    label: 'New chat',
                    onClick: handleNewChat,
                })}
                {recentsEnabled &&
                    renderIconButton({
                        icon: <HistoryIcon className="size-3.5" />,
                        label: 'Recents',
                        onClick: () => setRecentsOpen(true),
                        pressed: recentsOpen,
                    })}
                {renderIconButton({
                    icon: isSidebar ? (
                        <PanelRightCloseIcon className="size-3.5" />
                    ) : (
                        <PanelRightOpenIcon className="size-3.5" />
                    ),
                    label: isSidebar ? 'Use floating window' : 'Open right sidebar',
                    onClick: toggleLayoutMode,
                    pressed: isSidebar,
                })}
                {renderIconButton({
                    icon: <XIcon className="size-3.5" />,
                    label: 'Close',
                    onClick: closePanel,
                })}
            </div>
        </>
    );

    const renderRecentsHeader = () => (
        <>
            <div className="flex min-w-0 items-center gap-1.5">
                {renderIconButton({
                    icon: <ArrowLeftIcon className="size-3.5" />,
                    label: 'Back to chat',
                    onClick: () => setRecentsOpen(false),
                })}
                <span className="truncate text-sm font-semibold">Recents</span>
            </div>
            <div className="flex items-center gap-0.5">
                {renderIconButton({
                    icon: <PlusIcon className="size-3.5" />,
                    label: 'New chat',
                    onClick: handleNewChat,
                })}
                {renderIconButton({
                    icon: <XIcon className="size-3.5" />,
                    label: 'Close',
                    onClick: closePanel,
                })}
            </div>
        </>
    );

    const renderHeader = () => (
        <TooltipProvider>
            <div className="flex shrink-0 items-center justify-between border-b border-primary/15 bg-linear-to-b from-primary/6 to-transparent px-4 py-3">
                {isRecentsMode ? renderRecentsHeader() : renderChatHeader()}
            </div>
        </TooltipProvider>
    );

    const renderPanel = () => (
        <div
            role="dialog"
            aria-label={label}
            hidden={!open}
            className={cn(
                'z-50 flex animate-in flex-col overflow-hidden border border-primary/20 bg-background duration-200 fade-in-0',
                isSidebar
                    ? 'fixed inset-y-0 right-0 h-dvh w-(--fm-chat-sidepane-width) border-y-0 border-r-0 shadow-none'
                    : 'fixed right-6 bottom-[5.25rem] h-[min(640px,calc(100vh-9rem))] w-[min(calc(100vw-2rem),420px)] rounded-xl shadow-2xl slide-in-from-bottom-4',
                classNames?.panel,
            )}
        >
            {renderHeader()}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
        </div>
    );

    return (
        <>
            {!(open && isSidebar) && renderLauncher()}
            {everOpened && renderPanel()}
        </>
    );
};
