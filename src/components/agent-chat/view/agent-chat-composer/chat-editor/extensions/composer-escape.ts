import { Extension } from '@tiptap/core';

export const COMPOSER_ESCAPE_PRIORITY = 1;

export interface ComposerEscapeOptions {
    onEscape: () => boolean;
}

export const ComposerEscape = Extension.create<ComposerEscapeOptions>({
    name: 'composerEscape',

    priority: COMPOSER_ESCAPE_PRIORITY,

    addOptions() {
        return { onEscape: () => false };
    },

    addKeyboardShortcuts() {
        return { Escape: () => this.options.onEscape() };
    },
});
