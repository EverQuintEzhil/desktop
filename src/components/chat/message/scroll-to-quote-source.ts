const HIGHLIGHT_CLASS = 'quote-source-highlight';
const HIGHLIGHT_DURATION_MS = 1600;

const norm = (value: string): string => value.replace(/\s+/g, ' ').trim().toLowerCase();

export const scrollToQuoteSource = (quoteText: string): boolean => {
    if (!quoteText || !norm(quoteText)) return false;

    const target = norm(quoteText);
    const candidates = Array.from(document.querySelectorAll<HTMLElement>('[data-selectable-message]'));
    const match = candidates.find((element) => norm(element.textContent ?? '').includes(target));

    if (!match) return false;

    match.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Highlight only the first content tag inside the block, not the whole block.
    const highlightTarget = match.querySelector<HTMLElement>('p, li, h1, h2, h3, h4, h5, h6, pre, blockquote') ?? match;

    highlightTarget.classList.add(HIGHLIGHT_CLASS);

    window.setTimeout(() => {
        highlightTarget.classList.remove(HIGHLIGHT_CLASS);
    }, HIGHLIGHT_DURATION_MS);

    return true;
};
