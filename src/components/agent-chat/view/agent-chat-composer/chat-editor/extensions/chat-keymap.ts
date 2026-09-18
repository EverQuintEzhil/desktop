import { Extension, type Editor } from '@tiptap/core';
import type { ResolvedPos } from '@tiptap/pm/model';

import { IS_MAC } from '@/hooks/keyboard-shortcuts/binding';

import { DIRECTIVE_MENTION_NAME } from './directive-mention';
import { asOwnUndoStep } from './history-step';

const deleteAsOwnUndoStep = (editor: Editor, from: number, to: number): boolean =>
    asOwnUndoStep(editor, () => editor.commands.deleteRange({ from, to }));

const lineStartBefore = ($from: ResolvedPos): number => {
    const blockStart = $from.start();
    let lineStart = blockStart;

    $from.parent.forEach((child, offset) => {
        const childEnd = blockStart + offset + child.nodeSize;

        if (child.type.name === 'hardBreak' && childEnd <= $from.pos) {
            lineStart = childEnd;
        }
    });

    return lineStart;
};

export const deleteToLineStart = (editor: Editor): boolean => {
    const { $from, $to, empty } = editor.state.selection;

    if (!empty) return deleteAsOwnUndoStep(editor, $from.pos, $to.pos);

    const lineStart = lineStartBefore($from);

    if (lineStart >= $from.pos) return false;

    return deleteAsOwnUndoStep(editor, lineStart, $from.pos);
};

export const deleteChipBefore = (editor: Editor): boolean => {
    const { $from, empty } = editor.state.selection;

    if (!empty) return false;

    let from = $from.pos;
    let before = $from.nodeBefore;

    if (before?.isText) {
        const text = before.text ?? '';
        const trimmed = text.replace(/\s+$/u, '');

        if (trimmed.length > 0) return false;

        from -= text.length;
        before = editor.state.doc.resolve(from).nodeBefore;
    }

    if (before?.type.name !== DIRECTIVE_MENTION_NAME) return false;

    return deleteAsOwnUndoStep(editor, from - before.nodeSize, $from.pos);
};

export const ChatKeymap = Extension.create({
    name: 'chatDeletionKeymap',

    addKeyboardShortcuts() {
        return {
            'Mod-Backspace': () => (IS_MAC ? deleteToLineStart(this.editor) : deleteChipBefore(this.editor)),
            'Alt-Backspace': () => deleteChipBefore(this.editor),
        };
    },
});
