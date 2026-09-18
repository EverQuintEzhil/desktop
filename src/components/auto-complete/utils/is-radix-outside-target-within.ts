/** Radix outside-dismiss events expose the real target on `detail.originalEvent` (content is portaled). */
export const isRadixOutsideTargetWithin = (event: Event, container: HTMLElement | null) => {
    if (!container) return false;

    const detail =
        'detail' in event
            ? (event as CustomEvent<{ originalEvent?: { target?: EventTarget | null } }>).detail
            : undefined;
    const t = detail?.originalEvent?.target;

    return t instanceof Node && container.contains(t);
};
