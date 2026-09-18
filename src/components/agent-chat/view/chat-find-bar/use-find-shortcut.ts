import { useEffect, useRef } from 'react';

import { matchBinding } from '@/hooks/keyboard-shortcuts/binding';
import type { KeyBinding } from '@/hooks/keyboard-shortcuts/types';
import { useKeyboardShortcuts } from '@/hooks/keyboard-shortcuts/use-keyboard-shortcuts';

import { isOverlayOnTop } from './overlay-on-top';

interface UseFindShortcutParams {
    isEnabled: boolean;
    onOpen: () => void;
}

/**
 * Handled here rather than in the app-level `useChatShortcuts` because the bar
 * lives inside the thread that owns the viewport, matching how the other
 * surface-local shortcuts (send, recall) are wired. Registering `find-in-chat`
 * in the shortcut registry still lists it in the shortcuts dialog, and turning
 * it off there is what hands ⌘F back to the browser.
 */
const useFindShortcut = ({ isEnabled, onOpen }: UseFindShortcutParams): void => {
    const { shortcuts } = useKeyboardShortcuts();
    const shortcut = shortcuts.find((entry) => entry.id === 'find-in-chat');

    const onOpenRef = useRef(onOpen);

    onOpenRef.current = onOpen;

    const isActive = isEnabled && Boolean(shortcut?.enabled) && Boolean(shortcut?.binding);

    // `useKeyboardShortcuts` hands back a fresh binding object on every render, so
    // the listener is keyed on its value — depending on the object would resubscribe
    // on each render.
    const bindingKey = shortcut?.binding ? JSON.stringify(shortcut.binding) : null;

    useEffect(() => {
        if (!isActive || !bindingKey) return undefined;

        const binding = JSON.parse(bindingKey) as KeyBinding;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented) return;
            if (!matchBinding(event, binding)) return;

            // A dialog or menu on top owns the keyboard, and the bar would open
            // behind it with the focus trap keeping the caret out. Let the browser
            // have the key instead — the same test closing already uses.
            if (isOverlayOnTop()) return;

            // Claims ⌘F from the browser: native find only sees the pages the
            // thread has rendered, so it reports the wrong answer here.
            event.preventDefault();
            onOpenRef.current();
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isActive, bindingKey]);
};

export default useFindShortcut;
