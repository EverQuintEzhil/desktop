import { useCallback, useEffect, useRef, useState } from 'react';

import { hasPrimaryModifier, matchBinding } from '@/hooks/keyboard-shortcuts/binding';
import type { ResolvedShortcut, ShortcutId } from '@/hooks/keyboard-shortcuts/types';
import { useKeyboardShortcuts } from '@/hooks/keyboard-shortcuts/use-keyboard-shortcuts';

interface UseChatShortcutsParams {
    onNewChat: () => void;
    onIncognitoChat?: () => void;
    onOpenSettings?: () => void;
    onUploadFile?: () => void;
    onSelectModel?: () => void;
    onEditAgent?: () => void;
}

interface UseChatShortcutsReturn {
    isShortcutsOpen: boolean;
    isPaletteOpen: boolean;
    setShortcutsOpen: (open: boolean) => void;
    setPaletteOpen: (open: boolean) => void;
}

// Shortcuts dispatched from the global window listener. Composer-local shortcuts
// (send, recall) are handled inside their own components via the enabled flag.
const GLOBAL_IDS = new Set<ShortcutId>([
    'search',
    'show-shortcuts',
    'new-chat',
    'incognito',
    'settings',
    'upload',
    'select-model',
    'edit-agent',
]);

const useChatShortcuts = (params: UseChatShortcutsParams): UseChatShortcutsReturn => {
    const { onNewChat, onIncognitoChat, onOpenSettings, onUploadFile, onSelectModel, onEditAgent } = params;

    const { shortcuts } = useKeyboardShortcuts();

    const [isShortcutsOpen, setShortcutsOpenState] = useState(false);
    const [isPaletteOpen, setPaletteOpenState] = useState(false);

    const stateRef = useRef({ isShortcutsOpen, isPaletteOpen });

    stateRef.current = { isShortcutsOpen, isPaletteOpen };

    const shortcutsRef = useRef<ResolvedShortcut[]>(shortcuts);

    shortcutsRef.current = shortcuts;

    const callbacksRef = useRef({
        onNewChat,
        onIncognitoChat,
        onOpenSettings,
        onUploadFile,
        onSelectModel,
        onEditAgent,
    });

    callbacksRef.current = {
        onNewChat,
        onIncognitoChat,
        onOpenSettings,
        onUploadFile,
        onSelectModel,
        onEditAgent,
    };

    // Keep the two panels mutually exclusive: opening one always closes the
    // other so their Radix overlays can never stack and double-dim the card.
    const showShortcuts = useCallback((open: boolean) => {
        setShortcutsOpenState(open);

        if (open) {
            setPaletteOpenState(false);
        }
    }, []);

    const showPalette = useCallback((open: boolean) => {
        setPaletteOpenState(open);

        if (open) {
            setShortcutsOpenState(false);
        }
    }, []);

    const closePanels = useCallback(() => {
        setShortcutsOpenState(false);
        setPaletteOpenState(false);
    }, []);

    const handlerFor = useCallback(
        (id: ShortcutId): (() => void) | null => {
            const callbacks = callbacksRef.current;

            switch (id) {
                case 'search':
                    return () => showPalette(!stateRef.current.isPaletteOpen);
                case 'show-shortcuts':
                    return () => showShortcuts(!stateRef.current.isShortcutsOpen);
                case 'new-chat':
                    return () => {
                        closePanels();
                        callbacks.onNewChat();
                    };
                case 'incognito':
                    return callbacks.onIncognitoChat
                        ? () => {
                              closePanels();
                              callbacks.onIncognitoChat?.();
                          }
                        : null;
                case 'settings':
                    return callbacks.onOpenSettings
                        ? () => {
                              closePanels();
                              callbacks.onOpenSettings?.();
                          }
                        : null;
                case 'upload':
                    return callbacks.onUploadFile
                        ? () => {
                              closePanels();
                              callbacks.onUploadFile?.();
                          }
                        : null;
                case 'edit-agent':
                    return callbacks.onEditAgent
                        ? () => {
                              closePanels();
                              callbacks.onEditAgent?.();
                          }
                        : null;
                case 'select-model':
                    return callbacks.onSelectModel
                        ? () => {
                              closePanels();
                              callbacks.onSelectModel?.();
                          }
                        : null;
                default:
                    return null;
            }
        },
        [closePanels, showPalette, showShortcuts],
    );

    const handleKeyDown = useCallback(
        (event: KeyboardEvent) => {
            if (event.defaultPrevented) return;

            const match = shortcutsRef.current.find(
                (shortcut) => GLOBAL_IDS.has(shortcut.id) && shortcut.enabled && matchBinding(event, shortcut.binding),
            );

            if (!match) return;

            // Never let a modifier-less binding hijack typing in an editable field.
            const target = event.target as HTMLElement | null;
            const isEditable =
                Boolean(target?.isContentEditable) || target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';

            if (isEditable && !hasPrimaryModifier(match.binding)) return;

            const handler = handlerFor(match.id);

            if (!handler) return;

            event.preventDefault();
            handler();
        },
        [handlerFor],
    );

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown]);

    return {
        isShortcutsOpen,
        isPaletteOpen,
        setShortcutsOpen: showShortcuts,
        setPaletteOpen: showPalette,
    };
};

export default useChatShortcuts;
