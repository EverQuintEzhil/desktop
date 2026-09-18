import { Extension } from '@tiptap/core';
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion';

import { SUBMIT_KEYMAP_PRIORITY } from '../extensions/submit-keymap';

const TRIGGER_PRIORITY = SUBMIT_KEYMAP_PRIORITY + 100;

export const createTriggerExtension = <I, T>(
    name: string,
    suggestion: Omit<SuggestionOptions<I, T>, 'editor'>,
): Extension =>
    Extension.create({
        name,

        priority: TRIGGER_PRIORITY,

        addProseMirrorPlugins() {
            return [Suggestion<I, T>({ editor: this.editor, ...suggestion })];
        },
    });
