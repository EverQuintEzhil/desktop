const getElementTopAndBottom = (appEl: HTMLElement | null) => {
    let top = -1;
    let bottom = -1;
    let scrollHeight = -1;

    if (appEl) {
        if (appEl.scrollTop) {
            top = appEl.scrollTop;
        } else if (document.documentElement) {
            top = document.documentElement.scrollTop;
        } else if (document.scrollingElement) {
            top = (document.scrollingElement as HTMLElement).scrollTop;
        }

        if (appEl.scrollTop) {
            bottom = appEl.scrollTop + window.innerHeight;
        } else if (document.documentElement) {
            bottom = document.documentElement.scrollTop + window.innerHeight;
        } else if (document.scrollingElement) {
            bottom = (document.scrollingElement as HTMLElement).scrollTop + window.innerHeight;
        }
        if (appEl.scrollHeight) {
            scrollHeight = appEl.scrollHeight;
        } else if (document.documentElement) {
            scrollHeight = document.documentElement.scrollHeight;
        } else if (document.scrollingElement) {
            scrollHeight = (document.scrollingElement as HTMLElement).scrollHeight;
        }
    }

    return { top, bottom, scrollHeight };
};

export default getElementTopAndBottom;
