import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

import { scrollInstantly } from '../scroll-instantly';

import { buildFindIndex, matchesInIndex, type DisplayCache, type FindIndex } from './collect-matches';
import { clearFindHighlights, paintFindHighlights } from './find-highlighter';

const MESSAGE_GROUP_SELECTOR = '[data-slot="aui_message-group"]';

/** Breathing room above a stepped-to match. */
const SCROLL_PADDING = 24;

const COLLAPSED_CONTENT_SELECTOR = '.collapsible-message-text-content[data-collapsed]';

/**
 * Streaming fires a characterData mutation per token. Rebuilding the index on a
 * trailing throttle rather than every frame keeps a long reply from re-walking
 * the whole thread 60 times a second.
 */
const REINDEX_THROTTLE_MS = 150;
// A tick costs a forced layout to measure and a node to render, so the rail stops
// here. The count stays exact.
const MAX_TICKS = 200;

/** Why a search ran — decides whether to rebuild, and whether to scroll. */
type SearchReason = 'open' | 'query' | 'mutation';

export interface FindMatchTick {
    key: number;
    /** Position down the scrollable content, 0-1. */
    ratio: number;
}

/**
 * Identifies a match by the message holding it plus its ordinal within that
 * message. Survives a re-index, which a plain array position does not: an older
 * page prepending matches would silently slide the same index onto a different
 * occurrence.
 */
interface MatchAnchor {
    messageId: string;
    ordinal: number;
}

interface UseFindInConversationParams {
    viewportRef: RefObject<HTMLDivElement | null>;
    isOpen: boolean;
    /** Called immediately before find scrolls the viewport itself. */
    onBeforeScroll?: () => void;
    /** Called when a scroll find announced turned out not to move the viewport. */
    onScrollSkipped?: () => void;
}

export interface UseFindInConversationReturn {
    query: string;
    setQuery: (query: string) => void;
    matchCount: number;
    /** 1-based position of the current match, 0 when there is none. */
    activePosition: number;
    ticks: FindMatchTick[];
    goToNext: () => void;
    goToPrevious: () => void;
    reset: () => void;
}

/** `null` when the range cannot be measured — a detached subtree, or jsdom. */
const rangeRect = (range: Range): DOMRect | null => {
    if (typeof range.getBoundingClientRect !== 'function') return null;

    const rect = range.getBoundingClientRect();

    // A range inside a collapsed or hidden subtree measures as all zeros.
    return rect.height === 0 && rect.width === 0 ? null : rect;
};

/** Expands the collapsed message holding `range`, if there is one. */
const revealCollapsedAncestor = (range: Range): void => {
    const node = range.startContainer;
    const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
    const collapsed = element?.closest(COLLAPSED_CONTENT_SELECTOR);
    const toggle = collapsed?.parentElement?.querySelector<HTMLButtonElement>(':scope > button');

    toggle?.click();
};

const messageIdOf = (range: Range): string | null => {
    const node = range.startContainer;
    const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;

    return element?.closest('[data-message-id]')?.getAttribute('data-message-id') ?? null;
};

const anchorAt = (matches: Range[], index: number): MatchAnchor | null => {
    const range = matches[index];

    if (!range) return null;

    const messageId = messageIdOf(range);

    if (!messageId) return null;

    let ordinal = 0;

    for (let i = 0; i < index; i += 1) {
        if (messageIdOf(matches[i]) === messageId) ordinal += 1;
    }

    return { messageId, ordinal };
};

const indexOfAnchor = (matches: Range[], anchor: MatchAnchor | null): number => {
    if (!anchor) return -1;

    let ordinal = 0;

    for (let i = 0; i < matches.length; i += 1) {
        if (messageIdOf(matches[i]) !== anchor.messageId) continue;
        if (ordinal === anchor.ordinal) return i;

        ordinal += 1;
    }

    return -1;
};

