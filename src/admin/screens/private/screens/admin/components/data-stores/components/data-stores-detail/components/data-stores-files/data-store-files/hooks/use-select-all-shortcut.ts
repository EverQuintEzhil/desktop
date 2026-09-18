import { useEffect } from 'react';

interface UseSelectAllShortcutParams {
    enabled: boolean;
    onSelectAll: () => void;
}

export const useSelectAllShortcut = ({ enabled, onSelectAll }: UseSelectAllShortcutParams): void => {
    useEffect(() => {
        if (!enabled) return undefined;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.code !== 'KeyA' || event.shiftKey || event.altKey) return;
            if (!(event.metaKey || event.ctrlKey)) return;

            const target = event.target as HTMLElement | null;

            if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) return;

            event.preventDefault();
            onSelectAll();
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [enabled, onSelectAll]);
};
