import { Editor } from '@tiptap/core';
import { describe, expect, it, vi } from 'vitest';

import type { DirectiveSuggestionBase } from '@/lib/chat/directives';
import { installRichTextDomShims } from '@/test/dom-shims';

import { createMentionExtension } from '../suggestion/mention-suggestion';

import { chatSchema } from './chat-schema';
import { SUBMIT_KEYMAP_PRIORITY, SubmitKeymap } from './submit-keymap';

installRichTextDomShims();

const makeEditor = (onEnter: () => boolean) => {
    const element = document.createElement('div');

    document.body.appendChild(element);

    return new Editor({
        element,
        extensions: [chatSchema, SubmitKeymap.configure({ onEnter })],
        content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hi' }] }] },
    });
};

const pressEnter = (editor: Editor, init: KeyboardEventInit = {}) => {
    editor.commands.focus('end');
    editor.view.dom.dispatchEvent(
        new KeyboardEvent('keydown', {
            key: 'Enter',
            bubbles: true,
            cancelable: true,
            ...init,
        }),
    );
};

describe('SubmitKeymap', () => {
    it('submits plain Enter without inserting a newline', () => {
        const onEnter = vi.fn(() => true);
        const editor = makeEditor(onEnter);

        pressEnter(editor);

        expect(onEnter).toHaveBeenCalledTimes(1);
        expect(editor.getText({ blockSeparator: '\n' })).toBe('hi');
    });

    it('lets Shift+Enter insert a newline instead of submitting', () => {
        const onEnter = vi.fn(() => true);
        const editor = makeEditor(onEnter);

        pressEnter(editor, { shiftKey: true });

        expect(onEnter).not.toHaveBeenCalled();
        expect(editor.getText({ blockSeparator: '\n' })).toBe('hi\n');
    });

    it('inserts a newline when onEnter declines (send shortcut off)', () => {
        const onEnter = vi.fn(() => false);
        const editor = makeEditor(onEnter);

        pressEnter(editor);

        expect(onEnter).toHaveBeenCalledTimes(1);
        expect(editor.getText({ blockSeparator: '\n' })).toBe('hi\n');
    });

    it('ranks the mention trigger above the submit keymap so an open menu consumes Enter first', () => {
        const mentionItemsRef = { current: [] as DirectiveSuggestionBase[] };
        const mention = createMentionExtension({ mentionItemsRef });

        expect(mention.config.priority).toBeGreaterThan(SUBMIT_KEYMAP_PRIORITY);
    });
});