const useFindInConversation = ({
    viewportRef,
    isOpen,
    onBeforeScroll,
    onScrollSkipped,
}: UseFindInConversationParams): UseFindInConversationReturn => {
    const [query, setQuery] = useState('');
    const [matches, setMatches] = useState<Range[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    // Bumped only by a deliberate navigation, so a rebuild mid-stream can never
    // yank the viewport out from under someone reading.
    const [scrollRequest, setScrollRequest] = useState(0);

    const indexRef = useRef<FindIndex | null>(null);
    const displayCacheRef = useRef<DisplayCache>(new WeakMap());
    const matchesRef = useRef(matches);
    const activeIndexRef = useRef(activeIndex);
    const activeAnchorRef = useRef<MatchAnchor | null>(null);
    const onBeforeScrollRef = useRef(onBeforeScroll);
    const onScrollSkippedRef = useRef(onScrollSkipped);

    matchesRef.current = matches;
    activeIndexRef.current = activeIndex;
    onBeforeScrollRef.current = onBeforeScroll;
    onScrollSkippedRef.current = onScrollSkipped;

    const rootOf = useCallback(
        () => viewportRef.current?.querySelector<HTMLElement>(MESSAGE_GROUP_SELECTOR) ?? null,
        [viewportRef],
    );

    const search = useCallback(
        (reason: SearchReason) => {
            const root = rootOf();

            if (!root) {
                // The thread unmounted its messages; keep no count over nothing.
                indexRef.current = null;
                setMatches([]);
                setActiveIndex(0);

                return;
            }

            if (reason !== 'query' || !indexRef.current) {
                const rebuilt = buildFindIndex(root, displayCacheRef.current);
                // Equal text is not enough to keep the existing ranges: a subtree
                // can remount with identical copy, which leaves every stored Range
                // pointing at a detached node. Only skip when nothing moved.
                const isUnchanged =
                    reason === 'mutation' &&
                    indexRef.current?.text === rebuilt.text &&
                    matchesRef.current.every(
                        (range) => range.startContainer.nodeType === Node.TEXT_NODE && range.startContainer.isConnected,
                    );

                indexRef.current = rebuilt;

                if (isUnchanged) return;
            }

            const next = matchesInIndex(indexRef.current, query);

            setMatches(next);

            if (reason === 'mutation') {
                setActiveIndex(() => {
                    if (next.length === 0) return 0;

                    const restored = indexOfAnchor(next, activeAnchorRef.current);

                    if (restored >= 0) return restored;

                    return Math.min(activeIndexRef.current, next.length - 1);
                });

                return;
            }

            setActiveIndex(0);
            setScrollRequest((current) => current + 1);
        },
        [query, rootOf],
    );

    const searchRef = useRef(search);

    searchRef.current = search;

    // `search` changes identity with the query, so this covers both the initial
    // open and every keystroke; only the first pass rebuilds the DOM snapshot.
    const wasOpenRef = useRef(false);

    useEffect(() => {
        if (!isOpen) {
            wasOpenRef.current = false;

            return;
        }

        const justOpened = !wasOpenRef.current;

        wasOpenRef.current = true;
        search(justOpened ? 'open' : 'query');
    }, [isOpen, search]);

    // The thread mutates constantly (streaming tokens, prepended older pages), and
    // every stored Range points at nodes that may no longer exist. Rebuild both the
    // snapshot and the matches whenever the message group changes.
    useEffect(() => {
        const root = rootOf();

        if (!isOpen || !root) return undefined;

        let timer: ReturnType<typeof setTimeout> | null = null;
        const observer = new MutationObserver(() => {
            if (timer) return;

            timer = setTimeout(() => {
                timer = null;
                searchRef.current('mutation');
            }, REINDEX_THROTTLE_MS);
        });

        observer.observe(root, { childList: true, subtree: true, characterData: true });

        return () => {
            if (timer) clearTimeout(timer);

            observer.disconnect();
        };
        // Deliberately not keyed on `search`: re-subscribing on every keystroke
        // would drop a rebuild already scheduled for the latest streamed tokens.
    }, [isOpen, rootOf]);

    // Recorded while the ranges are still live, so a rebuild triggered by a
    // mutation that already detached them can still find its way back.
    useEffect(() => {
        if (!isOpen) return;

        activeAnchorRef.current = anchorAt(matches, activeIndex);
    }, [isOpen, matches, activeIndex]);

    // Painting is a side effect of (matches, activeIndex) and never mutates the DOM,
    // so it cannot feed back into the observer above.
    useEffect(() => {
        if (!isOpen) return undefined;

        paintFindHighlights(matches, matches[activeIndex] ?? null);

        return () => clearFindHighlights();
    }, [isOpen, matches, activeIndex]);

    useEffect(() => {
        const viewport = viewportRef.current;
        const active = matchesRef.current[activeIndexRef.current];

        if (!isOpen || scrollRequest === 0 || !viewport || !active) return undefined;

        // A long user message is clipped to a fixed height, which would hide the
        // match. Drive the collapsible's own toggle rather than overriding its
        // height, so its button label stays truthful.
        revealCollapsedAncestor(active);

        let frame = 0;

        // The thread grows as markdown, tables and images finish rendering, so a
        // target computed now can be clamped short of the match. Re-check once and
        // correct, rather than leaving the match off-screen.
        const scrollIntoView = (attemptsLeft: number) => {
            const rect = rangeRect(active);

            if (!rect) return;

            const viewportRect = viewport.getBoundingClientRect();
            const isAbove = rect.top < viewportRect.top + SCROLL_PADDING;
            const isBelow = rect.bottom > viewportRect.bottom;

            if (!isAbove && !isBelow) return;

            // The assignment dispatches its scroll event synchronously, and the thread
            // reads a jump to the top as the user asking for an older page.
            scrollInstantly(viewport, viewport.scrollTop + rect.top - viewportRect.top - viewport.clientHeight / 3, {
                onBeforeScroll: () => onBeforeScrollRef.current?.(),
                onScrollSkipped: () => onScrollSkippedRef.current?.(),
            });

            if (attemptsLeft > 0) frame = requestAnimationFrame(() => scrollIntoView(attemptsLeft - 1));
        };

        // Measuring waits a frame in case the reveal above changed the layout.
        frame = requestAnimationFrame(() => scrollIntoView(1));

        return () => cancelAnimationFrame(frame);
    }, [isOpen, scrollRequest, viewportRef]);

    // Measured in an effect rather than a render-time memo: reading a rect per
    // match during render forces a synchronous layout on every keystroke.
    const [ticks, setTicks] = useState<FindMatchTick[]>([]);

    useEffect(() => {
        const viewport = viewportRef.current;

        if (!isOpen || !viewport) return undefined;

        const measure = () => {
            if (matches.length === 0) {
                setTicks([]);

                return;
            }

            const viewportRect = viewport.getBoundingClientRect();
            const scrollHeight = viewport.scrollHeight || 1;

            setTicks(
                matches.slice(0, MAX_TICKS).flatMap((range, key) => {
                    const rect = rangeRect(range);

                    if (!rect) return [];

                    const top = rect.top - viewportRect.top + viewport.scrollTop;

                    return [{ key, ratio: Math.min(1, Math.max(0, top / scrollHeight)) }];
                }),
            );
        };

        measure();

        const observer = new ResizeObserver(measure);

        observer.observe(viewport);

        return () => observer.disconnect();
    }, [isOpen, matches, viewportRef]);

    const goTo = useCallback((next: number) => {
        setActiveIndex(next);
        setScrollRequest((current) => current + 1);
    }, []);

    const step = useCallback(
        (direction: 1 | -1) => {
            if (matches.length === 0) return;

            goTo((activeIndexRef.current + direction + matches.length) % matches.length);
        },
        [matches.length, goTo],
    );

    const goToNext = useCallback(() => step(1), [step]);
    const goToPrevious = useCallback(() => step(-1), [step]);

    const reset = useCallback(() => {
        setQuery('');
        setMatches([]);
        setActiveIndex(0);
        setScrollRequest(0);
        setTicks([]);
        indexRef.current = null;
        displayCacheRef.current = new WeakMap();
        activeAnchorRef.current = null;
        clearFindHighlights();
    }, []);

    return {
        query,
        setQuery,
        matchCount: matches.length,
        activePosition: matches.length === 0 ? 0 : activeIndex + 1,
        ticks,
        goToNext,
        goToPrevious,
        reset,
    };
};

export default useFindInConversation;
