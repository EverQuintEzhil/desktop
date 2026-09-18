import { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';

import { installRichTextDomShims } from '@/test/dom-shims';

import { ChatKeymap, deleteChipBefore, deleteToLineStart } from './chat-keymap';
import { chatSchema } from './chat-schema';
import { DirectiveMention } from './directive-mention';

installRichTextDomShims();

type InlineJson = Record<string, unknown>;

const chip: InlineJson = {
    type: 'directiveMention',
    attrs: {
        directiveType: 'tool',
        label: 'Linear',
        id: 'Linear',
        favicon: null,
    },
};

const text = (value: string): InlineJson => ({ type: 'text', text: value });

const makeEditor = (content: InlineJson[]) => {
    const element = document.createElement('div');

    document.body.appendChild(element);

    return new Editor({
        element,
        extensions: [chatSchema, DirectiveMention, ChatKeymap],
        content: {
            type: 'doc',
            content: [content.length > 0 ? { type: 'paragraph', content } : { type: 'paragraph' }],
        },
    });
};

const getText = (editor: Editor) => editor.getText({ blockSeparator: '\n' });

const CHIP_TOKEN = ':tool[Linear]';

describe('deleteToLineStart', () => {
    it('deletes text and chips back to the start of the current hard line only', () => {
        const editor = makeEditor([text('first'), { type: 'hardBreak' }, chip, text(' list my issues')]);

        editor.commands.focus('end');

        expect(deleteToLineStart(editor)).toBe(true);
        expect(editor.getText({ blockSeparator: '\n' })).toBe('first\n');
    });

    it('declines when the caret already sits at the line start', () => {
        const editor = makeEditor([text('hello')]);

        editor.commands.focus('start');

        expect(deleteToLineStart(editor)).toBe(false);
        expect(editor.getText({ blockSeparator: '\n' })).toBe('hello');
    });
});

describe('deleteChipBefore', () => {
    it('deletes the chip when the caret is directly after it', () => {
        const editor = makeEditor([text('ask '), chip]);

        editor.commands.focus('end');

        expect(deleteChipBefore(editor)).toBe(true);
        expect(editor.getText({ blockSeparator: '\n' })).toBe('ask ');
    });

    it('deletes through trailing whitespace back through the chip', () => {
        const editor = makeEditor([chip, text('  ')]);

        editor.commands.focus('end');

        expect(deleteChipBefore(editor)).toBe(true);
        expect(editor.getText({ blockSeparator: '\n' })).toBe('');
    });

    it('declines after an ordinary word so native word deletion stays in charge', () => {
        const editor = makeEditor([chip, text(' issues')]);

        editor.commands.focus('end');

        expect(deleteChipBefore(editor)).toBe(false);
        expect(editor.getText({ blockSeparator: '\n' })).toBe(`${CHIP_TOKEN} issues`);
    });
});

describe('ChatKeymap bindings', () => {
    it('handles Alt-Backspace on a chip via the keymap', () => {
        const editor = makeEditor([chip]);

        editor.commands.focus('end');
        editor.view.dom.dispatchEvent(
            new KeyboardEvent('keydown', {
                key: 'Backspace',
                altKey: true,
                bubbles: true,
                cancelable: true,
            }),
        );

        expect(editor.getText({ blockSeparator: '\n' })).toBe('');
    });

    it('leaves Alt-Backspace unconsumed mid-text so the browser word-delete stays native', () => {
        const editor = makeEditor([text('hello world')]);

        editor.commands.focus('end');
        const event = new KeyboardEvent('keydown', {
            key: 'Backspace',
            altKey: true,
            bubbles: true,
            cancelable: true,
        });

        editor.view.dom.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(false);
        expect(editor.getText({ blockSeparator: '\n' })).toBe('hello world');
    });

    it('leaves Alt-Backspace unconsumed mid-text with the mac StarterKit keymap registered', () => {
        const original = Object.getOwnPropertyDescriptor(Navigator.prototype, 'platform');

        Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true });

        try {
            const editor = makeEditor([text('hello world')]);

            editor.commands.focus('end');
            const event = new KeyboardEvent('keydown', {
                key: 'Backspace',
                altKey: true,
                bubbles: true,
                cancelable: true,
            });

            editor.view.dom.dispatchEvent(event);

            expect(event.defaultPrevented).toBe(false);
            expect(editor.getText({ blockSeparator: '\n' })).toBe('hello world');
        } finally {
            delete (navigator as { platform?: string }).platform;
            if (original) Object.defineProperty(Navigator.prototype, 'platform', original);
        }
    });

    it('leaves Ctrl-Backspace unconsumed mid-text on the pc keymap', () => {
        const editor = makeEditor([text('hello world')]);

        editor.commands.focus('end');
        const event = new KeyboardEvent('keydown', {
            key: 'Backspace',
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
        });

        editor.view.dom.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(false);
        expect(editor.getText({ blockSeparator: '\n' })).toBe('hello world');
    });

    it('keeps a fast type-then-cmd-delete as two separate undo steps', () => {
        const editor = makeEditor([]);

        editor.commands.focus('end');
        editor.commands.insertContent('hello');

        expect(deleteToLineStart(editor)).toBe(true);
        expect(getText(editor)).toBe('');

        editor.commands.undo();
        expect(getText(editor)).toBe('hello');

        editor.commands.undo();
        expect(getText(editor)).toBe('');
    });

    it('keeps typing after a cmd-delete out of the deletion undo step', () => {
        const editor = makeEditor([]);

        editor.commands.focus('end');
        editor.commands.insertContent('hello');
        deleteToLineStart(editor);
        editor.commands.insertContent('world');

        editor.commands.undo();
        expect(getText(editor)).toBe('');

        editor.commands.undo();
        expect(getText(editor)).toBe('hello');

        editor.commands.undo();
        expect(getText(editor)).toBe('');
    });

    it('keeps a fast chip alt-delete as its own undo step', () => {
        const editor = makeEditor([text('ask ')]);

        editor.commands.focus('end');
        editor.commands.insertContentAt(editor.state.selection.from, chip);
        editor.commands.focus('end');

        expect(deleteChipBefore(editor)).toBe(true);
        expect(getText(editor)).toBe('ask ');

        editor.commands.undo();
        expect(getText(editor)).toBe('ask ' + CHIP_TOKEN);
    });

    it('handles Ctrl-Backspace on a chip via the pc keymap binding', () => {
        const editor = makeEditor([chip]);

        editor.commands.focus('end');
        editor.view.dom.dispatchEvent(
            new KeyboardEvent('keydown', {
                key: 'Backspace',
                ctrlKey: true,
                bubbles: true,
                cancelable: true,
            }),
        );

        expect(editor.getText({ blockSeparator: '\n' })).toBe('');
    });
});
