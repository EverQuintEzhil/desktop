import { ChevronDownIcon, ChevronUpIcon, SearchIcon, XIcon } from 'lucide-react';
import { useEffect, useRef, type KeyboardEvent } from 'react';

import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { cn } from '@/lib/utils';

import { isOverlayOnTop } from './overlay-on-top';
import type { UseFindInConversationReturn } from './use-find-in-conversation';

interface ChatFindBarProps {
    find: UseFindInConversationReturn;
    onClose: () => void;
    /** Bumped every time the find shortcut fires, to re-focus an already-open bar. */
    focusRequest?: number;
    /** True while older pages of the conversation are still unloaded. */
    hasMoreOlderMessages?: boolean;
    isLoadingOlderMessages?: boolean;
    onLoadOlderMessages?: () => void;
}

const ChatFindBar = ({
    find,
    onClose,
    focusRequest = 0,
    hasMoreOlderMessages = false,
    isLoadingOlderMessages = false,
    onLoadOlderMessages,
}: ChatFindBarProps) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const { query, setQuery, matchCount, activePosition, goToNext, goToPrevious } = find;

    useEffect(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
    }, [focusRequest]);

    // Escape closes from anywhere, not just from the input: after clicking into
    // the thread to read a match, the keyboard is no longer in the bar.
    const onCloseRef = useRef(onClose);

    onCloseRef.current = onClose;

    useEffect(() => {
        const handleEscape = (event: globalThis.KeyboardEvent) => {
            if (event.key !== 'Escape' || event.defaultPrevented) return;

            // A menu or dialog on top owns Escape first; closing find as well would
            // throw away the query the user is still working with.
            if (isOverlayOnTop()) return;

            event.preventDefault();
            onCloseRef.current();
        };

        window.addEventListener('keydown', handleEscape);

        return () => window.removeEventListener('keydown', handleEscape);
    }, []);

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();

            if (event.shiftKey) {
                goToPrevious();
            } else {
                goToNext();
            }
        }
    };

    // Mounted even while empty: a live region inserted together with its first
    // text is not announced, so the first result would be silent.
    const renderCount = () => {
        const hasQuery = Boolean(query.trim());
        const countLabel = () => {
            if (!hasQuery) return '';
            if (matchCount === 0) return 'No results';

            return `${activePosition} of ${matchCount}`;
        };

        return (
            <span
                aria-live="polite"
                className={cn(
                    'chat-find-bar-count shrink-0 text-xs tabular-nums',
                    hasQuery && matchCount === 0 ? 'text-destructive' : 'text-muted-foreground',
                )}
            >
                {countLabel()}
            </span>
        );
    };

    // Find only sees the pages already in the thread, so say so rather than
    // reporting a count the user would read as the whole conversation.
    const renderOlderNotice = () => {
        if (!hasMoreOlderMessages || !query.trim()) return null;

        return (
            <div className="chat-find-bar-notice absolute top-full right-0 z-30 mt-2 flex items-center gap-2 rounded-lg border border-border bg-popover px-3 py-1.5 text-xs text-muted-foreground shadow-md">
                <span>Earlier messages are not loaded yet.</span>
                {onLoadOlderMessages && (
                    <Button
                        variant="link"
                        size="xs"
                        className="h-auto px-0 font-semibold"
                        disabled={isLoadingOlderMessages}
                        onClick={onLoadOlderMessages}
                    >
                        {isLoadingOlderMessages ? 'Loading…' : 'Load earlier'}
                    </Button>
                )}
            </div>
        );
    };

    return (
        <div
            role="search"
            aria-label="Find in conversation"
            data-find-skip=""
            // The header overlays this bar on the hidden actions row, so the extra
            // height over those 24px buttons spills into the header's own padding.
            className={cn(
                'chat-find-bar relative flex h-8 w-full min-w-0 items-center gap-1.5 rounded-full',
                'border border-border-secondary bg-(--white) pr-1 pl-2 dark:bg-input/30',
                'transition-[color,box-shadow] focus-within:border-primary',
            )}
        >
            <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
            <input
                ref={inputRef}
                type="text"
                value={query}
                autoComplete="off"
                spellCheck={false}
                placeholder="Find in conversation"
                aria-label="Find in conversation"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleKeyDown}
                className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            {renderCount()}
            <span aria-hidden="true" className="mx-1 h-4 w-px shrink-0 bg-border-secondary" />
            <SimpleTooltip content="Previous match (⇧Enter)" side="bottom">
                <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Previous match"
                    disabled={matchCount === 0}
                    onClick={goToPrevious}
                    className="shrink-0 rounded-full"
                >
                    <ChevronUpIcon className="size-3.5" />
                </Button>
            </SimpleTooltip>
            <SimpleTooltip content="Next match (Enter)" side="bottom">
                <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Next match"
                    disabled={matchCount === 0}
                    onClick={goToNext}
                    className="shrink-0 rounded-full"
                >
                    <ChevronDownIcon className="size-3.5" />
                </Button>
            </SimpleTooltip>
            <SimpleTooltip content="Close (Esc)" side="bottom">
                <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Close find"
                    onClick={onClose}
                    className="shrink-0 rounded-full"
                >
                    <XIcon className="size-3.5" />
                </Button>
            </SimpleTooltip>
            {renderOlderNotice()}
        </div>
    );
};

export default ChatFindBar;
