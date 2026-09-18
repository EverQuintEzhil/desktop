import type { KeyboardEvent } from 'react';

export const INDICATOR_BOX_CLASS =
    'flex size-6 shrink-0 items-center justify-center rounded-md bg-card transition-colors hover:bg-accent/80';
export const STATIC_ROW_CLASS = 'min-h-9 justify-between gap-2 focus:bg-transparent! focus:text-inherit!';

// Rows only toggle from the keyboard; preventDefault keeps Radix from re-firing
// Enter/Space as a row click (which would close the menu or double-toggle).
export const toggleRowKeyDown = (onActivate: () => void) => (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
        return;
    }

    event.preventDefault();
    onActivate();
};
