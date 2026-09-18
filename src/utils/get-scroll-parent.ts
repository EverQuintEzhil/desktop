const getScrollParent = (
    element: HTMLElement | null,
    returnEl?: HTMLElement | Element | Window | null,
): HTMLElement | Window => {
    if (element) {
        let style = getComputedStyle(element);
        const excludeStaticParent = style.position === 'absolute';
        const overflowRegex = /(auto|scroll|hidden)/;

        if (style.position === 'fixed') {
            return window;
        }

        for (let parent: HTMLElement | null = element.parentElement; parent; parent = parent.parentElement) {
            style = getComputedStyle(parent);
            if (excludeStaticParent && style.position === 'static') {
                continue;
            }
            if (overflowRegex.test(style.overflow + style.overflowY + style.overflowX)) {
                return parent;
            }
        }
    }

    return (returnEl as HTMLElement) || document.body;
};

export default getScrollParent;
