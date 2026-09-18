import { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';

import { installRichTextDomShims } from '@/test/dom-shims';

import { ChatKeymap, deleteChipBefore, deleteToLineStart } from './extensions/chat-keymap';
import { chatSchema } from './extensions/chat-schema';
import { DirectiveMention, insertDirective } from './extensions/directive-mention';
import { VariableHighlight } from './extensions/variable-highlight';
import { findVariableRanges, getEditorText } from './serialize';

installRichTextDomShims();

const CHIP_ATTRS = {
    directiveType: 'tool',
    label: 'Linear',
    id: 'Linear',
    favicon: null,
};
const CHIP_TOKEN = ':tool[Linear]';

const makeEditor = () => {
    const element = document.createElement('div');

    document.body.appendChild(element);

    return new Editor({
        element,
        extensions: [chatSchema, ChatKeymap, DirectiveMention, VariableHighlight],
        content: { type: 'doc', content: [{ type: 'paragraph' }] },
    });
};

const type = (editor: Editor, text: string) => {
    editor.commands.insertContent(text);
};

const text = (editor: Editor) => getEditorText(editor);

const insertChipFor = (editor: Editor, query: string) => {
    const to = editor.state.selection.from;

    insertDirective(editor, { from: to - query.length, to }, CHIP_ATTRS);
};

describe('chat editor undo/redo — typing', () => {
    it('undoes a typed chunk and redoes it', () => {
        const editor = makeEditor();

        type(editor, 'alpha');
        expect(text(editor)).toBe('alpha');

        editor.commands.undo();
        expect(text(editor)).toBe('');

        editor.commands.redo();
        expect(text(editor)).toBe('alpha');
    });

    it('coalesces a single burst of typing into one undo step', () => {
        const editor = makeEditor();

        type(editor, 'alpha');
        type(editor, ' beta');

        editor.commands.undo();
        expect(text(editor)).toBe('');
    });

    it('treats undo on an empty history and redo on an empty stack as no-ops', () => {
        const editor = makeEditor();

        editor.commands.undo();
        expect(text(editor)).toBe('');

        type(editor, 'solo');
        editor.commands.redo();
        expect(text(editor)).toBe('solo');
    });

    it('round-trips exactly through undo-all then redo-all', () => {
        const editor = makeEditor();

        type(editor, 'alpha');
        insertChipFor(editor, 'alpha');
        type(editor, ' beta');
        const full = text(editor);

        editor.commands.undo();
        editor.commands.undo();
        editor.commands.undo();
        expect(text(editor)).toBe('');

        editor.commands.redo();
        editor.commands.redo();
        editor.commands.redo();
        expect(text(editor)).toBe(full);
    });

    it('restores the whole document after a select-all line kill', () => {
        const editor = makeEditor();

        type(editor, 'keep this text');
        editor.commands.selectAll();
        deleteToLineStart(editor);
        expect(text(editor)).toBe('');

        editor.commands.undo();
        expect(text(editor)).toBe('keep this text');
    });
});

describe('chat editor undo/redo — mention chips', () => {
    it('undoes a chip insert back to the query text and redoes it', () => {
        const editor = makeEditor();

        type(editor, '@lin');
        insertChipFor(editor, '@lin');
        expect(text(editor)).toBe(`${CHIP_TOKEN} `);

        editor.commands.undo();
        expect(text(editor)).toBe('@lin');

        editor.commands.redo();
        expect(text(editor)).toBe(`${CHIP_TOKEN} `);
    });

    it('removes trailing text before the chip on successive undos', () => {
        const editor = makeEditor();

        type(editor, '@lin');
        insertChipFor(editor, '@lin');
        type(editor, 'tail');

        editor.commands.undo();
        expect(text(editor)).toBe(`${CHIP_TOKEN} `);

        editor.commands.undo();
        expect(text(editor)).toBe('@lin');
    });

    it('restores a chip deleted with Backspace', () => {
        const editor = makeEditor();

        type(editor, '@lin');
        insertChipFor(editor, '@lin');
        editor.commands.selectAll();
        editor.commands.deleteSelection();
        expect(text(editor)).toBe('');

        editor.commands.undo();
        expect(text(editor)).toBe(`${CHIP_TOKEN} `);
    });

    it('leaves the caret at the end of the restored query after undoing a chip', () => {
        const editor = makeEditor();

        type(editor, '@lin');
        insertChipFor(editor, '@lin');
        editor.commands.undo();

        expect(text(editor)).toBe('@lin');
        expect(editor.state.selection.from).toBe(editor.state.doc.content.size - 1);
    });
});

describe('chat editor variable ranges', () => {
    it('finds every occurrence of a repeated variable, in document order', () => {
        const editor = makeEditor();

        type(editor, 'Hello {{name}}, meet {{name}}');

        const ranges = findVariableRanges(editor, 'name');

        expect(ranges).toHaveLength(2);
        expect(ranges[0].from).toBeLessThan(ranges[1].from);
    });

    it('ignores a variable that lives inside a chip label rather than the text', () => {
        const editor = makeEditor();
        const labelled = {
            directiveType: 'skill',
            label: 'Fix {{issue}}',
            id: 'skill-1',
            favicon: null,
        };

        insertDirective(editor, { from: editor.state.selection.from, to: editor.state.selection.from }, labelled);

        const ranges = findVariableRanges(editor, 'issue');

        ranges.forEach((range) => {
            expect(range.from).toBeGreaterThanOrEqual(0);
            expect(range.to).toBeLessThanOrEqual(editor.state.doc.content.size);
            expect(range.from).toBeLessThan(range.to);
        });
    });

    it('returns nothing for a variable that is not present', () => {
        const editor = makeEditor();

        type(editor, 'Hello {{name}}');

        expect(findVariableRanges(editor, 'other')).toHaveLength(0);
    });
});

describe('chat editor undo/redo — variables', () => {
    it('undoes and redoes a {{variable}} keeping its decoration', () => {
        const editor = makeEditor();

        type(editor, 'use {{city}} now');
        expect(editor.view.dom.querySelectorAll('.variable-highlight')).toHaveLength(1);

        editor.commands.undo();
        expect(text(editor)).toBe('');

        editor.commands.redo();
        expect(text(editor)).toBe('use {{city}} now');
        expect(editor.view.dom.querySelectorAll('.variable-highlight')).toHaveLength(1);
    });

    it('keeps a chip and a variable in the same message', () => {
        const editor = makeEditor();

        type(editor, '@lin');
        insertChipFor(editor, '@lin');
        type(editor, 'check {{x}}');

        expect(text(editor)).toBe(`${CHIP_TOKEN} check {{x}}`);
        expect(editor.view.dom.querySelectorAll('.directive-highlight')).toHaveLength(1);
        expect(editor.view.dom.querySelectorAll('.variable-highlight')).toHaveLength(1);
    });
});

describe('chat editor undo/redo — deletion shortcuts stay separate steps', () => {
    it('undoes a delete-to-line-start without also undoing the typing', () => {
        const editor = makeEditor();

        type(editor, 'hello');
        deleteToLineStart(editor);
        expect(text(editor)).toBe('');

        editor.commands.undo();
        expect(text(editor)).toBe('hello');
    });

    it('keeps typing that follows a deletion out of the deletion step', () => {
        const editor = makeEditor();

        type(editor, 'hello');
        deleteToLineStart(editor);
        type(editor, 'world');

        editor.commands.undo();
        expect(text(editor)).toBe('');

        editor.commands.undo();
        expect(text(editor)).toBe('hello');
    });

    it('undoes a chip word-delete on its own', () => {
        const editor = makeEditor();

        type(editor, '@lin');
        insertChipFor(editor, '@lin');
        editor.commands.focus('end');

        expect(deleteChipBefore(editor)).toBe(true);
        expect(text(editor)).toBe('');

        editor.commands.undo();
        expect(text(editor)).toBe(`${CHIP_TOKEN} `);
    });

    it('deletes only the current hard line and restores it on undo', () => {
        const editor = makeEditor();

        type(editor, 'first');
        editor.commands.setHardBreak();
        type(editor, 'second');
        expect(text(editor)).toBe('first\nsecond');

        deleteToLineStart(editor);
        expect(text(editor)).toBe('first\n');

        editor.commands.undo();
        expect(text(editor)).toBe('first\nsecond');
    });
});
