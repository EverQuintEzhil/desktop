interface ScrollHooks {
    /** Runs immediately before a write that is going to move the viewport. */
    onBeforeScroll?: () => void;
    /** Runs when that write turned out not to move it, so the hook above can be undone. */
    onScrollSkipped?: () => void;
}

/**
 * The thread viewport sets CSS `scroll-behavior: smooth`, which applies to
 * `scrollTop` assignments and to `scrollTo({ behavior: 'auto' })` alike — the
 * CSS property wins unless a scroll explicitly opts out. An animated scroll
 * emits a stream of scroll events, and the thread reads a scroll that lands on
 * zero as the user reaching the top and fetches an older page. Every
 * programmatic move therefore has to opt out, so it produces one event.
 *
 * Returns whether the position actually changed. The assignment dispatches its
 * scroll event synchronously, so a caller that arms a skip-the-next-event flag
 * has to arm it before the write — hence `onBeforeScroll`, and
 * `onScrollSkipped` for the case where the write is clamped to where the
 * viewport already was and no event arrives to consume the flag.
 */
export const scrollInstantly = (viewport: HTMLElement, top: number, hooks?: ScrollHooks): boolean => {
    const target = Math.max(0, top);
    const before = viewport.scrollTop;

    if (target === before) return false;

    hooks?.onBeforeScroll?.();

    const previousBehavior = viewport.style.scrollBehavior;

    viewport.style.scrollBehavior = 'auto';
    viewport.scrollTop = target;
    viewport.style.scrollBehavior = previousBehavior;

    const moved = viewport.scrollTop !== before;

    if (!moved) hooks?.onScrollSkipped?.();

    return moved;
};
