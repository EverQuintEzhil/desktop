import type { KeyboardEvent, MouseEvent } from 'react';
import { useState } from 'react';

import { safeJsonParse, safeLocalStorageGetItem, safeLocalStorageSetItem } from '@/utils';

interface PersistedExpansion {
    isExpanded: boolean;
    onToggleClick: (e: MouseEvent<HTMLDivElement>) => void;
    onToggleKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
}

export const usePersistedExpansion = (storageKey: string): PersistedExpansion => {
    const [isExpanded, setIsExpanded] = useState(() => safeJsonParse(safeLocalStorageGetItem(storageKey), false));

    const toggle = () => {
        setIsExpanded((prev: boolean) => {
            const newValue = !prev;

            safeLocalStorageSetItem(storageKey, JSON.stringify(newValue));

            return newValue;
        });
    };

    const onToggleClick = (e: MouseEvent<HTMLDivElement>) => {
        // The toggle sits inside the row link, so let it collapse the list without navigating.
        e.preventDefault();
        e.stopPropagation();
        toggle();
    };

    const onToggleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key !== 'Enter' && e.key !== ' ') {
            return;
        }

        e.preventDefault();
        e.stopPropagation();
        toggle();
    };

    return { isExpanded, onToggleClick, onToggleKeyDown };
};
