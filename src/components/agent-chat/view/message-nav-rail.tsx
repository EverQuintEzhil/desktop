import { useAui, useAuiState } from '@assistant-ui/react';
import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react';

import DirectiveLabel from '@/components/chat/primitives/directive-label';
import { cn } from '@/lib/utils';

import { useMentionSuggestions } from '../hooks/use-mention-suggestions';

import { useChatViewContext } from './chat-view-context';

interface MessageNavRailProps {
    viewportRef: RefObject<HTMLDivElement | null>;
    isHidden?: boolean;
}

interface NavItem {
    id: string;
    text: string;
}

const MIN_GUTTER = 48;
const TOP_OFFSET = 12;
const MESSAGE_COLUMN_WIDTH = 810;
const USER_MESSAGE_SELECTOR = '[data-role="user"][data-message-id]';

const MessageNavRail = ({ viewportRef, isHidden = false }: MessageNavRailProps) => {
    const aui = useAui();
    const { agent } = useChatViewContext();
    const suggestions = useMentionSuggestions(agent);
    const signature = useAuiState((s) =>
        s.thread.messages
            .filter((message) => message.role === 'user')
            .map((message) => message.id)
            .join('|'),
    );

    const items = useMemo<NavItem[]>(() => {
        const { messages } = aui.thread.getState();

        return messages
            .filter((message) => message.role === 'user')
            .map((message) => {
                const text = message.content
                    .filter((part) => part.type === 'text')
                    .map((part) => (part as { type: 'text'; text: string }).text)
                    .join(' ')
                    .trim();

                return { id: message.id, text };
            });
    }, [signature, aui]);

    const [activeId, setActiveId] = useState<string | null>(null);
    const [hasOffscreen, setHasOffscreen] = useState(false);
    const [hasRoom, setHasRoom] = useState(false);

    const recompute = useCallback(() => {
        const viewport = viewportRef.current;

        if (!viewport) return;

        const columnWidth =
            viewport.querySelector('[data-slot="aui_message-group"]')?.getBoundingClientRect().width ||
            MESSAGE_COLUMN_WIDTH;

        setHasRoom((viewport.clientWidth - columnWidth) / 2 >= MIN_GUTTER);

        const elements = Array.from(viewport.querySelectorAll<HTMLElement>(USER_MESSAGE_SELECTOR));

        if (elements.length === 0) {
            setActiveId(null);
            setHasOffscreen(false);

            return;
        }

        const viewportRect = viewport.getBoundingClientRect();
        const visibleTop = viewportRect.top + TOP_OFFSET;
        const visibleBottom = viewportRect.bottom;

        let firstVisibleId: string | null = null;
        let lastPassedId: string | null = null;
        let offscreen = false;

        for (const element of elements) {
            const rect = element.getBoundingClientRect();
            const id = element.dataset.messageId ?? null;
            const isVisible = rect.bottom > visibleTop && rect.top < visibleBottom;

            if (isVisible && !firstVisibleId) firstVisibleId = id;
            if (rect.bottom <= visibleTop) lastPassedId = id;
            if (rect.bottom < visibleTop || rect.top > visibleBottom) offscreen = true;
        }

        setActiveId(firstVisibleId ?? lastPassedId ?? elements[0].dataset.messageId ?? null);
        setHasOffscreen(offscreen);
    }, [viewportRef]);

    useEffect(() => {
        const viewport = viewportRef.current;

        if (!viewport) return undefined;

        let frame = 0;
        const onChange = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(recompute);
        };

        viewport.addEventListener('scroll', onChange, { passive: true });

        const resizeObserver = new ResizeObserver(onChange);

        resizeObserver.observe(viewport);

        const messageGroup = viewport.querySelector('[data-slot="aui_message-group"]');

        if (messageGroup) resizeObserver.observe(messageGroup);

        recompute();

        return () => {
            cancelAnimationFrame(frame);
            viewport.removeEventListener('scroll', onChange);
            resizeObserver.disconnect();
        };
    }, [viewportRef, recompute, signature]);

    const scrollToMessage = useCallback(
        (id: string) => {
            const viewport = viewportRef.current;

            if (!viewport) return;

            const element = viewport.querySelector<HTMLElement>(
                `[data-role="user"][data-message-id="${CSS.escape(id)}"]`,
            );

            if (!element) return;

            const delta = element.getBoundingClientRect().top - viewport.getBoundingClientRect().top;

            viewport.scrollTo({ top: viewport.scrollTop + delta - TOP_OFFSET, behavior: 'smooth' });
            setActiveId(id);
        },
        [viewportRef],
    );

    if (isHidden || !hasRoom || !hasOffscreen || items.length === 0) return null;

    const renderTicks = () => (
        <div className="message-nav-ticks flex cursor-pointer flex-col items-end gap-1.5 transition-opacity duration-150 group-hover:opacity-0">
            {items.map((item) => (
                <span
                    key={item.id}
                    className={cn(
                        'h-0.5 w-5 rounded-full transition-colors duration-150',
                        item.id === activeId ? 'bg-foreground' : 'bg-muted-foreground/40',
                    )}
                />
            ))}
        </div>
    );

    const renderList = () => (
        <div
            className={cn(
                'message-nav-list absolute top-1/2 right-0 max-h-[35vh] w-64 -translate-y-1/2 p-1.5',
                'scrollbar-controller scrollbar-vertical rounded-xl border border-border bg-popover shadow-lg',
                'pointer-events-none opacity-0 transition-opacity duration-150',
                'group-hover:pointer-events-auto group-hover:opacity-100',
            )}
        >
            {items.map((item) => (
                <button
                    key={item.id}
                    type="button"
                    onClick={() => scrollToMessage(item.id)}
                    className={cn(
                        'flex w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent',
                        item.id === activeId && 'bg-accent/60',
                    )}
                >
                    <span className="min-w-0 flex-1 truncate text-foreground">
                        {item.text ? <DirectiveLabel text={item.text} suggestions={suggestions} /> : 'Message'}
                    </span>
                </button>
            ))}
        </div>
    );

    return (
        <div className="message-nav-rail pointer-events-none absolute top-1/2 right-4 z-20 -translate-y-1/2 max-lg:hidden">
            <div className="group pointer-events-auto relative flex justify-end">
                {renderTicks()}
                {renderList()}
            </div>
        </div>
    );
};

export default MessageNavRail;
