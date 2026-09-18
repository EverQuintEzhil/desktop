const updateClass = (el: HTMLElement) => {
    const overflowsY = el.scrollHeight > el.clientHeight;
    const overflowsX = el.scrollWidth > el.clientWidth;

    el.classList.toggle('is-overflowing', overflowsY || overflowsX);
};

const attach = (controller: HTMLElement, ro: ResizeObserver) => {
    ro.observe(controller);
    Array.from(controller.children).forEach((child) => ro.observe(child as HTMLElement));
    updateClass(controller);
};

const observeScrollbarOverflow = () => {
    const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
            const el = entry.target as HTMLElement;

            if (el.classList.contains('scrollbar-controller')) {
                updateClass(el);
            } else if (el.parentElement?.classList.contains('scrollbar-controller')) {
                updateClass(el.parentElement);
            }
        }
    });

    const mo = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            mutation.addedNodes.forEach((node) => {
                if (!(node instanceof HTMLElement)) return;
                if (node.classList.contains('scrollbar-controller')) attach(node, ro);
                node.querySelectorAll<HTMLElement>('.scrollbar-controller').forEach((el) => attach(el, ro));

                const parentController = node.closest<HTMLElement>('.scrollbar-controller');

                if (parentController) {
                    ro.observe(node);
                    updateClass(parentController);
                }
            });
        }
    });

    document.querySelectorAll<HTMLElement>('.scrollbar-controller').forEach((el) => attach(el, ro));
    mo.observe(document.body, { childList: true, subtree: true });
};

export default observeScrollbarOverflow;
