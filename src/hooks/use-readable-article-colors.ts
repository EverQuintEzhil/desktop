import { useEffect, type RefObject } from 'react';

import { readableAgainst } from '@/lib/color-contrast';

import { useIsDarkMode } from './use-is-dark-mode';

/** Where the authored colour is parked so a flip back to light can restore it verbatim. */
const AUTHORED_COLOR_ATTRIBUTE = 'data-authored-color';

/** WCAG 1.4.3: 3:1 for large text, 4.5:1 for the rest. */
const LARGE_TEXT_TAGS = new Set(['H1', 'H2', 'H3']);

const backdropOf = (element: HTMLElement): string => {
    for (let node: HTMLElement | null = element; node; node = node.parentElement) {
        const background = window.getComputedStyle(node).backgroundColor;

        if (background && background !== 'transparent' && !background.startsWith('rgba(0, 0, 0, 0)')) {
            return background;
        }
    }

    return window.getComputedStyle(document.body).backgroundColor;
};

/**
 * Re-tones article colours that a writer's own palette left unreadable on the current
 * theme's surface — a Word heading pasted in as a dark teal is invisible on the dark card,
 * and the colour lives in the content's inline style, which outranks every token.
 *
 * Runs against the rendered container rather than the sanitizer because the answer depends
 * on the resolved surface, which only the browser knows.
 */
export const useReadableArticleColors = (
    containerRef: RefObject<HTMLElement | null>,
    // Re-runs when the article's markup is replaced, which drops every attribute below.
    contentKey?: string,
): void => {
    const isDarkMode = useIsDarkMode();

    useEffect(() => {
        const container = containerRef.current;

        if (!container) return;

        const coloured = container.querySelectorAll<HTMLElement>(`[style*="color"], [${AUTHORED_COLOR_ATTRIBUTE}]`);

        for (const element of coloured) {
            const authored = element.getAttribute(AUTHORED_COLOR_ATTRIBUTE);

            // Restore before measuring: the previous pass's replacement would otherwise be
            // treated as the author's colour and re-toned against the new surface.
            if (authored !== null) {
                element.style.color = authored;
                element.removeAttribute(AUTHORED_COLOR_ATTRIBUTE);
            }

            const inline = element.style.color;

            if (inline === '') continue;

            const target = LARGE_TEXT_TAGS.has(element.tagName) ? 3 : 4.5;
            const resolved = window.getComputedStyle(element).color;
            const readable = readableAgainst(resolved, backdropOf(element), target);

            if (!readable) continue;

            element.setAttribute(AUTHORED_COLOR_ATTRIBUTE, inline);
            element.style.color = readable;
        }
    }, [containerRef, contentKey, isDarkMode]);
};
