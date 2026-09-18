import { Extension } from '@tiptap/core';

export const SUBMIT_KEYMAP_PRIORITY = 1000;

export interface SubmitKeymapOptions {
    onEnter: () => boolean;
}

export const SubmitKeymap = Extension.create<SubmitKeymapOptions>({
    name: 'chatSubmitKeymap',

    priority: SUBMIT_KEYMAP_PRIORITY,

    addOptions() {
        return {
            onEnter: () => false,
        };
    },

    addKeyboardShortcuts() {
        return {
            Enter: () => this.options.onEnter(),
        };
    },
});
