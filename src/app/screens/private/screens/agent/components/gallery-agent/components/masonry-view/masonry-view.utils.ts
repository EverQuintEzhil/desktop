import getScrollParent from '@/utils/get-scroll-parent';

interface LayoutWidthParams {
    observedWidth: number;
    viewportWidth: number;
    documentClientWidth: number;
    scrollbarWidth: number;
    scrollsOnDocument: boolean;
}

/**
 * Layout width for the masonry grid, normalized to the "vertical scrollbar
 * present" case whenever the grid scrolls on the document.
 *
 * The grid's height is derived from its own measured width and written back onto
 * the element that is being measured. On the gallery page the scroll container is
 * `html`, which reserves no gutter, so with classic (space-consuming) scrollbars a
 * viewport sitting on the overflow threshold oscillates forever: the scrollbar
 * appears, the container narrows, the computed height shrinks, the content fits,
 * the scrollbar goes away. Laying out as though the scrollbar were always there
 * makes the layout width independent of scrollbar state, so the loop has a single
 * fixed point.
 *
 * The same grid also renders inside the admin agent-gallery playground, where the
 * document never scrolls and the scroll container is a `.scrollbar-controller`
 * element. `viewportWidth - documentClientWidth` is 0 there for reasons unrelated
 * to this grid, and subtracting a gutter the document scrollbar never took makes
 * the admin grid permanently narrower — enough to drop a column across a
 * `getColumns` boundary. Those containers also set `scrollbar-gutter: stable` when
 * overflowing, so their width does not change with scrollbar state and needs no
 * normalization: `scrollsOnDocument` gates the whole adjustment.
 *
 * Both branches must resolve to the *same integer*, otherwise a 1px version of the
 * same oscillation survives. That is why `scrollbarWidth` is measured fractionally
 * (see `getScrollbarWidth`), the subtraction happens in fractional space, and
 * `Math.floor` is applied exactly once, at the end.
 */
export const getLayoutWidth = (params: LayoutWidthParams): number => {
    const { observedWidth, viewportWidth, documentClientWidth, scrollbarWidth, scrollsOnDocument } = params;

    // Half the measured gutter, not `> 0`: `innerWidth` and
    // `documentElement.clientWidth` are independently rounded from the same
    // fractional viewport, so at fractional zoom or DPR a persistent 1px delta
    // exists with no scrollbar. Treating that as "present" would disable
    // normalization in both states and restore the full oscillation.
    const documentScrollbarVisible = scrollbarWidth > 0 && viewportWidth - documentClientWidth >= scrollbarWidth / 2;
    const shouldReserveGutter = scrollsOnDocument && !documentScrollbarVisible;
    const normalized = shouldReserveGutter ? observedWidth - scrollbarWidth : observedWidth;

    return Math.max(Math.floor(normalized), 0);
};

let measuredScrollbarWidth: number | null = null;

/**
 * Width the platform's classic scrollbar takes from a scrolling element's content
 * box, or 0 where scrollbars are overlay (macOS trackpad, mobile) and under jsdom.
 * Measured once via an offscreen probe; the value cannot change without an OS
 * preference change and a reload.
 *
 * The value is **fractional** — read from `getBoundingClientRect()` rather than the
 * integer-rounded `offsetWidth`/`clientWidth` — because `getLayoutWidth` needs both
 * of its branches to floor to the same integer; see its docblock.
 */
export const getScrollbarWidth = (): number => {
    if (measuredScrollbarWidth !== null) return measuredScrollbarWidth;

    // `appendChild` on a null body throws, and `document.body` is null while the
    // document head is still parsing.
    if (typeof document === 'undefined' || !document.body) return 0;

    const probe = document.createElement('div');

    probe.style.position = 'absolute';
    probe.style.top = '-9999px';
    probe.style.width = '100px';
    probe.style.height = '100px';
    probe.style.overflow = 'scroll';

    const inner = document.createElement('div');

    inner.style.width = '100%';
    probe.appendChild(inner);

    document.body.appendChild(probe);

    const probeWidth = probe.getBoundingClientRect().width;
    const innerWidth = inner.getBoundingClientRect().width;
    const laidOut = probeWidth > 0;
    const width = laidOut ? Math.max(probeWidth - innerWidth, 0) : 0;

    probe.remove();

    // A probe width of 0 means the environment does not lay the probe out at all
    // (jsdom, where every rect is 0); the difference would be meaningless. Not
    // memoised, so a real measurement is still possible once layout is available.
    if (!laidOut) return 0;

    measuredScrollbarWidth = width;

    return width;
};

interface LayoutMeasurementDeps {
    viewportWidth: number;
    documentClientWidth: number;
    scrollbarWidth: number;
    scrollParent: HTMLElement | Window;
}

const isDocumentScroller = (scrollParent: HTMLElement | Window): boolean =>
    scrollParent === window ||
    scrollParent === document.scrollingElement ||
    scrollParent === document.documentElement ||
    scrollParent === document.body;

/**
 * Reads the grid's own width and the document/scroll-container state, and resolves
 * them through `getLayoutWidth`. The DOM globals are injectable so the wiring —
 * which argument carries which measurement — is testable; `getScrollbarWidth()`
 * returns 0 under jsdom, so without the seam normalization is a no-op in every
 * component test.
 */
export const measureLayoutWidth = (node: HTMLElement, deps?: Partial<LayoutMeasurementDeps>): number => {
    // getBoundingClientRect keeps the fractional width getLayoutWidth needs;
    // offsetWidth is the jsdom fallback, where rects are always 0 and the gallery
    // suites stub offsetWidth instead.
    const observedWidth = node.getBoundingClientRect().width || node.offsetWidth || 0;
    const scrollParent = deps?.scrollParent ?? getScrollParent(node);

    return getLayoutWidth({
        observedWidth,
        viewportWidth: deps?.viewportWidth ?? window.innerWidth,
        documentClientWidth: deps?.documentClientWidth ?? document.documentElement.clientWidth,
        scrollbarWidth: deps?.scrollbarWidth ?? getScrollbarWidth(),
        scrollsOnDocument: isDocumentScroller(scrollParent),
    });
};
