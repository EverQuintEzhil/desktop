import { Editor } from '@tiptap/core';
import { describe, expect, it, vi } from 'vitest';

import type { DirectiveSuggestionBase } from '@/lib/chat/directives';
import { installRichTextDomShims } from '@/test/dom-shims';

import { createMentionExtension } from '../suggestion/mention-suggestion';

import { chatSchema } from './chat-schema';
import { COMPOSER_ESCAPE_PRIORITY, ComposerEscape } from './composer-escape';
import { SUBMIT_KEYMAP_PRIORITY } from './submit-keymap';

installRichTextDomShims();

const makeEditor = (onEscape: () => boolean) => {
    const element = document.createElement('div');

    document.body.appendChild(element);

    return new Editor({
        element,
        extensions: [chatSchema, ComposerEscape.configure({ onEscape })],
        content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hi' }] }] },
    });
};

const pressEscape = (editor: Editor) => {
    const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        keyCode: 27,
        bubbles: true,
        cancelable: true,
    });

    editor.commands.focus('end');
    editor.view.dom.dispatchEvent(event);

    return event;
};

describe('ComposerEscape', () => {
    it('reaches the composer on Escape', () => {
        const onEscape = vi.fn(() => true);

        pressEscape(makeEditor(onEscape));

        expect(onEscape).toHaveBeenCalledTimes(1);
    });

    it('still runs when the composer declines the key', () => {
        const onEscape = vi.fn(() => false);

        pressEscape(makeEditor(onEscape));

        expect(onEscape).toHaveBeenCalledTimes(1);
    });

    it('is the only viable hook: prosemirror-view always defaultPrevents Escape', () => {
        const event = pressEscape(makeEditor(() => false));

        expect(event.defaultPrevented).toBe(true);
    });

    it('ranks below every other keymap so open menus see Escape first', () => {
        const mention = createMentionExtension({ mentionItemsRef: { current: [] as DirectiveSuggestionBase[] } });

        expect(COMPOSER_ESCAPE_PRIORITY).toBeLessThan(SUBMIT_KEYMAP_PRIORITY);
        expect(COMPOSER_ESCAPE_PRIORITY).toBeLessThan(Number(mention.config.priority));
    });
});
